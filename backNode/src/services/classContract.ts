import crypto from "crypto"
import { prisma } from "../../prisma/singletonPrisma"

/**
 * Service métier de la Contrathèque.
 *
 * Principe directeur : "l'IA suggère, le système garde-fou, l'humain décide".
 * - Les métadonnées validées vivent en COLONNES claires sur Contract (filtres/tri/KPI).
 * - Le détail IA (valeur suggérée + score + état de validation) vit dans
 *   ContractMetadataField (audit du "trust but verify").
 * - Le PDF est chiffré sur le filesystem (voir cryptoFile + apiContract).
 * - Toute action sensible est tracée dans AuditLog (RGPD).
 *
 * Voir contratheque/README.md pour l'architecture détaillée.
 */

export type ContractStatusValue =
    | "DRAFT" | "IN_NEGOTIATION" | "ACTIVE" | "TACIT_RENEWAL" | "EXPIRED" | "TERMINATED"

export type RenewalTypeValue = "NONE" | "TACIT" | "EXPRESS"

export type FieldValidationStatusValue = "AI_SUGGESTED" | "HUMAN_VALIDATED" | "HUMAN_CORRECTED"

export type AuditActionValue =
    | "IMPORT" | "AI_EXTRACTION" | "FIELD_VALIDATION" | "METADATA_UPDATE"
    | "AMENDMENT_ADDED" | "VERSION_ADDED" | "DOCUMENT_ACCESS" | "EXPORT" | "ARCHIVE" | "DELETE"

/** Un champ de métadonnée tel que renvoyé/persisté (état IA + validation). */
export interface MetadataFieldInput {
    fieldKey: string
    value: string | null
    confidenceScore?: number | null
    validationStatus?: FieldValidationStatusValue
}

/** Données d'écriture d'un contrat (après revue humaine). */
export interface ContractCreateInput {
    title: string
    contractType?: string | null
    counterpartyName?: string | null
    responsibleName?: string | null
    status?: ContractStatusValue
    signatureDate?: string | null
    effectiveDate?: string | null
    endDate?: string | null
    durationMonths?: number | null
    renewalType?: RenewalTypeValue
    noticePeriodDays?: number | null
    isB2C?: boolean
    amount?: number | null
    currency?: string | null
    governingLaw?: string | null
    documentFilePath?: string | null
    documentMimeType?: string | null
    ocrText?: string | null
    folderExternalId?: string | null
    signatureEnvelopeExternalId?: string | null
    templateExternalId?: string | null
    metadataFields?: MetadataFieldInput[]
    tagExternalIds?: string[]
}

export interface ContractListFilters {
    status?: ContractStatusValue
    contractType?: string
    counterpartyName?: string
    responsibleName?: string
    folderExternalId?: string
    tagExternalIds?: string[]
    isB2C?: boolean
    q?: string // recherche full-text (titre + ocrText)
    signedFrom?: string
    signedTo?: string
    endFrom?: string
    endTo?: string
    includeArchived?: boolean
    sortBy?: "title" | "signatureDate" | "endDate" | "status" | "createdAt" | "amount"
    sortDir?: "asc" | "desc"
    page?: number
    pageSize?: number
}

/** DTO résumé pour la liste. */
export interface ContractListItemDTO {
    id: string
    title: string
    contractType: string | null
    counterpartyName: string | null
    responsibleName: string | null
    status: ContractStatusValue
    signatureDate: string | null
    endDate: string | null
    isB2C: boolean
    renewalType: RenewalTypeValue
    amount: string | null
    currency: string | null
    folderExternalId: string | null
    tags: Array<{ externalId: string; label: string; color: string }>
    createdAt: string
    updatedAt: string
}

/** KPIs du bandeau. */
export interface ContractStats {
    total: number
    expiringIn90Days: number
    tacitRenewal: number
    withoutEndDate: number
}

function iso(d: Date | null): string | null { return d ? d.toISOString() : null }

/**
 * Convertit une valeur en Date, en tolérant les entrées invalides venant de
 * l'extraction IA (formats non ISO, texte parasite). Retourne `null` plutôt
 * qu'une "Invalid Date" — qui ferait planter Prisma.
 */
function toDate(s?: string | number | null): Date | null {
    if (s === null || s === undefined || s === "") return null
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
}

