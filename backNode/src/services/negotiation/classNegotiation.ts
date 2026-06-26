import crypto from "crypto"
import { prisma } from "../../../prisma/singletonPrisma"
import { recordAudit } from "./audit"
import { safeEmit } from "./events"
import { transition, exitToSignature } from "./stateMachine"

export type ProposalStatusValue = "PROPOSED" | "ACCEPTED" | "REJECTED" | "COUNTERED"
export type CommentVisibilityValue = "INTERNAL" | "EXTERNAL"
export type ParticipantSideValue = "INTERNAL" | "EXTERNAL"
export type ParticipantRoleValue = "READER" | "COMMENTER" | "PROPOSER" | "VALIDATOR"

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null
}

/**
 * Service du module Négociation. Gère versions immuables, propositions/redlines,
 * commentaires ancrés, participants, accès invité et lecture (interne + invité).
 */
export class NegotiationService {
  // ─── Sessions ────────────────────────────────────────────────────────────

  /** Liste les négociations d'un contrat (par ID, couplage faible). */
  async listForContract(contractExternalId: string) {
    const rows = await prisma.negotiationSession.findMany({
      where: { contractExternalId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { versions: true, proposals: true, comments: true, participants: true } } },
    })
    return rows.map((s) => ({
      id: s.externalId,
      contractExternalId: s.contractExternalId,
      title: s.title,
      status: s.status,
      counts: {
        versions: s._count.versions,
        proposals: s._count.proposals,
        comments: s._count.comments,
        participants: s._count.participants,
      },
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }))
  }

  /** Détail complet d'une session (vue interne). */
  async get(externalId: string) {
    const s = await prisma.negotiationSession.findUnique({
      where: { externalId },
      include: {
        versions: { orderBy: { versionNumber: "asc" } },
        proposals: { orderBy: { createdAt: "asc" } },
        comments: { orderBy: { createdAt: "asc" } },
        participants: { orderBy: { createdAt: "asc" } },
        guestAccesses: { orderBy: { createdAt: "desc" } },
        auditLogs: { orderBy: { createdAt: "desc" }, take: 200 },
      },
    })
    if (!s) return null
    const userNames = await this.resolveUserNames(s.comments as any[])
    return this.toDetailDTO(s, { includeInternal: true, userNames })
  }

  /** Résout les noms d'affichage des auteurs internes (createdById → "Prénom Nom"). */
  private async resolveUserNames(comments: { createdById: number | null }[]): Promise<Map<number, string>> {
    const ids = Array.from(new Set(comments.map((c) => c.createdById).filter((x): x is number => x != null)))
    const map = new Map<number, string>()
    if (ids.length === 0) return map
    const users = await prisma.user.findMany({ where: { idUser: { in: ids } }, select: { idUser: true, nom: true, prenom: true, email: true } })
    for (const u of users) {
      map.set(u.idUser, [u.prenom, u.nom].filter(Boolean).join(" ") || u.email || `Utilisateur ${u.idUser}`)
    }
    return map
  }

  /** Mappe une session (avec relations) en DTO. `includeInternal` filtre la vue invité. */
  private toDetailDTO(s: any, opts: { includeInternal: boolean; userNames?: Map<number, string> }) {
    const participants = s.participants as any[]
    const partById = new Map<number, any>(participants.map((p) => [p.idParticipant, p]))
    const authorName = (c: any): string => {
      if (c.authorParticipantId && partById.get(c.authorParticipantId)) {
        const p = partById.get(c.authorParticipantId)
        return p.name || p.email || "Participant externe"
      }
      if (c.createdById && opts.userNames?.get(c.createdById)) return opts.userNames.get(c.createdById) as string
      if (c.createdById) return "Équipe interne"
      return "Anonyme"
    }
    const comments = (s.comments as any[])
      .filter((c) => opts.includeInternal || c.visibility === "EXTERNAL")
      .map((c) => ({
        id: c.externalId, clauseRef: c.clauseRef, body: c.body, visibility: c.visibility,
        parentCommentId: c.parentCommentId, createdById: c.createdById,
        authorParticipantId: c.authorParticipantId, authorName: authorName(c),
        anchorStart: c.anchorStart, anchorEnd: c.anchorEnd, quote: c.quote,
        proposedText: c.proposedText, resolved: c.resolved,
        createdAt: c.createdAt.toISOString(),
      }))
    return {
      id: s.externalId,
      contractExternalId: s.contractExternalId,
      title: s.title,
      status: s.status,
      ownerUserId: s.ownerUserId,
      finalVersionId: s.finalVersionId,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      versions: (s.versions as any[]).map((v) => ({
        id: v.externalId, versionNumber: v.versionNumber, label: v.label,
        contentText: v.contentText, createdById: v.createdById,
        isFinal: v.idVersion === s.finalVersionId, createdAt: v.createdAt.toISOString(),
      })),
      proposals: (s.proposals as any[]).map((p) => ({
        id: p.externalId, clauseRef: p.clauseRef, originalText: p.originalText,
        proposedText: p.proposedText, type: p.type, status: p.status,
        createdById: p.createdById, createdAt: p.createdAt.toISOString(),
      })),
      comments,
      participants: (s.participants as any[]).map((p) => ({
        id: p.externalId, side: p.side, role: p.role, userId: p.userId,
        name: p.name, email: p.email, createdAt: p.createdAt.toISOString(),
      })),
      guestAccesses: opts.includeInternal
        ? (s.guestAccesses as any[]).map((g) => ({
            id: g.externalId, token: g.token, participantId: g.participantId,
            expiresAt: iso(g.expiresAt), revokedAt: iso(g.revokedAt),
            active: !g.revokedAt && g.expiresAt > new Date(), createdAt: g.createdAt.toISOString(),
          }))
        : [],
      auditLogs: opts.includeInternal
        ? (s.auditLogs as any[]).map((a) => ({
            action: a.action, actorUserId: a.actorUserId, actorLabel: a.actorLabel,
            versionId: a.versionId, createdAt: a.createdAt.toISOString(),
          }))
        : [],
    }
  }

  private async findId(externalId: string): Promise<number | null> {
    const s = await prisma.negotiationSession.findUnique({ where: { externalId }, select: { idNegotiation: true } })
    return s?.idNegotiation ?? null
  }

  // ─── Versions immuables ──────────────────────────────────────────────────

  async createVersion(
    negotiationExternalId: string,
    data: { label?: string | null; contentText: string; structuredJson?: unknown; createdById: number },
  ) {
    const s = await prisma.negotiationSession.findUnique({
      where: { externalId: negotiationExternalId },
      include: { versions: { select: { versionNumber: true } } },
    })
    if (!s) return null
    const nextNumber = s.versions.reduce((m, v) => Math.max(m, v.versionNumber), 0) + 1
    const v = await prisma.negotiationVersion.create({
      data: {
        externalId: crypto.randomUUID(),
        versionNumber: nextNumber,
        label: data.label ?? null,
        contentText: data.contentText,
        structuredJson: (data.structuredJson ?? undefined) as object | undefined,
        createdById: data.createdById,
        negotiationId: s.idNegotiation,
      },
    })
    await recordAudit(s.idNegotiation, "VERSION_CREATED", { actorUserId: data.createdById, versionId: v.idVersion })
    safeEmit("version.created", { negotiationExternalId, versionExternalId: v.externalId, versionNumber: nextNumber })
    return { id: v.externalId, versionNumber: v.versionNumber }
  }

  /** Valide une version : la marque finale, passe la session en VALIDATED, émet l'événement de sortie. */
  async validateVersion(negotiationExternalId: string, versionExternalId: string, actorUserId: number) {
    const s = await prisma.negotiationSession.findUnique({ where: { externalId: negotiationExternalId } })
    if (!s) return null
    const v = await prisma.negotiationVersion.findFirst({
      where: { externalId: versionExternalId, negotiationId: s.idNegotiation },
    })
    if (!v) return null
    await prisma.negotiationSession.update({
      where: { idNegotiation: s.idNegotiation },
      data: { finalVersionId: v.idVersion },
    })
    await transition(negotiationExternalId, "VALIDATED", actorUserId)
    await recordAudit(s.idNegotiation, "VALIDATED", { actorUserId, versionId: v.idVersion })
    // Émet l'événement consommable par la signature (sans la connaître).
    const exit = await exitToSignature(negotiationExternalId)
    return { validatedVersionId: versionExternalId, exit }
  }

  // ─── Propositions / redlines ───────────────────────────────────────────────

  async addProposal(
    negotiationExternalId: string,
    data: { clauseRef: string; originalText?: string | null; proposedText: string; type?: string; createdById: number; authorParticipantId?: number | null },
  ) {
    const id = await this.findId(negotiationExternalId)
    if (id == null) return null
    const p = await prisma.clauseProposal.create({
      data: {
        externalId: crypto.randomUUID(),
        clauseRef: data.clauseRef,
        originalText: data.originalText ?? null,
        proposedText: data.proposedText,
        type: data.type === "COUNTER" ? "COUNTER" : "PROPOSED",
        authorParticipantId: data.authorParticipantId ?? null,
        createdById: data.createdById,
        negotiationId: id,
      },
    })
    await recordAudit(id, "PROPOSAL_CREATED", { actorUserId: data.createdById, payload: { clauseRef: data.clauseRef } })
    safeEmit("proposal.created", { negotiationExternalId, proposalExternalId: p.externalId, clauseRef: data.clauseRef })
    return { id: p.externalId }
  }

  async setProposalStatus(negotiationExternalId: string, proposalExternalId: string, status: ProposalStatusValue, actorUserId?: number | null) {
    const id = await this.findId(negotiationExternalId)
    if (id == null) return false
    const r = await prisma.clauseProposal.updateMany({
      where: { externalId: proposalExternalId, negotiationId: id },
      data: { status },
    })
    if (r.count === 0) return false
    await recordAudit(id, "PROPOSAL_STATUS_CHANGED", { actorUserId: actorUserId ?? null, payload: { proposalExternalId, status } })
    return true
  }

  // ─── Commentaires ancrés ────────────────────────────────────────────────────

  async addComment(
    negotiationExternalId: string,
    data: {
      clauseRef?: string | null; body: string; visibility?: CommentVisibilityValue;
      parentCommentId?: number | null; createdById?: number | null; authorParticipantId?: number | null;
      anchorStart?: number | null; anchorEnd?: number | null; quote?: string | null; proposedText?: string | null;
    },
  ) {
    const id = await this.findId(negotiationExternalId)
    if (id == null) return null
    const c = await prisma.negotiationComment.create({
      data: {
        externalId: crypto.randomUUID(),
        clauseRef: data.clauseRef ?? null,
        body: data.body.trim(),
        visibility: data.visibility === "EXTERNAL" ? "EXTERNAL" : "INTERNAL",
        parentCommentId: data.parentCommentId ?? null,
        createdById: data.createdById ?? null,
        authorParticipantId: data.authorParticipantId ?? null,
        anchorStart: data.anchorStart ?? null,
        anchorEnd: data.anchorEnd ?? null,
        quote: data.quote ?? null,
        proposedText: data.proposedText ?? null,
        negotiationId: id,
      },
    })
    await recordAudit(id, "COMMENT_ADDED", { actorUserId: data.createdById ?? null, payload: { clauseRef: data.clauseRef ?? null } })
    safeEmit("comment.added", { negotiationExternalId, commentExternalId: c.externalId, visibility: c.visibility })
    return { id: c.externalId }
  }

  /** Marque une annotation comme résolue / non résolue. */
  async resolveComment(negotiationExternalId: string, commentExternalId: string, resolved: boolean): Promise<boolean> {
    const id = await this.findId(negotiationExternalId)
    if (id == null) return false
    const r = await prisma.negotiationComment.updateMany({
      where: { externalId: commentExternalId, negotiationId: id }, data: { resolved },
    })
    return r.count > 0
  }

  // ─── Participants & permissions ──────────────────────────────────────────────

  async addParticipant(
    negotiationExternalId: string,
    data: { side: ParticipantSideValue; role: ParticipantRoleValue; userId?: number | null; name?: string | null; email?: string | null },
  ) {
    const id = await this.findId(negotiationExternalId)
    if (id == null) return null
    const p = await prisma.negotiationParticipant.create({
      data: {
        externalId: crypto.randomUUID(),
        side: data.side,
        role: data.role,
        userId: data.userId ?? null,
        name: data.name ?? null,
        email: data.email ?? null,
        negotiationId: id,
      },
    })
    await recordAudit(id, "PARTICIPANT_ADDED", { payload: { side: data.side, role: data.role, email: data.email ?? null } })
    return { id: p.externalId }
  }

  async removeParticipant(negotiationExternalId: string, participantExternalId: string) {
    const id = await this.findId(negotiationExternalId)
    if (id == null) return false
    const r = await prisma.negotiationParticipant.deleteMany({ where: { externalId: participantExternalId, negotiationId: id } })
    if (r.count === 0) return false
    await recordAudit(id, "PARTICIPANT_REMOVED", { payload: { participantExternalId } })
    return true
  }

  // ─── Partage externe sécurisé (lien invité à durée limitée) ──────────────────

  async inviteGuest(negotiationExternalId: string, data: { participantExternalId?: string | null; ttlHours?: number }) {
    const s = await prisma.negotiationSession.findUnique({ where: { externalId: negotiationExternalId }, select: { idNegotiation: true } })
    if (!s) return null
    let participantId: number | null = null
    if (data.participantExternalId) {
      const p = await prisma.negotiationParticipant.findFirst({
        where: { externalId: data.participantExternalId, negotiationId: s.idNegotiation }, select: { idParticipant: true },
      })
      participantId = p?.idParticipant ?? null
    }
    const ttl = Number.isFinite(data.ttlHours) && (data.ttlHours as number) > 0 ? (data.ttlHours as number) : 168 // 7 j par défaut
    const expiresAt = new Date(Date.now() + ttl * 3600 * 1000)
    const g = await prisma.guestAccess.create({
      data: {
        externalId: crypto.randomUUID(),
        token: crypto.randomBytes(32).toString("hex"),
        participantId,
        expiresAt,
        negotiationId: s.idNegotiation,
      },
    })
    await recordAudit(s.idNegotiation, "GUEST_INVITED", { payload: { expiresAt: expiresAt.toISOString() } })
    safeEmit("guest.invited", { negotiationExternalId, token: g.token, expiresAt: expiresAt.toISOString() })
    return { id: g.externalId, token: g.token, expiresAt: expiresAt.toISOString() }
  }

  async revokeGuest(negotiationExternalId: string, guestExternalId: string) {
    const id = await this.findId(negotiationExternalId)
    if (id == null) return false
    const r = await prisma.guestAccess.updateMany({
      where: { externalId: guestExternalId, negotiationId: id }, data: { revokedAt: new Date() },
    })
    if (r.count === 0) return false
    await recordAudit(id, "GUEST_REVOKED", { payload: { guestExternalId } })
    return true
  }

  /** Vue invité par token : valide le lien et renvoie une vue filtrée (externe). */
  async getByGuestToken(token: string) {
    const g = await prisma.guestAccess.findUnique({ where: { token } })
    if (!g || g.revokedAt || g.expiresAt <= new Date()) return null
    const s = await prisma.negotiationSession.findUnique({
      where: { idNegotiation: g.negotiationId },
      include: {
        versions: { orderBy: { versionNumber: "asc" } },
        proposals: { orderBy: { createdAt: "asc" } },
        comments: { orderBy: { createdAt: "asc" } },
        participants: { orderBy: { createdAt: "asc" } },
        guestAccesses: false as any,
        auditLogs: false as any,
      },
    })
    if (!s) return null
    const userNames = await this.resolveUserNames(s.comments as any[])
    const detail = this.toDetailDTO({ ...s, guestAccesses: [], auditLogs: [] }, { includeInternal: false, userNames })
    // Rôle/identité de l'invité → le front adapte les actions autorisées.
    let guest: { role: string; name: string | null; canComment: boolean } = { role: "READER", name: null, canComment: false }
    if (g.participantId) {
      const p = await prisma.negotiationParticipant.findUnique({ where: { idParticipant: g.participantId } })
      if (p) {
        const canComment = p.role === "COMMENTER" || p.role === "PROPOSER" || p.role === "VALIDATOR"
        guest = { role: p.role, name: p.name || p.email || null, canComment }
      }
    } else {
      // Lien sans participant nommé → droit de commenter par défaut.
      guest = { role: "COMMENTER", name: null, canComment: true }
    }
    return { ...detail, guest }
  }

  /** Ajout d'une annotation par un invité (toujours visible côté interne). Respecte le rôle. */
  async addGuestComment(token: string, data: { clauseRef?: string | null; body: string; anchorStart?: number | null; anchorEnd?: number | null; quote?: string | null; proposedText?: string | null }) {
    const g = await prisma.guestAccess.findUnique({ where: { token } })
    if (!g || g.revokedAt || g.expiresAt <= new Date()) return null
    // Garde-fou de rôle : un lecteur seul ne peut pas commenter.
    if (g.participantId) {
      const p = await prisma.negotiationParticipant.findUnique({ where: { idParticipant: g.participantId }, select: { role: true } })
      if (p && p.role === "READER") return { forbidden: true as const }
    }
    const c = await prisma.negotiationComment.create({
      data: {
        externalId: crypto.randomUUID(),
        clauseRef: data.clauseRef ?? null,
        body: data.body.trim(),
        visibility: "EXTERNAL",
        authorParticipantId: g.participantId,
        anchorStart: data.anchorStart ?? null,
        anchorEnd: data.anchorEnd ?? null,
        quote: data.quote ?? null,
        proposedText: data.proposedText ?? null,
        negotiationId: g.negotiationId,
      },
    })
    await recordAudit(g.negotiationId, "COMMENT_ADDED", { actorLabel: "Invité externe", payload: { clauseRef: data.clauseRef ?? null } })
    safeEmit("comment.added", { negotiationExternalId: "", commentExternalId: c.externalId, visibility: "EXTERNAL" })
    return { id: c.externalId }
  }
}
