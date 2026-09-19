// Mode « complétion guidée » : l'autre partie remplit les champs qui lui sont
// assignés via un lien nominatif, puis le texte est interpolé et la session
// passe en VALIDATED (prête pour la signature).
//
// Même philosophie que le reste du module : couplage au Contrat par ID scalaire,
// opérations best-effort qui ne lèvent pas, audit systématique.
import crypto from "crypto"
import { prisma } from "../../../prisma/singletonPrisma.js"
import { hashToken } from "../encryption.js"
import { recordAudit } from "./audit.js"
import { safeEmit } from "./events.js"
import { transition } from "./stateMachine.js"
import { notifyOwnerCompletionFinished } from "./mail.js"

export type FieldSideValue = "OWNER" | "COUNTERPARTY" | "THIRD_PARTY"

export interface CompletionFieldInput {
  variableId: string
  label: string
  type?: string
  side?: FieldSideValue
  required?: boolean
  position?: number
  value?: string | null // pré-rempli côté créateur (side OWNER)
}

const FIELD_TYPES = new Set(["text", "date", "email", "number", "iban"])
const SIDES = new Set<FieldSideValue>(["OWNER", "COUNTERPARTY", "THIRD_PARTY"])

/** Interpole les marqueurs `{{variableId}}` du texte avec les valeurs des champs. */
export function interpolate(text: string, fields: { variableId: string; value: string | null }[]): string {
  let out = text
  for (const f of fields) {
    out = out.split(`{{${f.variableId}}}`).join(f.value ?? "")
  }
  return out
}

/** Validation minimale par type — le front valide aussi, ceci est la garde serveur. */
export function isValueValid(type: string, value: string): boolean {
  const v = value.trim()
  if (!v) return false
  switch (type) {
    case "email": return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
    case "date": return !Number.isNaN(Date.parse(v)) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v)
    case "number": return /^-?[\d\s.,]+$/.test(v)
    case "iban": return /^[A-Z]{2}\d{2}[A-Z0-9\s]{10,32}$/i.test(v)
    default: return true
  }
}

/**
 * Ouvre une session de complétion guidée : version 1 = texte avec marqueurs
 * `{{variableId}}` pour les champs des autres parties, champs assignés créés.
 */
export async function enterCompletion(opts: {
  contractExternalId: string
  ownerUserId: number
  title?: string
  contentText: string
  fields: CompletionFieldInput[]
  autoToSignature?: boolean
}): Promise<{ externalId: string } | null> {
  try {
    if (!opts.contractExternalId || !Number.isFinite(opts.ownerUserId)) return null
    if (!opts.contentText?.trim() || !Array.isArray(opts.fields) || opts.fields.length === 0) return null

    const session = await prisma.negotiationSession.create({
      data: {
        externalId: crypto.randomUUID(),
        contractExternalId: opts.contractExternalId,
        title: opts.title?.trim() || "Complétion du contrat",
        status: "IN_NEGOTIATION",
        mode: "COMPLETION",
        autoToSignature: Boolean(opts.autoToSignature),
        ownerUserId: opts.ownerUserId,
      },
    })
    await prisma.negotiationVersion.create({
      data: {
        externalId: crypto.randomUUID(),
        versionNumber: 1,
        label: "Document à compléter",
        contentText: opts.contentText,
        createdById: opts.ownerUserId,
        negotiationId: session.idNegotiation,
      },
    })
    await prisma.negotiationField.createMany({
      data: opts.fields.map((f, i) => ({
        externalId: crypto.randomUUID(),
        variableId: f.variableId,
        label: f.label || f.variableId,
        type: FIELD_TYPES.has(f.type ?? "") ? (f.type as string) : "text",
        side: SIDES.has(f.side as FieldSideValue) ? (f.side as FieldSideValue) : "COUNTERPARTY",
        required: f.required !== false,
        position: Number.isFinite(f.position) ? (f.position as number) : i,
        value: f.value ?? null,
        filledAt: f.value ? new Date() : null,
        negotiationId: session.idNegotiation,
      })),
    })
    // Synchronise le statut du contrat (best-effort, comme enterNegotiation).
    try {
      await prisma.contract.updateMany({
        where: { externalId: opts.contractExternalId },
        data: { status: "IN_NEGOTIATION" },
      })
    } catch { /* contrat absent : sans conséquence */ }
    await recordAudit(session.idNegotiation, "SESSION_CREATED", {
      actorUserId: opts.ownerUserId,
      payload: { mode: "COMPLETION", fields: opts.fields.length },
    })
    safeEmit("negotiation.entered", {
      negotiationExternalId: session.externalId,
      contractExternalId: opts.contractExternalId,
      mode: "COMPLETION",
    })
    return { externalId: session.externalId }
  } catch (e) {
    console.error("[negotiation] enterCompletion failed:", e)
    return null
  }
}

/** Contexte invité résolu et vérifié (lien actif + session ouverte). */
async function guestContext(token: string) {
  const g = await prisma.guestAccess.findUnique({ where: { tokenHash: hashToken(token) } })
  if (!g || g.revokedAt || g.expiresAt <= new Date()) return null
  const s = await prisma.negotiationSession.findUnique({
    where: { idNegotiation: g.negotiationId },
    include: { fields: { orderBy: { position: "asc" } } },
  })
  if (!s || s.status === "CLOSED") return null
  return { g, s }
}

/**
 * Enregistrement (partiel autorisé) des valeurs saisies par l'invité.
 * Seuls les champs du côté assigné à l'invité sont modifiables.
 */