/** Convertit en entier en ignorant le texte parasite ("60 jours" → 60). Null si rien d'exploitable. */
function toNum(v: unknown): number | null {
    if (v === null || v === undefined || v === "") return null
    if (typeof v === "number") return Number.isFinite(v) ? v : null
    const cleaned = String(v).replace(/[^\d.,-]/g, "").replace(",", ".")
    const n = parseFloat(cleaned)
    return Number.isFinite(n) ? n : null
}
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function addMonths(d: Date, n: number): Date { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }

/** Type d'échéance calculée à partir d'un contrat. */
export type DeadlineType = "END_DATE" | "NOTICE_DEADLINE" | "CHATEL_INFO"

export interface DeadlineEvent {
    contractId: string
    contractTitle: string
    counterpartyName: string | null
    status: ContractStatusValue
    isB2C: boolean
    renewalType: RenewalTypeValue
    noticePeriodDays: number | null
    type: DeadlineType
    /** Date de l'échéance (ISO). */
    date: string
}

export class ContractService {
    // ─── Statistiques (KPI) ──────────────────────────────────────────────────
    async stats(userId: number): Promise<ContractStats> {
        const in90 = new Date()
        in90.setDate(in90.getDate() + 90)
        const now = new Date()

        const [total, expiringIn90Days, tacitRenewal, withoutEndDate] = await Promise.all([
            prisma.contract.count({ where: { userId, isArchived: false } }),
            prisma.contract.count({
                where: { userId, isArchived: false, endDate: { gte: now, lte: in90 } },
            }),
            prisma.contract.count({
                where: { userId, isArchived: false, renewalType: "TACIT" },
            }),
            prisma.contract.count({
                where: { userId, isArchived: false, endDate: null },
            }),
        ])
        return { total, expiringIn90Days, tacitRenewal, withoutEndDate }
    }

    // ─── Échéances (alertes de renouvellement + suivi + calendrier) ──────────
    /**
     * Calcule les échéances à venir à partir des contrats (pas de table dédiée).
     * Pour chaque contrat actif daté, on génère jusqu'à 3 événements :
     *  - END_DATE        : date d'échéance du contrat.
     *  - NOTICE_DEADLINE : dernière date pour dénoncer avant tacite reconduction
     *                      (= échéance − préavis), uniquement si renouvellement TACIT.
     *  - CHATEL_INFO     : pour les contrats B2C en tacite reconduction, dernière
     *                      date d'information du consommateur (loi Chatel,
     *                      = date de dénonciation − 1 mois).
     *
     * @param horizonDays fenêtre vers le futur (défaut 365). Les échéances déjà
     *        dépassées des 90 derniers jours sont incluses (alertes en retard).
     */
    async deadlines(userId: number, horizonDays = 365): Promise<DeadlineEvent[]> {
        const now = new Date()
        const from = addDays(now, -90)
        const to = addDays(now, horizonDays)

        const rows = await prisma.contract.findMany({
            where: {
                userId,
                isArchived: false,
                status: { notIn: ["TERMINATED"] },
                endDate: { not: null },
            },
            select: {
                externalId: true, title: true, counterpartyName: true, status: true,
                isB2C: true, renewalType: true, noticePeriodDays: true, endDate: true,
            },
        })

        const events: DeadlineEvent[] = []
        const within = (d: Date) => d >= from && d <= to
        const base = (r: typeof rows[number]) => ({
            contractId: r.externalId,
            contractTitle: r.title,
            counterpartyName: r.counterpartyName,
            status: r.status as ContractStatusValue,
            isB2C: r.isB2C,
            renewalType: r.renewalType as RenewalTypeValue,
            noticePeriodDays: r.noticePeriodDays,
        })

        for (const r of rows) {
            const end = r.endDate as Date
            if (within(end)) events.push({ ...base(r), type: "END_DATE", date: end.toISOString() })

            // Date limite de dénonciation (tacite reconduction)
            if (r.renewalType === "TACIT" && r.noticePeriodDays && r.noticePeriodDays > 0) {
                const noticeDeadline = addDays(end, -r.noticePeriodDays)
                if (within(noticeDeadline)) {
                    events.push({ ...base(r), type: "NOTICE_DEADLINE", date: noticeDeadline.toISOString() })
                }
                // Loi Chatel (B2C) : information du consommateur au plus tard 1 mois avant
                if (r.isB2C) {
                    const chatel = addMonths(noticeDeadline, -1)
                    if (within(chatel)) {
                        events.push({ ...base(r), type: "CHATEL_INFO", date: chatel.toISOString() })
                    }
                }
            }
        }

        events.sort((a, b) => a.date.localeCompare(b.date))
        return events
    }

