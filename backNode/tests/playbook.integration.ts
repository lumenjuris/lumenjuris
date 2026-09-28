/**
 * Test d'intégration de l'API Playbook (règles de négociation).
 *
 * Frappe directement backNode (port 3020) en simulant l'auth via les en-têtes
 * x-user-id / x-user-role (comme le fait le proxy). Couvre : création,
 * modification, désactivation, règles actives, permissions, suppression.
 * Auto-nettoyant (supprime la règle de test à la fin).
 *
 * Prérequis : backNode lancé.
 * Lancement : npm run test:playbook  (depuis backNode/)
 */
import assert from "node:assert/strict"

const BASE = process.env.BACKNODE_URL ?? "http://127.0.0.1:3020"
const USER_ID = process.env.TEST_USER_ID ?? "1"

type Json = Record<string, any>

async function api(method: string, path: string, role = "JURISTE", body?: unknown): Promise<{ status: number; json: Json }> {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            "x-user-id": USER_ID,
            "x-user-role": role,
            "x-internal-api-key": process.env.INTERNAL_API_KEY ?? "",
            "Content-Type": "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    let json: Json = {}
    try { json = (await res.json()) as Json } catch { /* pas de corps */ }
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
    console.log("Tests d'intégration Playbook\n")
    let id = ""

    await check("création d'une règle (juriste)", async () => {
        const { status, json } = await api("POST", "/playbook/rules", "JURISTE", {
            name: "Durée maximale de cession (test)", category: "Droit à l'image", ruleType: "MAX",
            expectedValue: "24", unit: "mois", severity: "HIGH", suggestion: "Limiter la cession à 24 mois.",
            keywords: "cession, image",
        })
        assert.equal(status, 201)
        id = json.data.id
        assert.ok(id)
        assert.equal(json.data.ruleType, "MAX")
        assert.deepEqual(json.data.keywords, ["cession", "image"])
        assert.equal(json.data.isActive, true)
    })

    await check("nom obligatoire", async () => {
        const { status } = await api("POST", "/playbook/rules", "JURISTE", { name: "  " })
        assert.equal(status, 400)
    })

    await check("modification", async () => {
        const { status, json } = await api("PATCH", `/playbook/rules/${id}`, "JURISTE", { expectedValue: "18", ruleType: "PAS_UN_TYPE" })
        assert.equal(status, 200)
        assert.equal(json.data.expectedValue, "18")
        assert.equal(json.data.ruleType, "MAX", "un type invalide est ignoré")
    })

    await check("désactivation → absente des règles actives", async () => {
        await api("PATCH", `/playbook/rules/${id}`, "JURISTE", { isActive: false })
        const actives = await api("GET", "/playbook/rules?active=true")
        assert.ok(!actives.json.data.some((r: Json) => r.id === id))
        const toutes = await api("GET", "/playbook/rules")
        assert.ok(toutes.json.data.some((r: Json) => r.id === id))
    })

    await check("réactivation → présente dans les règles actives", async () => {
        await api("PATCH", `/playbook/rules/${id}`, "JURISTE", { isActive: true })
        const actives = await api("GET", "/playbook/rules?active=true")
        assert.ok(actives.json.data.some((r: Json) => r.id === id))
    })

    await check("permissions : un lecteur consulte mais ne modifie pas", async () => {
        assert.equal((await api("GET", "/playbook/rules", "LECTEUR")).status, 200)
        assert.equal((await api("POST", "/playbook/rules", "LECTEUR", { name: "x" })).status, 403)
        assert.equal((await api("PATCH", `/playbook/rules/${id}`, "LECTEUR", { name: "x" })).status, 403)
        assert.equal((await api("DELETE", `/playbook/rules/${id}`, "LECTEUR")).status, 403)
    })

    await check("un autre utilisateur ne voit pas la règle", async () => {
        const res = await fetch(`${BASE}/playbook/rules/${id}`, {
            method: "DELETE",
            headers: { "x-user-id": "999999", "x-user-role": "ADMIN", "x-internal-api-key": process.env.INTERNAL_API_KEY ?? "" },
        })
        assert.notEqual(res.status, 200)
    })

    await check("suppression", async () => {
        assert.equal((await api("DELETE", `/playbook/rules/${id}`)).status, 200)
        const toutes = await api("GET", "/playbook/rules")
        assert.ok(!toutes.json.data.some((r: Json) => r.id === id))
    })

    let pb = ""
    await check("plusieurs playbooks : création, règle rattachée, isolement", async () => {
        const cree = await api("POST", "/playbook/playbooks", "JURISTE", { name: "NDA (test)", contractType: "NDA" })
        assert.equal(cree.status, 201)
        pb = cree.json.data.id
        const regle = await api("POST", "/playbook/rules", "JURISTE", { name: "Durée de confidentialité (test)", playbookId: pb })
        assert.equal(regle.status, 201)
        assert.equal(regle.json.data.playbookId, pb)
        const duPlaybook = await api("GET", `/playbook/rules?playbook=${pb}`)
        assert.equal(duPlaybook.json.data.length, 1)
        const parDefaut = await api("GET", "/playbook/rules")
        assert.ok(!parDefaut.json.data.some((r: Json) => r.playbookId === pb), "le playbook par défaut ne voit pas la règle")
        const liste = await api("GET", "/playbook/playbooks")
        const trouve = liste.json.data.find((p: Json) => p.id === pb)
        assert.equal(trouve.ruleCount, 1)
        assert.ok(liste.json.data.some((p: Json) => p.isDefault))
    })

    await check("playbook inconnu → 404", async () => {
        assert.equal((await api("GET", "/playbook/rules?playbook=inconnu")).status, 404)
    })

    await check("le playbook principal ne peut pas être supprimé", async () => {
        const liste = await api("GET", "/playbook/playbooks")
        const defaut = liste.json.data.find((p: Json) => p.isDefault)
        assert.equal((await api("DELETE", `/playbook/playbooks/${defaut.id}`)).status, 400)
    })

    await check("historique : enregistrement, relecture, mise à jour, suppression", async () => {
        const cree = await api("POST", "/playbook/analyses", "JURISTE", {
            fileName: "Contrat test.docx", playbookId: pb,
            summary: { compliant: 1, nonCompliant: 2, toCheck: 0 },
            snapshot: { text: "Texte du contrat", applied: {} },
        })
        assert.equal(cree.status, 201)
        const aid = cree.json.data.id
        const liste = await api("GET", "/playbook/analyses")
        const ligne = liste.json.data.find((a: Json) => a.id === aid)
        assert.equal(ligne.fileName, "Contrat test.docx")
        assert.equal(ligne.nonCompliant, 2)
        assert.equal(ligne.playbookName, "NDA (test)")
        await api("PATCH", `/playbook/analyses/${aid}`, "JURISTE", { summary: { compliant: 3 }, snapshot: { text: "Modifié", applied: { r: "x" } } })
        const detail = await api("GET", `/playbook/analyses/${aid}`)
        assert.equal(detail.json.data.snapshot.text, "Modifié")
        assert.equal((await api("DELETE", `/playbook/analyses/${aid}`)).status, 200)
    })

    await check("suppression d'un playbook et de ses règles", async () => {
        assert.equal((await api("DELETE", `/playbook/playbooks/${pb}`)).status, 200)
        assert.equal((await api("GET", `/playbook/rules?playbook=${pb}`)).status, 404)
    })

    console.log(`\n${passed} test(s) réussi(s)`)
}

void main()