export async function saveGuestFields(
  token: string,
  values: Record<string, string>,
): Promise<{ saved: number; invalid: string[] } | null> {
  try {
    const ctx = await guestContext(token)
    if (!ctx || ctx.s.mode !== "COMPLETION") return null
    const side = ctx.g.fillSide ?? "COUNTERPARTY"
    const editable = new Map(
      ctx.s.fields.filter((f) => f.side === side).map((f) => [f.externalId, f]),
    )
    let saved = 0
    const invalid: string[] = []
    for (const [fieldExternalId, raw] of Object.entries(values ?? {})) {
      const field = editable.get(fieldExternalId)
      if (!field) continue // champ d'une autre partie : ignoré silencieusement
      const value = String(raw ?? "").slice(0, 2000)
      if (value.trim() && !isValueValid(field.type, value)) {
        invalid.push(field.externalId)
        continue
      }
      await prisma.negotiationField.update({
        where: { idField: field.idField },
        data: {
          value: value.trim() || null,
          filledById: ctx.g.participantId,
          filledAt: value.trim() ? new Date() : null,
        },
      })
      saved += 1
    }
    if (saved > 0) {
      await recordAudit(ctx.s.idNegotiation, "FIELD_FILLED", {
        actorLabel: ctx.g.name || "Invité externe",
        payload: { count: saved },
      })
      safeEmit("completion.fieldsFilled", {
        negotiationExternalId: ctx.s.externalId,
        count: saved,
      })
    }
    return { saved, invalid }
  } catch (e) {
    console.error("[negotiation] saveGuestFields failed:", e)
    return null
  }
}

/**
 * Terminaison par l'invité : vérifie que tous ses champs requis sont remplis.
 * Si TOUTES les parties ont terminé, interpole le texte, crée la version
 * complétée, la valide et notifie le propriétaire.
 */
export async function completeByGuest(token: string): Promise<
  | { done: true; allPartiesDone: boolean; autoToSignature: boolean }
  | { done: false; missing: { id: string; label: string }[] }
  | null
> {
  try {
    const ctx = await guestContext(token)
    if (!ctx || ctx.s.mode !== "COMPLETION") return null
    const side = ctx.g.fillSide ?? "COUNTERPARTY"
    const mine = ctx.s.fields.filter((f) => f.side === side)
    const missing = mine
      .filter((f) => f.required && !(f.value ?? "").trim())
      .map((f) => ({ id: f.externalId, label: f.label }))
    if (missing.length > 0) return { done: false, missing }

    // Toutes les parties externes ont-elles terminé ?
    const externalPending = ctx.s.fields.filter(
      (f) => f.side !== "OWNER" && f.required && !(f.value ?? "").trim(),
    )
    const allPartiesDone = externalPending.length === 0
    if (allPartiesDone && ctx.s.status === "IN_NEGOTIATION") {
      const versions = await prisma.negotiationVersion.findMany({
        where: { negotiationId: ctx.s.idNegotiation },
        orderBy: { versionNumber: "desc" },
        take: 1,
      })
      const base = versions[0]
      if (base) {
        const finalText = interpolate(base.contentText, ctx.s.fields)
        const v = await prisma.negotiationVersion.create({
          data: {
            externalId: crypto.randomUUID(),
            versionNumber: base.versionNumber + 1,
            label: "Document complété",
            contentText: finalText,
            createdById: ctx.s.ownerUserId,
            negotiationId: ctx.s.idNegotiation,
          },
        })
        await prisma.negotiationSession.update({
          where: { idNegotiation: ctx.s.idNegotiation },
          data: { finalVersionId: v.idVersion },
        })
        await transition(ctx.s.externalId, "VALIDATED", null)
        await recordAudit(ctx.s.idNegotiation, "COMPLETION_FINISHED", {
          actorLabel: ctx.g.name || "Invité externe",
          versionId: v.idVersion,
        })
        safeEmit("completion.finished", {
          negotiationExternalId: ctx.s.externalId,
          contractExternalId: ctx.s.contractExternalId,
          versionExternalId: v.externalId,
        })
        void notifyOwnerCompletionFinished({
          ownerUserId: ctx.s.ownerUserId,
          documentTitle: ctx.s.title,
          negotiationExternalId: ctx.s.externalId,
          guestName: ctx.g.name,
          autoToSignature: ctx.s.autoToSignature,
        })
      }
    }
    return { done: true, allPartiesDone, autoToSignature: ctx.s.autoToSignature }
  } catch (e) {
    console.error("[negotiation] completeByGuest failed:", e)
    return null
  }
}

/** Liste des sessions d'un utilisateur pour la page « Mes négociations ». */
export async function listForOwner(userId: number) {
  const rows = await prisma.negotiationSession.findMany({
    where: { ownerUserId: userId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { versions: true, proposals: true, comments: true } },
      guestAccesses: {
        select: { name: true, email: true, expiresAt: true, revokedAt: true },
        orderBy: { createdAt: "desc" },
      },
      fields: { select: { side: true, required: true, value: true } },
    },
  })
  const now = new Date()
  return rows.map((s) => {
    const external = s.fields.filter((f) => f.side !== "OWNER" && f.required)
    const filled = external.filter((f) => (f.value ?? "").trim()).length
    return {
      id: s.externalId,
      contractExternalId: s.contractExternalId,
      title: s.title,
      status: s.status,
      mode: s.mode,
      counts: {
        versions: s._count.versions,
        proposals: s._count.proposals,
        comments: s._count.comments,
      },
      guests: s.guestAccesses.map((g) => ({
        name: g.name,
        email: g.email,
        active: !g.revokedAt && g.expiresAt > now,
      })),
      completion: s.mode === "COMPLETION"
        ? { filled, total: external.length }
        : null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }
  })
}