    // ─── Liste filtrée / triée / paginée ─────────────────────────────────────
    async list(userId: number, f: ContractListFilters): Promise<{ items: ContractListItemDTO[]; total: number }> {
        const page = Math.max(1, f.page ?? 1)
        const pageSize = Math.min(200, Math.max(1, f.pageSize ?? 25))

        const folder = f.folderExternalId
            ? await prisma.folder.findFirst({ where: { userId, externalId: f.folderExternalId } })
            : null

        const where: Record<string, unknown> = {
            userId,
            ...(f.includeArchived ? {} : { isArchived: false }),
            ...(f.status ? { status: f.status } : {}),
            ...(f.contractType ? { contractType: { contains: f.contractType } } : {}),
            ...(f.counterpartyName ? { counterpartyName: { contains: f.counterpartyName } } : {}),
            ...(f.responsibleName ? { responsibleName: { contains: f.responsibleName } } : {}),
            ...(typeof f.isB2C === "boolean" ? { isB2C: f.isB2C } : {}),
            ...(folder ? { folderId: folder.idFolder } : {}),
            ...(f.q ? { OR: [{ title: { contains: f.q } }, { ocrText: { contains: f.q } }] } : {}),
            ...(f.signedFrom || f.signedTo
                ? { signatureDate: { ...(f.signedFrom ? { gte: new Date(f.signedFrom) } : {}), ...(f.signedTo ? { lte: new Date(f.signedTo) } : {}) } }
                : {}),
            ...(f.endFrom || f.endTo
                ? { endDate: { ...(f.endFrom ? { gte: new Date(f.endFrom) } : {}), ...(f.endTo ? { lte: new Date(f.endTo) } : {}) } }
                : {}),
        }

        // Filtre par tags (via relation)
        if (f.tagExternalIds?.length) {
            where["tags"] = { some: { tag: { userId, externalId: { in: f.tagExternalIds } } } }
        }

        const sortBy = f.sortBy ?? "updatedAt" as const
        const orderBy = { [sortBy === "updatedAt" ? "updatedAt" : sortBy]: f.sortDir ?? "desc" }

        const [rows, total] = await Promise.all([
            prisma.contract.findMany({
                where,
                orderBy,
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: { tags: { include: { tag: true } }, folder: true },
            }),
            prisma.contract.count({ where }),
        ])

        const items: ContractListItemDTO[] = rows.map((c) => ({
            id: c.externalId,
            title: c.title,
            contractType: c.contractType,
            counterpartyName: c.counterpartyName,
            responsibleName: c.responsibleName,
            status: c.status as ContractStatusValue,
            signatureDate: iso(c.signatureDate),
            endDate: iso(c.endDate),
            isB2C: c.isB2C,
            renewalType: c.renewalType as RenewalTypeValue,
            amount: c.amount ? c.amount.toString() : null,
            currency: c.currency,
            folderExternalId: c.folder?.externalId ?? null,
            tags: c.tags.map((t) => ({ externalId: t.tag.externalId, label: t.tag.label, color: t.tag.color })),
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
        }))
        return { items, total }
    }

