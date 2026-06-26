/**
 * Test UNITAIRE de la machine à états de négociation (logique pure, sans base).
 * Lancement : npx tsx tests/negotiation.stateMachine.test.ts  (depuis backNode/)
 */
import assert from "node:assert/strict"
import { ALLOWED_TRANSITIONS, canTransition } from "../src/services/negotiation/stateMachine"
import type { NegotiationStatusValue } from "../src/services/negotiation/stateMachine"

let passed = 0
function check(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`) }
  catch (e) { console.error(`  ✗ ${name}`); console.error("    ", (e as Error).message); process.exitCode = 1 }
}

console.log("Machine à états — négociation")

check("transitions valides du tunnel", () => {
  assert.equal(canTransition("DRAFT", "IN_NEGOTIATION"), true)
  assert.equal(canTransition("IN_NEGOTIATION", "VALIDATED"), true)
  assert.equal(canTransition("IN_NEGOTIATION", "BLOCKED"), true)
  assert.equal(canTransition("BLOCKED", "IN_NEGOTIATION"), true)
  assert.equal(canTransition("VALIDATED", "IN_NEGOTIATION"), true) // ré-ouverture
})

check("transitions interdites", () => {
  assert.equal(canTransition("DRAFT", "VALIDATED"), false) // pas de saut direct
  assert.equal(canTransition("DRAFT", "BLOCKED"), false)
  assert.equal(canTransition("VALIDATED", "BLOCKED"), false)
})

check("CLOSED est terminal", () => {
  assert.deepEqual(ALLOWED_TRANSITIONS.CLOSED, [])
  assert.equal(canTransition("CLOSED", "IN_NEGOTIATION"), false)
  assert.equal(canTransition("CLOSED", "DRAFT"), false)
})

check("toute fermeture est permise", () => {
  for (const from of Object.keys(ALLOWED_TRANSITIONS) as NegotiationStatusValue[]) {
    if (from === "CLOSED") continue
    assert.equal(canTransition(from, "CLOSED"), true, `${from} → CLOSED doit être permis`)
  }
})

check("identité toujours permise (idempotence)", () => {
  for (const s of Object.keys(ALLOWED_TRANSITIONS) as NegotiationStatusValue[]) {
    assert.equal(canTransition(s, s), true, `${s} → ${s}`)
  }
})

console.log(`\n${passed}/5 tests passés.`)
if (process.exitCode === 1) { console.error("ÉCHEC"); }
else { console.log("OK"); }
