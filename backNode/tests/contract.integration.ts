/**
 * Test d'intégration de l'API Contrathèque.
 *
 * Frappe directement backNode (port 3020) en simulant l'auth via les en-têtes
 * x-user-id / x-user-role (comme le fait le proxy). Couvre : KPI, création,
 * liste/filtre, validation de champ (trust but verify), avenant, RBAC, archive,
 * suppression. Auto-nettoyant (supprime le contrat de test à la fin).
 *
 * Prérequis : backNode lancé + base seedée (npm run seed:contratheque).
 * Lancement : npm run test:contract  (depuis backNode/)
 */
import assert from "node:assert/strict"

const BASE = process.env.BACKNODE_URL ?? "http://127.0.0.1:3020"
const USER_ID = process.env.TEST_USER_ID ?? "1"

type Json = Record<string, unknown>

function headers(role = "JURISTE"): Record<string, string> {
    return { "x-user-id": USER_ID, "x-user-role": role, "Content-Type": "application/json" }
}

async function api(method: string, path: string, role = "JURISTE", body?: unknown): Promise<{ status: number; json: Json }> {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: headers(role),
        body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    let json: Json = {}
    try { json = (await res.json()) as Json } catch { /* no body */ }
    return { status: res.status, json }
}

let passed = 0
async function check(name: string, fn: () => Promise<void>) {
    try {
        await fn()
        passed++
        console.log(`  ✓ ${name}`)
    } catch (e) {
        console.error(`  ✗ ${name}`)
        console.error("    ", e instanceof Error ? e.message : e)
        process.exitCode = 1
    }
}

async function main() {
    console.log("Tests d'intégration Contrathèque\n")

    // 1. KPI accessibles + structure
    await check("GET /contract/stats renvoie les 4 KPI", async () => {
        const { status, json } = await api("GET", "/contract/stats")
        assert.equal(status, 200)
        const d = json.data as Json
        for (const k of ["total", "expiringIn90Days", "tacitRenewal", "withoutEndDate"]) {
            assert.equal(typeof d[k], "number", `KPI ${k} manquant`)
        }
    })

    // 2. Création (éditeur) avec métadonnées
    let createdId = ""
    await check("POST /contract crée un contrat (JURISTE)", async () => {
        const { status, json } = await api("POST", "/contract", "JURISTE", {
            title: "[TEST] Contrat intégration",
            contractType: "Test",
            counterpartyName: "ACME Intégration",
            status: "ACTIVE",
            endDate: "2027-01-31",
            renewalType: "TACIT",
            isB2C: true,
            amount: 1234,
            metadataFields: [
                { fieldKey: "amount", value: "1234", confidenceScore: 0.55, validationStatus: "AI_SUGGESTED" },
            ],
        })
        assert.equal(status, 201)
        createdId = (json.data as Json).id as string
        assert.ok(createdId, "id manquant")
    })

    // 3. Détail : métadonnées présentes, champ encore suggéré
    await check("GET /contract/:id renvoie le détail + champ AI_SUGGESTED", async () => {
        const { status, json } = await api("GET", `/contract/${createdId}`)
        assert.equal(status, 200)
        const d = json.data as Json
        assert.equal(d.title, "[TEST] Contrat intégration")
        const fields = d.metadataFields as Json[]
        const amount = fields.find((f) => f.fieldKey === "amount")
        assert.ok(amount, "champ amount absent")
        assert.equal(amount!.validationStatus, "AI_SUGGESTED")
    })

    // 4. Trust but verify : correction d'un champ → HUMAN_CORRECTED + reflet colonne
    await check("POST /validate-field corrige le champ (HUMAN_CORRECTED)", async () => {
        const { status } = await api("POST", `/contract/${createdId}/validate-field`, "JURISTE", {
            fieldKey: "amount", value: "5000", status: "HUMAN_CORRECTED",
        })
        assert.equal(status, 200)
        const { json } = await api("GET", `/contract/${createdId}`)
        const d = json.data as Json
        const amount = (d.metadataFields as Json[]).find((f) => f.fieldKey === "amount")!
        assert.equal(amount.validationStatus, "HUMAN_CORRECTED")
        assert.equal(amount.value, "5000")
        // reflet dans la colonne structurée
        assert.equal(String(d.amount), "5000")
    })

    // 5. RBAC : LECTEUR ne peut pas muter
    await check("RBAC : LECTEUR reçoit 403 sur validate-field", async () => {
        const { status } = await api("POST", `/contract/${createdId}/validate-field`, "LECTEUR", {
            fieldKey: "amount", value: "9", status: "HUMAN_VALIDATED",
        })
        assert.equal(status, 403)
    })

    // 6. RBAC : LECTEUR peut lire
    await check("RBAC : LECTEUR peut lire la liste", async () => {
        const { status } = await api("GET", "/contract?pageSize=1", "LECTEUR")
        assert.equal(status, 200)
    })

    // 7. Avenant
    await check("POST /amendment ajoute un avenant", async () => {
        const { status } = await api("POST", `/contract/${createdId}/amendment`, "JURISTE", {
            title: "Avenant test", summary: "Test intégration",
        })
        assert.equal(status, 201)
        const { json } = await api("GET", `/contract/${createdId}`)
        assert.equal((json.data as Json).amendments && ((json.data as Json).amendments as Json[]).length, 1)
    })

    // 8. Filtre B2C
    await check("GET /contract?isB2C=true inclut le contrat de test", async () => {
        const { json } = await api("GET", "/contract?isB2C=true&pageSize=200")
        const items = (json.data as Json).items as Json[]
        assert.ok(items.some((c) => c.id === createdId), "contrat B2C absent du filtre")
    })

    // 8b. Échéances : calcul + alerte Chatel B2C présente (données seedées)
    await check("GET /deadlines renvoie des événements + une alerte Chatel B2C", async () => {
        const { status, json } = await api("GET", "/contract/deadlines?horizonDays=365")
        assert.equal(status, 200)
        const events = json.data as Json[]
        assert.ok(events.length > 0, "aucune échéance calculée")
        const types = new Set(events.map((e) => e.type))
        assert.ok(types.has("END_DATE"), "END_DATE manquant")
        assert.ok(types.has("NOTICE_DEADLINE"), "NOTICE_DEADLINE manquant")
        assert.ok(
            events.some((e) => e.type === "CHATEL_INFO" && e.isB2C === true),
            "alerte Chatel B2C manquante",
        )
        // Les événements sont triés par date croissante
        const dates = events.map((e) => e.date as string)
        assert.deepEqual(dates, [...dates].sort(), "échéances non triées par date")
    })

    // 9. RBAC : JURISTE ne peut pas supprimer
    await check("RBAC : JURISTE reçoit 403 sur DELETE", async () => {
        const { status } = await api("DELETE", `/contract/${createdId}`, "JURISTE")
        assert.equal(status, 403)
    })

    // 10. ADMIN supprime (nettoyage)
    await check("ADMIN supprime le contrat de test", async () => {
        const { status, json } = await api("DELETE", `/contract/${createdId}`, "ADMIN")
        assert.equal(status, 200)
        assert.equal(json.success, true)
        const { status: after } = await api("GET", `/contract/${createdId}`)
        assert.equal(after, 404)
    })

    console.log(`\n${passed} test(s) réussi(s)${process.exitCode ? " — DES TESTS ONT ÉCHOUÉ" : ""}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