    // ─── Détail complet d'un contrat ─────────────────────────────────────────
    async get(userId: number, externalId: string) {
        const c = await prisma.contract.findFirst({
            where: { userId, externalId },
            include: {
                metadataFields: true,
                amendments: { orderBy: { createdAt: "asc" } },
                versions: { orderBy: { versionNumber: "asc" } },
                tags: { include: { tag: true } },
                folder: true,
                auditLogs: {
                    orderBy: { createdAt: "desc" },
                    take: 100,
                    include: { user: { select: { nom: true, prenom: true, email: true } } },
                },
                comments: {
                    orderBy: { createdAt: "asc" },
                    include: { user: { select: { nom: true, prenom: true, email: true } } },
                },
            },
        })
        if (!c) return null
        return {
            id: c.externalId,
            title: c.title,
            contractType: c.contractType,
            counterpartyName: c.counterpartyName,
            responsibleName: c.responsibleName,
            status: c.status,
            approvalStatus: c.approvalStatus,
            approvalNote: c.approvalNote,
            approvedById: c.approvedById,
            approvedAt: iso(c.approvedAt),
            signatureDate: iso(c.signatureDate),
            effectiveDate: iso(c.effectiveDate),
            endDate: iso(c.endDate),
            durationMonths: c.durationMonths,
            renewalType: c.renewalType,
            noticePeriodDays: c.noticePeriodDays,
            isB2C: c.isB2C,
            amount: c.amount ? c.amount.toString() : null,
            currency: c.currency,
            governingLaw: c.governingLaw,
            hasDocument: !!c.documentFilePath,
            ocrText: c.ocrText,
            isArchived: c.isArchived,
            retentionUntil: iso(c.retentionUntil),
            folderExternalId: c.folder?.externalId ?? null,
            tags: c.tags.map((t) => ({ externalId: t.tag.externalId, label: t.tag.label, color: t.tag.color })),
            metadataFields: c.metadataFields.map((m) => ({
                fieldKey: m.fieldKey,
                value: m.value,
                confidenceScore: m.confidenceScore,
                validationStatus: m.validationStatus,
                validatedById: m.validatedById,
                validatedAt: iso(m.validatedAt),
            })),
            amendments: c.amendments.map((a) => ({
                id: a.externalId, title: a.title, summary: a.summary,
                signatureDate: iso(a.signatureDate), effectiveDate: iso(a.effectiveDate),
                hasDocument: !!a.documentFilePath, createdAt: a.createdAt.toISOString(),
            })),
            versions: c.versions.map((v) => ({
                versionNumber: v.versionNumber, note: v.note,
                hasDocument: !!v.documentFilePath, createdAt: v.createdAt.toISOString(),
                contentText: v.contentText ?? null,
            })),
            auditLogs: c.auditLogs.map((l) => ({
                action: l.action, entityType: l.entityType, entityId: l.entityId,
                createdAt: l.createdAt.toISOString(), userId: l.userId,
                userName: [l.user?.prenom, l.user?.nom].filter(Boolean).join(" ") || l.user?.email || null,
            })),
            comments: c.comments.map((cm) => ({
                id: cm.externalId,
                body: cm.body,
                resolved: cm.resolved,
                userId: cm.userId,
                userName: [cm.user?.prenom, cm.user?.nom].filter(Boolean).join(" ") || cm.user?.email || null,
                createdAt: cm.createdAt.toISOString(),
            })),
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
        }
    }

    /** Chemin du PDF chiffré (pour streaming/déchiffrement par la route). */
    async getDocumentPath(userId: number, externalId: string): Promise<string | null> {
        const c = await prisma.contract.findFirst({ where: { userId, externalId }, select: { documentFilePath: true } })
        return c?.documentFilePath ?? null
    }

    // ─── Création (après revue humaine) ──────────────────────────────────────
    async create(userId: number, data: ContractCreateInput): Promise<{ id: string }> {
        const folder = data.folderExternalId
            ? await prisma.folder.findFirst({ where: { userId, externalId: data.folderExternalId } })
            : null

        const externalId = crypto.randomUUID()
        const contract = await prisma.contract.create({
            data: {
                externalId,
                title: data.title,
                contractType: data.contractType ?? null,
                counterpartyName: data.counterpartyName ?? null,
                responsibleName: data.responsibleName ?? null,
                status: data.status ?? "DRAFT",
                signatureDate: toDate(data.signatureDate),
                effectiveDate: toDate(data.effectiveDate),
                endDate: toDate(data.endDate),
                durationMonths: toNum(data.durationMonths),
                renewalType: data.renewalType ?? "NONE",
                noticePeriodDays: toNum(data.noticePeriodDays),
                isB2C: data.isB2C ?? false,
                amount: toNum(data.amount),
                currency: data.currency ?? "EUR",
                governingLaw: data.governingLaw ?? null,
                documentFilePath: data.documentFilePath ?? null,
                documentMimeType: data.documentMimeType ?? null,
                ocrText: data.ocrText ?? null,
                signatureEnvelopeExternalId: data.signatureEnvelopeExternalId ?? null,
                templateExternalId: data.templateExternalId ?? null,
                userId,
                folderId: folder?.idFolder ?? null,
                metadataFields: data.metadataFields?.length
                    ? {
                        create: data.metadataFields.map((m) => ({
                            fieldKey: m.fieldKey,
                            value: m.value,
                            confidenceScore: m.confidenceScore ?? null,
                            validationStatus: m.validationStatus ?? "AI_SUGGESTED",
                            validatedById: m.validationStatus && m.validationStatus !== "AI_SUGGESTED" ? userId : null,
                            validatedAt: m.validationStatus && m.validationStatus !== "AI_SUGGESTED" ? new Date() : null,
                        })),
                    }
                    : undefined,
            },
        })

        if (data.tagExternalIds?.length) {
            await this.setTags(userId, externalId, data.tagExternalIds)
        }

        await this.audit(userId, "IMPORT", "Contract", externalId, contract.idContract, null, { title: data.title })
        return { id: externalId }
    }

