import crypto from "crypto"
import { prisma } from "../../../prisma/singletonPrisma"
import { recordAudit } from "./audit"
import { safeEmit } from "./events"

export type NegotiationStatusValue =
  | "DRAFT" | "IN_NEGOTIATION" | "VALIDATED" | "BLOCKED" | "CLOSED"

// ─── Logique PURE (testable sans base de données) ──────────────────────────────

/** Transitions autorisées de la machine à états. CLOSED est terminal. */
export const ALLOWED_TRANSITIONS: Record<NegotiationStatusValue, NegotiationStatusValue[]> = {
  DRAFT: ["IN_NEGOTIATION", "CLOSED"],
  IN_NEGOTIATION: ["VALIDATED", "BLOCKED", "CLOSED"],
  BLOCKED: ["IN_NEGOTIATION", "CLOSED"],
  VALIDATED: ["IN_NEGOTIATION", "CLOSED"], // ré-ouverture possible avant signature
  CLOSED: [], // terminal
}

/** Indique si la transition `from → to` est permise (identité toujours permise). */
export function canTransition(from: NegotiationStatusValue, to: NegotiationStatusValue): boolean {
  if (from === to) return true
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}

// ─── Effets sur la base — TOUS safe no-op (ne lèvent jamais) ────────────────────

/**
 * Synchronise le statut du Contrat existant (couplé par ID).
 * Best-effort : no-op silencieux si le contrat n'existe pas. N'impacte jamais
 * les autres modules.
 */
async function syncContractStatus(contractExternalId: string, status: "IN_NEGOTIATION"): Promise<void> {
  try {
    await prisma.contract.updateMany({ where: { externalId: contractExternalId }, data: { status } })
  } catch (e) {
    console.error("[negotiation] syncContractStatus failed:", e)
  }
}

/**
 * Crée la version 1 à partir du texte du contrat lié (lecture seule du Contrat
 * par ID — couplage faible). Best-effort : no-op si pas de texte / pas de contrat.
 */
async function seedFirstVersion(negotiationId: number, contractExternalId: string, ownerUserId: number): Promise<void> {
  try {
    const contract = await prisma.contract.findFirst({
      where: { externalId: contractExternalId },
      select: { ocrText: true, title: true },
    })
    const text = contract?.ocrText?.trim()
    if (!text) return // pas de texte source → le juriste créera la version manuellement
    await prisma.negotiationVersion.create({
      data: {
        externalId: crypto.randomUUID(),
        versionNumber: 1,
        label: "Version initiale",
        contentText: text,
        createdById: ownerUserId,
        negotiationId,
      },
    })
    await recordAudit(negotiationId, "VERSION_CREATED", { actorUserId: ownerUserId, payload: { seeded: true } })
  } catch (e) {
    console.error("[negotiation] seedFirstVersion failed:", e)
  }
}

/**
 * Point d'entrée du tunnel : ouvre (ou réutilise) une négociation pour un contrat.
 * Synchronise Contract.status → IN_NEGOTIATION. Retourne null en cas d'échec
 * (jamais d'exception remontante).
 */
export async function enterNegotiation(
  contractExternalId: string,
  ownerUserId: number,
  title?: string,
): Promise<{ externalId: string; status: NegotiationStatusValue } | null> {
  try {
    if (!contractExternalId || !Number.isFinite(ownerUserId)) return null
    // Réutilise une session ouverte (non close) si elle existe → idempotent.
    const existing = await prisma.negotiationSession.findFirst({
      where: { contractExternalId, status: { not: "CLOSED" } },
      orderBy: { createdAt: "desc" },
    })
    if (existing) return { externalId: existing.externalId, status: existing.status as NegotiationStatusValue }

    const session = await prisma.negotiationSession.create({
      data: {
        externalId: crypto.randomUUID(),
        contractExternalId,
        title: title?.trim() || "Négociation",
        status: "IN_NEGOTIATION",
        ownerUserId,
      },
    })
    await syncContractStatus(contractExternalId, "IN_NEGOTIATION")
    await recordAudit(session.idNegotiation, "SESSION_CREATED", { actorUserId: ownerUserId })
    // Auto-remplissage : crée la version 1 à partir du texte du contrat (ocrText),
    // pour que le document soit immédiatement prêt à annoter (zéro friction).
    await seedFirstVersion(session.idNegotiation, contractExternalId, ownerUserId)
    safeEmit("negotiation.entered", { negotiationExternalId: session.externalId, contractExternalId })
    return { externalId: session.externalId, status: "IN_NEGOTIATION" }
  } catch (e) {
    console.error("[negotiation] enterNegotiation failed:", e)
    return null
  }
}

/**
 * Transition générique gardée par la table d'états. No-op sûr si la négociation
 * n'existe pas ou si la transition est interdite (retourne false sans lever).
 */
export async function transition(
  negotiationExternalId: string,
  to: NegotiationStatusValue,
  actorUserId?: number | null,
): Promise<boolean> {
  try {
    const s = await prisma.negotiationSession.findUnique({ where: { externalId: negotiationExternalId } })
    if (!s) return false
    const from = s.status as NegotiationStatusValue
    if (from === to) return true
    if (!canTransition(from, to)) return false
    await prisma.negotiationSession.update({ where: { idNegotiation: s.idNegotiation }, data: { status: to } })
    await recordAudit(s.idNegotiation, "STATUS_CHANGED", { actorUserId: actorUserId ?? null, payload: { from, to } })
    safeEmit("negotiation.statusChanged", { negotiationExternalId, from, to })
    return true
  } catch (e) {
    console.error("[negotiation] transition failed:", e)
    return false
  }
}

/**
 * Sortie du tunnel vers la signature. Exige une version finale validée.
 * N'IMPORTE PAS le module signature : émet l'événement `version.validated` que
 * la signature peut consommer. No-op sûr si non trouvée / pas de version validée.
 */
export async function exitToSignature(
  negotiationExternalId: string,
): Promise<{ negotiationExternalId: string; contractExternalId: string; versionExternalId: string } | null> {
  try {
    const s = await prisma.negotiationSession.findUnique({ where: { externalId: negotiationExternalId } })
    if (!s || !s.finalVersionId) return null // pas de version validée → no-op sûr
    const version = await prisma.negotiationVersion.findUnique({ where: { idVersion: s.finalVersionId } })
    if (!version) return null
    const out = {
      negotiationExternalId,
      contractExternalId: s.contractExternalId,
      versionExternalId: version.externalId,
    }
    safeEmit("version.validated", { ...out, contentText: version.contentText })
    return out
  } catch (e) {
    console.error("[negotiation] exitToSignature failed:", e)
    return null
  }
}

/**
 * Abandon : passe la négociation à CLOSED. Idempotent. No-op sûr si introuvable.
 */
export async function abortNegotiation(
  negotiationExternalId: string,
  actorUserId?: number | null,
): Promise<boolean> {
  try {
    const s = await prisma.negotiationSession.findUnique({ where: { externalId: negotiationExternalId } })
    if (!s) return false
    if (s.status === "CLOSED") return true
    await prisma.negotiationSession.update({ where: { idNegotiation: s.idNegotiation }, data: { status: "CLOSED" } })
    await recordAudit(s.idNegotiation, "ABORTED", { actorUserId: actorUserId ?? null })
    safeEmit("negotiation.aborted", { negotiationExternalId, contractExternalId: s.contractExternalId })
    return true
  } catch (e) {
    console.error("[negotiation] abortNegotiation failed:", e)
    return false
  }
}
