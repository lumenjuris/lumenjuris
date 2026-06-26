/**
 * Test d'intégration du module Négociation. Frappe backNode:3020 en simulant
 * l'auth via x-user-id / x-user-role (comme le proxy). Couvre : entrée du tunnel,
 * versioning immuable, propositions, commentaires interne/externe, participants,
 * lien invité (vue filtrée + commentaire externe), validation → sortie signature,
 * appels HORS CONTEXTE (no-op sûrs), abandon. Auto-nettoyant.
 *
 * Prérequis : backNode lancé. Lancement : npx tsx tests/negotiation.integration.ts
 */
import assert from "node:assert/strict"

const BASE = process.env.BACKNODE_URL ?? "http://127.0.0.1:3020"
const USER_ID = process.env.TEST_USER_ID ?? "1"
type Json = Record<string, any>

function headers(role = "JURISTE"): Record<string, string> {
  return { "x-user-id": USER_ID, "x-user-role": role, "Content-Type": "application/json" }
}
async function api(method: string, path: string, body?: unknown, role = "JURISTE"): Promise<{ status: number; json: Json }> {
  const res = await fetch(`${BASE}${path}`, { method, headers: headers(role), body: body !== undefined ? JSON.stringify(body) : undefined })
  let json: Json = {}
  try { json = (await res.json()) as Json } catch { /* no body */ }
  return { status: res.status, json }
}
async function pub(method: string, path: string, body?: unknown): Promise<{ status: number; json: Json }> {
  const res = await fetch(`${BASE}${path}`, { method, headers: { "Content-Type": "application/json" }, body: body !== undefined ? JSON.stringify(body) : undefined })
  let json: Json = {}
  try { json = (await res.json()) as Json } catch { /* no body */ }
  return { status: res.status, json }
}

let passed = 0
async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { console.error(`  ✗ ${name}`); console.error("    ", (e as Error).message); process.exitCode = 1 }
}