    // ─── Mise à jour des colonnes métadonnées ────────────────────────────────
    async update(userId: number, externalId: string, patch: Partial<ContractCreateInput>): Promise<boolean> {
        const existing = await prisma.contract.findFirst({ where: { userId, externalId } })
        if (!existing) return false

        const folder = patch.folderExternalId
            ? await prisma.folder.findFirst({ where: { userId, externalId: patch.folderExternalId } })
            : undefined

        await prisma.contract.update({
            where: { idContract: existing.idContract },
            data: {
                ...(patch.title !== undefined ? { title: patch.title } : {}),
                ...(patch.contractType !== undefined ? { contractType: patch.contractType } : {}),
                ...(patch.counterpartyName !== undefined ? { counterpartyName: patch.counterpartyName } : {}),
                ...(patch.responsibleName !== undefined ? { responsibleName: patch.responsibleName } : {}),
                ...(patch.status !== undefined ? { status: patch.status } : {}),
                ...(patch.signatureDate !== undefined ? { signatureDate: toDate(patch.signatureDate) } : {}),
                ...(patch.effectiveDate !== undefined ? { effectiveDate: toDate(patch.effectiveDate) } : {}),
                ...(patch.endDate !== undefined ? { endDate: toDate(patch.endDate) } : {}),
                ...(patch.durationMonths !== undefined ? { durationMonths: toNum(patch.durationMonths) } : {}),
                ...(patch.renewalType !== undefined ? { renewalType: patch.renewalType } : {}),
                ...(patch.noticePeriodDays !== undefined ? { noticePeriodDays: toNum(patch.noticePeriodDays) } : {}),
                ...(patch.isB2C !== undefined ? { isB2C: patch.isB2C } : {}),
                ...(patch.amount !== undefined ? { amount: toNum(patch.amount) } : {}),
                ...(patch.currency !== undefined ? { currency: patch.currency } : {}),
                ...(patch.governingLaw !== undefined ? { governingLaw: patch.governingLaw } : {}),
                ...(folder !== undefined ? { folderId: folder?.idFolder ?? null } : {}),
            },
        })

        if (patch.tagExternalIds) await this.setTags(userId, externalId, patch.tagExternalIds)

        await this.audit(userId, "METADATA_UPDATE", "Contract", externalId, existing.idContract,
            { title: existing.title, status: existing.status }, patch)
        return true
    }

    /**
     * Valide/corrige un champ extrait par IA (cœur du "trust but verify").
     * Met à jour ContractMetadataField + reflète la valeur dans la colonne Contract
     * correspondante quand un mapping existe.
     */
    async validateField(userId: number, externalId: string, fieldKey: string, value: string | null, status: FieldValidationStatusValue): Promise<boolean> {
        const contract = await prisma.contract.findFirst({ where: { userId, externalId } })
        if (!contract) return false

        await prisma.contractMetadataField.upsert({
            where: { contractId_fieldKey: { contractId: contract.idContract, fieldKey } },
            update: { value, validationStatus: status, validatedById: userId, validatedAt: new Date() },
            create: { contractId: contract.idContract, fieldKey, value, validationStatus: status, validatedById: userId, validatedAt: new Date() },
        })

        // Reflète la valeur validée dans la colonne structurée si mapping connu
        const col = mapFieldKeyToColumn(fieldKey, value)
        if (col) {
            await prisma.contract.update({ where: { idContract: contract.idContract }, data: col })
        }

        await this.audit(userId, "FIELD_VALIDATION", "ContractMetadataField", `${externalId}:${fieldKey}`, contract.idContract,
            null, { fieldKey, value, status })
        return true
    }

