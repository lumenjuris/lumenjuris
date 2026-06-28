import crypto from "crypto"
import { prisma } from "../../prisma/singletonPrisma.js"
import { encryptJson, decryptJson } from "./classContractTemplate.js"

/**
 * Statuts possibles d'une enveloppe de signature (miroir du enum Prisma).
 */
export type EnvelopeStatusValue =
    | "DRAFT"
    | "SENT"
    | "PARTIALLY_SIGNED"
    | "SIGNED"
    | "DECLINED"
    | "EXPIRED"

/**
 * Données des champs (positions, signatures capturées) stockées chiffrées
 * dans `encryptedFields`. La structure reflète l'état du wizard frontend.
 */
export interface EnvelopeFieldsPayload {
    fields: Array<Record<string, unknown>>
    // Réservé pour un futur usage (ex. signatures capturées séparées des champs)
    extra?: Record<string, unknown>
}

/** DTO exposé à l'API (sans la charge chiffrée des champs). */
export interface SignatureEnvelopeDTO {
    id: string
    signingToken: string
    documentName: string
    numPages: number
    status: EnvelopeStatusValue
    selfName: string
    selfEmail: string
    counterpartyName: string
    counterpartyEmail: string
    sentAt: string | null
    selfSignedAt: string | null
    counterpartySignedAt: string | null
    completedAt: string | null
    createdAt: string
    updatedAt: string
}

/** Agrégats pour le tableau de bord. */
export interface SignatureDashboardStats {
    total: number
    draft: number
    sent: number
    partiallySigned: number
    signed: number
    other: number
    recent: SignatureEnvelopeDTO[]
}

/**
 * Convertit une ligne Prisma en DTO sérialisable (dates en ISO).
 */
function toDTO(row: {
    externalId: string
    signingToken: string
    documentName: string
    numPages: number
    status: EnvelopeStatusValue
    selfName: string
    selfEmail: string
    counterpartyName: string
    counterpartyEmail: string
    sentAt: Date | null
    selfSignedAt: Date | null
    counterpartySignedAt: Date | null
    completedAt: Date | null
    createdAt: Date
    updatedAt: Date
}): SignatureEnvelopeDTO {
    return {
        id: row.externalId,
        signingToken: row.signingToken,
        documentName: row.documentName,
        numPages: row.numPages,
        status: row.status,
        selfName: row.selfName,
        selfEmail: row.selfEmail,
        counterpartyName: row.counterpartyName,
        counterpartyEmail: row.counterpartyEmail,
        sentAt: row.sentAt?.toISOString() ?? null,
        selfSignedAt: row.selfSignedAt?.toISOString() ?? null,
        counterpartySignedAt: row.counterpartySignedAt?.toISOString() ?? null,
        completedAt: row.completedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    }
}

/**
 * Service métier des enveloppes de signature :
 *   - création d'une enveloppe au moment du "Envoyer au cocontractant"
 *   - lecture (liste filtrée par statut + détail)
 *   - statistiques agrégées pour le dashboard
 *   - suppression
 *
 * Les champs (positions, signatures dataUrl) sont chiffrés AES-256-GCM via
 * les utilitaires partagés `encryptJson` / `decryptJson` du module template.
 * Le fichier PDF lui-même est stocké sur le filesystem par la route (voir
 * `apiSignature.ts`), seul son chemin est référencé ici.
 */
export class SignatureEnvelopeService {
    /**
     * Liste les enveloppes de l'utilisateur, optionnellement filtrées par statut.
     * Triées par date de mise à jour (plus récent d'abord).
     */
    async list(userId: number, status?: EnvelopeStatusValue): Promise<SignatureEnvelopeDTO[]> {
        const rows = await prisma.signatureEnvelope.findMany({
            where: { userId, ...(status ? { status } : {}) },
            orderBy: { updatedAt: "desc" },
            take: 100,
        })
        return rows.map(toDTO)
    }