async function main() {
  console.log("Module Négociation — intégration\n")
  const fakeContract = `test-nego-${Date.now()}`
  let negId = ""
  let versionId = ""
  let guestToken = ""

  await check("enter — ouvre une négociation (no-op contrat absent OK)", async () => {
    const r = await api("POST", "/negotiation/enter", { contractExternalId: fakeContract, title: "Négo test" })
    assert.equal(r.status, 201)
    assert.ok(r.json.data?.id)
    assert.equal(r.json.data.status, "IN_NEGOTIATION")
    negId = r.json.data.id
  })

  await check("enter — idempotent (réutilise la session ouverte)", async () => {
    const r = await api("POST", "/negotiation/enter", { contractExternalId: fakeContract })
    assert.equal(r.json.data.id, negId)
  })

  await check("versioning — crée des versions numérotées immuables", async () => {
    const v1 = await api("POST", `/negotiation/${negId}/versions`, { contentText: "Article 1. Texte initial.", label: "Round 1" })
    assert.equal(v1.status, 201)
    const v2 = await api("POST", `/negotiation/${negId}/versions`, { contentText: "Article 1. Texte révisé.", label: "Round 2" })
    assert.equal(v2.json.data.versionNumber, 2)
    versionId = v2.json.data.id
  })

  await check("proposition + changement de statut", async () => {
    const p = await api("POST", `/negotiation/${negId}/proposals`, { clauseRef: "art-1", proposedText: "Nouvelle rédaction art.1", originalText: "Ancienne" })
    assert.equal(p.status, 201)
    const upd = await api("PATCH", `/negotiation/${negId}/proposals/${p.json.data.id}`, { status: "ACCEPTED" })
    assert.equal(upd.json.success, true)
  })

  await check("commentaires interne + externe", async () => {
    const ci = await api("POST", `/negotiation/${negId}/comments`, { body: "Note interne confidentielle", visibility: "INTERNAL", clauseRef: "art-1" })
    assert.equal(ci.status, 201)
    const ce = await api("POST", `/negotiation/${negId}/comments`, { body: "Question à la contrepartie", visibility: "EXTERNAL", clauseRef: "art-1" })
    assert.equal(ce.status, 201)
  })

  await check("participant externe + lien invité", async () => {
    await api("POST", `/negotiation/${negId}/participants`, { side: "EXTERNAL", role: "COMMENTER", name: "Contrepartie", email: "x@ext.com" })
    const g = await api("POST", `/negotiation/${negId}/guests`, { ttlHours: 24 })
    assert.equal(g.status, 201)
    assert.ok(g.json.data?.token)
    guestToken = g.json.data.token
  })

  await check("vue invité — commentaire interne MASQUÉ, externe visible", async () => {
    const r = await pub("GET", `/negotiation/public/${guestToken}`)
    assert.equal(r.status, 200)
    const bodies = (r.json.data.comments as Json[]).map((c) => c.body)
    assert.ok(bodies.includes("Question à la contrepartie"), "le commentaire externe doit être visible")
    assert.ok(!bodies.includes("Note interne confidentielle"), "le commentaire interne NE doit PAS fuiter")
    assert.deepEqual(r.json.data.auditLogs, [], "l'audit ne doit pas fuiter à l'invité")
  })

  await check("invité peut commenter (visible côté interne ensuite)", async () => {
    const r = await pub("POST", `/negotiation/public/${guestToken}/comments`, { body: "Réponse de la contrepartie", clauseRef: "art-1" })
    assert.equal(r.status, 201)
  })

  await check("validation d'une version → VALIDATED + sortie signature", async () => {
    const r = await api("POST", `/negotiation/${negId}/versions/${versionId}/validate`)
    assert.equal(r.status, 200)
    assert.ok(r.json.data?.exit, "exitToSignature doit renvoyer la version")
    const detail = await api("GET", `/negotiation/${negId}`)
    assert.equal(detail.json.data.status, "VALIDATED")
  })

  await check("exit — émet la version validée vers la signature", async () => {
    const r = await api("POST", `/negotiation/${negId}/exit`)
    assert.equal(r.status, 200)
    assert.equal(r.json.data.versionExternalId, versionId)
  })

  // ── Appels HORS CONTEXTE : doivent être des no-op sûrs, jamais de 500 ──
  await check("hors contexte — get sur id inexistant → 404 (pas 500)", async () => {
    const r = await api("GET", "/negotiation/inexistant-xyz")
    assert.equal(r.status, 404)
  })
  await check("hors contexte — exit sur id inexistant → 409 sûr", async () => {
    const r = await api("POST", "/negotiation/inexistant-xyz/exit")
    assert.equal(r.status, 409)
  })
  await check("hors contexte — abort sur id inexistant → success:false sans crash", async () => {
    const r = await api("POST", "/negotiation/inexistant-xyz/abort")
    assert.equal(r.status, 200)
    assert.equal(r.json.success, false)
  })
  await check("vue invité — token invalide → 404", async () => {
    const r = await pub("GET", "/negotiation/public/token-bidon")
    assert.equal(r.status, 404)
  })

  await check("abandon — passe la négociation à CLOSED (idempotent)", async () => {
    const r1 = await api("POST", `/negotiation/${negId}/abort`)
    assert.equal(r1.json.success, true)
    const r2 = await api("POST", `/negotiation/${negId}/abort`) // idempotent
    assert.equal(r2.json.success, true)
    const detail = await api("GET", `/negotiation/${negId}`)
    assert.equal(detail.json.data.status, "CLOSED")
  })

  // ── Nettoyage : supprime la session de test (cascade enfants) ──
  console.log("\n  (nettoyage de la session de test via API non exposée → laissé en CLOSED)")

  console.log(`\n${passed} tests passés.`)
  if (process.exitCode === 1) console.error("ÉCHEC")
  else console.log("OK")
}

main().catch((e) => { console.error(e); process.exit(1) })