    // ─── Avenants / versions ─────────────────────────────────────────────────
    async addAmendment(userId: number, externalId: string, data: { title: string; summary?: string; signatureDate?: string | null; effectiveDate?: string | null; documentFilePath?: string | null }): Promise<{ id: string } | null> {
        const contract = await prisma.contract.findFirst({ where: { userId, externalId } })
        if (!contract) return null
        const amendmentExternalId = crypto.randomUUID()
        await prisma.amendment.create({
            data: {
                externalId: amendmentExternalId, title: data.title, summary: data.summary ?? null,
                signatureDate: toDate(data.signatureDate), effectiveDate: toDate(data.effectiveDate),
                documentFilePath: data.documentFilePath ?? null, parentContractId: contract.idContract,
            },
        })
        await this.audit(userId, "AMENDMENT_ADDED", "Amendment", amendmentExternalId, contract.idContract, null, { title: data.title })
        return { id: amendmentExternalId }
    }

    async addVersion(userId: number, externalId: string, data: { note?: string; documentFilePath?: string | null }): Promise<boolean> {
        const contract = await prisma.contract.findFirst({ where: { userId, externalId }, include: { versions: true } })
        if (!contract) return false
        const nextNumber = (contract.versions.reduce((max, v) => Math.max(max, v.versionNumber), 0)) + 1
        await prisma.contractVersion.create({
            data: { versionNumber: nextNumber, note: data.note ?? null, documentFilePath: data.documentFilePath ?? null, createdById: userId, contractId: contract.idContract },
        })
        await this.audit(userId, "VERSION_ADDED", "Contract", externalId, contract.idContract, null, { versionNumber: nextNumber })
        return true
    }

    /**
     * Enregistre un instantané du texte courant du contrat comme nouvelle version,
     * permettant ensuite la comparaison (diff) entre versions.
     * `contentText` est fourni par l'appelant (texte courant édité) ; à défaut on
     * capture l'ocrText stocké.
     */
    async addSnapshot(userId: number, externalId: string, note: string | null, contentText: string | null): Promise<boolean> {
        const contract = await prisma.contract.findFirst({ where: { userId, externalId }, include: { versions: true } })
        if (!contract) return false
        const text = (contentText ?? contract.ocrText) ?? ""
        const nextNumber = (contract.versions.reduce((max, v) => Math.max(max, v.versionNumber), 0)) + 1
        await prisma.contractVersion.create({
            data: { versionNumber: nextNumber, note: note ?? null, contentText: text, createdById: userId, contractId: contract.idContract },
        })
        await this.audit(userId, "VERSION_ADDED", "Contract", externalId, contract.idContract, null, { versionNumber: nextNumber, snapshot: true })
        return true
    }

    // ─── Archivage / suppression ─────────────────────────────────────────────
    async archive(userId: number, externalId: string, archived: boolean): Promise<boolean> {
        const contract = await prisma.contract.findFirst({ where: { userId, externalId } })
        if (!contract) return false
        await prisma.contract.update({ where: { idContract: contract.idContract }, data: { isArchived: archived } })
        await this.audit(userId, "ARCHIVE", "Contract", externalId, contract.idContract, { isArchived: contract.isArchived }, { isArchived: archived })
        return true
    }

    async delete(userId: number, externalId: string): Promise<boolean> {
        const contract = await prisma.contract.findFirst({ where: { userId, externalId } })
        if (!contract) return false
        // Trace AVANT suppression (cascade efface les auditLogs liés)
        await this.audit(userId, "DELETE", "Contract", externalId, null, { title: contract.title }, null)
        await prisma.contract.delete({ where: { idContract: contract.idContract } })
        return true
    }

    // ─── Tags ────────────────────────────────────────────────────────────────
    async listTags(userId: number) {
        const tags = await prisma.tag.findMany({ where: { userId }, orderBy: { label: "asc" } })
        return tags.map((t) => ({ id: t.externalId, label: t.label, color: t.color }))
    }