    /**
     * Détail d'une enveloppe, incluant la charge déchiffrée des champs.
     */
    async get(userId: number, externalId: string): Promise<{
        meta: SignatureEnvelopeDTO
        fields: EnvelopeFieldsPayload
        documentFilePath: string | null
    } | null> {
        const row = await prisma.signatureEnvelope.findFirst({ where: { userId, externalId } })
        if (!row) return null
        const fields = decryptJson<EnvelopeFieldsPayload>(row.encryptedFields)
        return { meta: toDTO(row), fields, documentFilePath: row.documentFilePath }
    }

    /**
     * Crée une nouvelle enveloppe.
     * Statut initial : `SENT` (l'utilisateur a explicitement cliqué "Envoyer").
     * Si tous ses propres champs sont signés, `selfSignedAt` est positionné.
     */
    async create(userId: number, data: {
        documentName: string
        documentFilePath?: string | null
        numPages: number
        fields: EnvelopeFieldsPayload
        selfName: string
        selfEmail: string
        counterpartyName: string
        counterpartyEmail: string
        /** Marque comme déjà signé côté émetteur (au moins partiellement). */
        selfSigned: boolean
    }): Promise<SignatureEnvelopeDTO> {
        const now = new Date()
        const row = await prisma.signatureEnvelope.create({
            data: {
                externalId: crypto.randomUUID(),
                signingToken: crypto.randomBytes(32).toString("hex"),
                documentName: data.documentName,
                documentFilePath: data.documentFilePath ?? null,
                numPages: data.numPages,
                encryptedFields: encryptJson(data.fields),
                status: "SENT",
                selfName: data.selfName,
                selfEmail: data.selfEmail,
                counterpartyName: data.counterpartyName,
                counterpartyEmail: data.counterpartyEmail,
                sentAt: now,
                selfSignedAt: data.selfSigned ? now : null,
                userId,
            },
        })
        return toDTO(row)
    }

    /**
     * Récupère une enveloppe par son token public (sans authentification).
     * Utilisé par la page de signature du cocontractant.
     */
    async getByToken(signingToken: string): Promise<{
        meta: SignatureEnvelopeDTO
        fields: EnvelopeFieldsPayload
        documentFilePath: string | null
    } | null> {
        const row = await prisma.signatureEnvelope.findUnique({ where: { signingToken } })
        if (!row) return null
        const fields = decryptJson<EnvelopeFieldsPayload>(row.encryptedFields)
        return { meta: toDTO(row), fields, documentFilePath: row.documentFilePath }
    }

    /**
     * Enregistre les signatures du cocontractant et passe le statut à SIGNED.
     */
    async signByToken(signingToken: string, signedFields: EnvelopeFieldsPayload): Promise<SignatureEnvelopeDTO | null> {
        const row = await prisma.signatureEnvelope.findUnique({ where: { signingToken } })
        if (!row) return null
        const now = new Date()
        const updated = await prisma.signatureEnvelope.update({
            where: { signingToken },
            data: {
                encryptedFields: encryptJson(signedFields),
                status: "SIGNED",
                counterpartySignedAt: now,
                completedAt: now,
            },
        })
        return toDTO(updated)
    }

    /** Supprime définitivement une enveloppe. */
    async delete(userId: number, externalId: string): Promise<void> {
        await prisma.signatureEnvelope.deleteMany({ where: { userId, externalId } })
    }

    /**
     * Statistiques agrégées pour la vue tableau de bord :
     *   - compteurs par statut
     *   - 5 enveloppes les plus récentes
     */
    async stats(userId: number): Promise<SignatureDashboardStats> {
        const [all, recentRows] = await Promise.all([
            prisma.signatureEnvelope.findMany({
                where: { userId },
                select: { status: true },
            }),
            prisma.signatureEnvelope.findMany({
                where: { userId },
                orderBy: { updatedAt: "desc" },
                take: 5,
            }),
        ])
        const stats: SignatureDashboardStats = {
            total: all.length,
            draft: 0,
            sent: 0,
            partiallySigned: 0,
            signed: 0,
            other: 0,
            recent: recentRows.map(toDTO),
        }
        for (const row of all) {
            switch (row.status) {
                case "DRAFT": stats.draft++; break
                case "SENT": stats.sent++; break
                case "PARTIALLY_SIGNED": stats.partiallySigned++; break
                case "SIGNED": stats.signed++; break
                default: stats.other++; break
            }
        }
        return stats
    }
}
