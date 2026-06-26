import { prisma } from "../../../prisma/singletonPrisma"

export type NegotiationAuditActionValue =
  | "SESSION_CREATED" | "STATUS_CHANGED" | "VERSION_CREATED" | "PROPOSAL_CREATED"
  | "PROPOSAL_STATUS_CHANGED" | "COMMENT_ADDED" | "PARTICIPANT_ADDED" | "PARTICIPANT_REMOVED"
  | "GUEST_INVITED" | "GUEST_REVOKED" | "VALIDATED" | "ABORTED"

/**
 * Trace une action dans la piste d'audit de la négociation.
 * Best-effort : ne lève jamais (une trace ratée ne casse pas l'opération métier).
 */
export async function recordAudit(
  negotiationId: number,
  action: NegotiationAuditActionValue,
  opts: { actorUserId?: number | null; actorLabel?: string | null; versionId?: number | null; payload?: unknown } = {},
): Promise<void> {
  try {
    await prisma.negotiationAudit.create({
      data: {
        negotiationId,
        action,
        actorUserId: opts.actorUserId ?? null,
        actorLabel: opts.actorLabel ?? null,
        versionId: opts.versionId ?? null,
        payload: opts.payload === undefined || opts.payload === null ? undefined : (opts.payload as object),
      },
    })
  } catch (e) {
    console.error("[negotiation] audit failed:", e)
  }
}