    async createTag(userId: number, label: string, color: string): Promise<{ id: string }> {
        const externalId = crypto.randomUUID()
        await prisma.tag.create({ data: { externalId, label, color, userId } })
        return { id: externalId }
    }

    async deleteTag(userId: number, externalId: string): Promise<boolean> {
        const r = await prisma.tag.deleteMany({ where: { userId, externalId } })
        return r.count > 0
    }

    /** Remplace l'ensemble des tags d'un contrat. */
    async setTags(userId: number, contractExternalId: string, tagExternalIds: string[]): Promise<boolean> {
        const contract = await prisma.contract.findFirst({ where: { userId, externalId: contractExternalId } })
        if (!contract) return false
        const tags = await prisma.tag.findMany({ where: { userId, externalId: { in: tagExternalIds } } })
        await prisma.contractTag.deleteMany({ where: { contractId: contract.idContract } })
        if (tags.length) {
            await prisma.contractTag.createMany({ data: tags.map((t) => ({ contractId: contract.idContract, tagId: t.idTag })) })
        }
        return true
    }

    // ─── Dossiers (arborescence) ─────────────────────────────────────────────
    async listFolders(userId: number) {
        const folders = await prisma.folder.findMany({ where: { userId }, orderBy: { name: "asc" } })
        return folders.map((f) => ({ id: f.externalId, name: f.name, parentId: null as string | null, _parentDbId: f.parentId, _dbId: f.idFolder }))
            .map((f, _i, all) => ({
                id: f.id, name: f.name,
                parentExternalId: f._parentDbId ? (all.find((x) => x._dbId === f._parentDbId)?.id ?? null) : null,
            }))
    }

    async createFolder(userId: number, name: string, parentExternalId?: string | null): Promise<{ id: string }> {
        const parent = parentExternalId
            ? await prisma.folder.findFirst({ where: { userId, externalId: parentExternalId } })
            : null
        const externalId = crypto.randomUUID()
        await prisma.folder.create({ data: { externalId, name, userId, parentId: parent?.idFolder ?? null } })
        return { id: externalId }
    }

    async deleteFolder(userId: number, externalId: string): Promise<boolean> {
        const folder = await prisma.folder.findFirst({ where: { userId, externalId } })
        if (!folder) return false
        // Détache enfants + contrats (self-relation NoAction / SetNull)
        await prisma.folder.updateMany({ where: { userId, parentId: folder.idFolder }, data: { parentId: null } })
        await prisma.contract.updateMany({ where: { userId, folderId: folder.idFolder }, data: { folderId: null } })
        await prisma.folder.delete({ where: { idFolder: folder.idFolder } })
        return true
    }

    // ─── Négociation : commentaires collaboratifs ──────────────────────────────

    /** Ajoute un commentaire au fil de négociation d'un contrat. */
    async addComment(userId: number, externalId: string, body: string) {
        const contract = await prisma.contract.findFirst({ where: { userId, externalId }, select: { idContract: true } })
        if (!contract) return null
        const c = await prisma.contractComment.create({
            data: {
                externalId: crypto.randomUUID(),
                body: body.trim(),
                contractId: contract.idContract,
                userId,
            },
            include: { user: { select: { nom: true, prenom: true, email: true } } },
        })
        return {
            id: c.externalId,
            body: c.body,
            resolved: c.resolved,
            userId: c.userId,
            userName: [c.user?.prenom, c.user?.nom].filter(Boolean).join(" ") || c.user?.email || null,
            createdAt: c.createdAt.toISOString(),
        }
    }

    /** Marque un commentaire comme traité / non traité. */
    async resolveComment(userId: number, commentExternalId: string, resolved: boolean): Promise<boolean> {
        // L'utilisateur doit posséder le contrat parent.
        const comment = await prisma.contractComment.findFirst({
            where: { externalId: commentExternalId, contract: { userId } },
            select: { idComment: true },
        })
        if (!comment) return false
        await prisma.contractComment.update({ where: { idComment: comment.idComment }, data: { resolved } })
        return true
    }

    /** Supprime un commentaire. */
    async deleteComment(userId: number, commentExternalId: string): Promise<boolean> {
        const r = await prisma.contractComment.deleteMany({
            where: { externalId: commentExternalId, contract: { userId } },
        })
        return r.count > 0
    }

