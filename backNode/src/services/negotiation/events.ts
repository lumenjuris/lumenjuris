import { EventEmitter } from "node:events"

/**
 * Bus d'événements interne du module Négociation.
 *
 * Inversion de dépendance : les autres modules (ex. Signature) PEUVENT s'abonner
 * à ces événements ; la négociation, elle, n'importe JAMAIS les autres modules.
 * C'est ainsi que « version validée » peut déclencher la signature sans couplage.
 */
export const negotiationEvents = new EventEmitter()

export type NegotiationEventName =
  | "negotiation.entered"
  | "negotiation.statusChanged"
  | "negotiation.aborted"
  | "version.created"
  | "version.validated"
  | "proposal.created"
  | "comment.added"
  | "guest.invited"

/**
 * Stub de notification branchable. Par défaut : log. Remplaçable par un vrai
 * envoi (email, websocket…) sans toucher au reste du module.
 */
export function dispatchNotification(event: NegotiationEventName, payload: Record<string, unknown>): void {
  try {
    console.log(`[negotiation:notify] ${event}`, JSON.stringify(payload))
  } catch { /* no-op : une notification ne doit jamais casser une opération métier */ }
}

// Relaie automatiquement certains événements vers le dispatcher de notifications.
const NOTIFY_EVENTS: NegotiationEventName[] = [
  "version.validated", "proposal.created", "comment.added", "guest.invited",
]
for (const ev of NOTIFY_EVENTS) {
  negotiationEvents.on(ev, (payload: Record<string, unknown>) => dispatchNotification(ev, payload ?? {}))
}

/** Émet un événement de façon sûre (ne lève jamais). */
export function safeEmit(event: NegotiationEventName, payload: Record<string, unknown>): void {
  try {
    negotiationEvents.emit(event, payload)
  } catch (e) {
    console.error(`[negotiation] emit ${event} failed:`, e)
  }
}