    // ─── Négociation : workflow d'approbation ──────────────────────────────────

    /** Change le statut d'approbation d'un contrat (DRAFT/PENDING/APPROVED/REJECTED). */
    async setApproval(
        userId: number,
        externalId: string,
        status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED",
        note: string | null,
    ): Promise<boolean> {
        const contract = await prisma.contract.findFirst({ where: { userId, externalId }, select: { idContract: true } })
        if (!contract) return false
        const decided = status === "APPROVED" || status === "REJECTED"
        await prisma.contract.update({
            where: { idContract: contract.idContract },
            data: {
                approvalStatus: status,
                approvalNote: note,
                approvedById: decided ? userId : null,
                approvedAt: decided ? new Date() : null,
            },
        })
        return true
    }

    // ─── Audit ───────────────────────────────────────────────────────────────
    async listAudit(userId: number, externalId: string) {
        const contract = await prisma.contract.findFirst({ where: { userId, externalId }, select: { idContract: true } })
        if (!contract) return []
        const logs = await prisma.auditLog.findMany({ where: { contractId: contract.idContract }, orderBy: { createdAt: "desc" }, take: 200 })
        return logs.map((l) => ({ action: l.action, entityType: l.entityType, entityId: l.entityId, userId: l.userId, createdAt: l.createdAt.toISOString() }))
    }

    /** Insère une entrée d'audit (best-effort, ne casse pas l'opération métier). */
    async audit(userId: number, action: AuditActionValue, entityType: string, entityId: string, contractId: number | null, before: unknown, after: unknown): Promise<void> {
        try {
            await prisma.auditLog.create({
                data: {
                    action, entityType, entityId, userId,
                    contractId: contractId ?? undefined,
                    payloadBefore: before === null ? undefined : (before as object),
                    payloadAfter: after === null ? undefined : (after as object),
                },
            })
        } catch (e) {
            console.error("[contract] audit log failed:", e)
        }
    }

    // ─── Export CSV ──────────────────────────────────────────────────────────
    async exportCsv(userId: number, f: ContractListFilters): Promise<string> {
        const { items } = await this.list(userId, { ...f, page: 1, pageSize: 5000 })
        const header = ["Intitulé", "Type", "Cocontractant", "Responsable", "Statut", "Date signature", "Date échéance", "B2C", "Renouvellement", "Montant", "Devise", "Tags"]
        const rows = items.map((c) => [
            c.title, c.contractType ?? "", c.counterpartyName ?? "", c.responsibleName ?? "", c.status,
            c.signatureDate?.slice(0, 10) ?? "", c.endDate?.slice(0, 10) ?? "", c.isB2C ? "oui" : "non",
            c.renewalType, c.amount ?? "", c.currency ?? "", c.tags.map((t) => t.label).join(" | "),
        ])
        const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`
        return [header, ...rows].map((r) => r.map(escape).join(";")).join("\r\n")
    }
}

/**
 * Mappe une clé de champ IA vers la colonne structurée Contract correspondante,
 * en convertissant le type. Retourne `null` si le champ n'a pas de colonne dédiée
 * (ex: sensitive_clauses — reste uniquement dans ContractMetadataField).
 */
function mapFieldKeyToColumn(fieldKey: string, value: string | null): Record<string, unknown> | null {
    const v = value?.trim() || null
    switch (fieldKey) {
        case "contract_type": return { contractType: v }
        case "counterparty_name": return { counterpartyName: v }
        case "signature_date": return { signatureDate: toDate(v) }
        case "effective_date": return { effectiveDate: toDate(v) }
        case "end_date": return { endDate: toDate(v) }
        case "duration_months": return { durationMonths: toNum(v) }
        case "notice_period_days": return { noticePeriodDays: toNum(v) }
        case "amount": return { amount: toNum(v) }
        case "currency": return { currency: v }
        case "governing_law": return { governingLaw: v }
        case "is_b2c": return { isB2C: v === "true" || v === "oui" }
        case "renewal_type": {
            const map: Record<string, RenewalTypeValue> = { tacit: "TACIT", tacite: "TACIT", express: "EXPRESS", expresse: "EXPRESS", none: "NONE" }
            return { renewalType: map[(v ?? "").toLowerCase()] ?? "NONE" }
        }
        default: return null
    }
}
