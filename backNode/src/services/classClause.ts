import crypto from "crypto"
import { prisma } from "../../prisma/singletonPrisma"

export type ClauseCategoryValue =
    | "CONFIDENTIALITE" | "RESPONSABILITE" | "RESILIATION" | "PROPRIETE_INTELLECTUELLE"
    | "DONNEES_PERSONNELLES" | "PAIEMENT" | "DUREE_RENOUVELLEMENT" | "FORCE_MAJEURE"
    | "LITIGES" | "GARANTIES" | "NON_CONCURRENCE" | "AUTRE"

export type ClausePositionValue = "IDEALE" | "ACCEPTABLE" | "LIGNE_ROUGE"

/** DTO sérialisable exposé à l'API. */
export interface ClauseDTO {
    id: string
    title: string
    category: ClauseCategoryValue
    position: ClausePositionValue
    body: string
    notes: string | null
    language: string
    tags: string[]
    isApproved: boolean
    usageCount: number
    createdAt: string
    updatedAt: string
}

export interface ClauseListFilters {
    category?: ClauseCategoryValue
    position?: ClausePositionValue
    onlyApproved?: boolean
    q?: string
}

export interface ClauseInput {
    title: string
    category?: ClauseCategoryValue
    position?: ClausePositionValue
    body: string
    notes?: string | null
    language?: string
    tags?: string[]
    isApproved?: boolean
}

function toDTO(row: {
    externalId: string
    title: string
    category: string
    position: string
    body: string
    notes: string | null
    language: string
    tags: string | null
    isApproved: boolean
    usageCount: number
    createdAt: Date
    updatedAt: Date
}): ClauseDTO {
    return {
        id: row.externalId,
        title: row.title,
        category: row.category as ClauseCategoryValue,
        position: row.position as ClausePositionValue,
        body: row.body,
        notes: row.notes,
        language: row.language,
        tags: row.tags ? row.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        isApproved: row.isApproved,
        usageCount: row.usageCount,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    }
}

/**
 * Service de la bibliothèque de clauses.
 * Référentiel de clauses approuvées, réutilisables pour la génération
 * et la négociation de contrats.
 */
export class ClauseService {
    /** Liste les clauses de l'utilisateur, filtrées/triées. */
    async list(userId: number, filters: ClauseListFilters = {}): Promise<ClauseDTO[]> {
        const where: Record<string, unknown> = { userId }
        if (filters.category) where["category"] = filters.category
        if (filters.position) where["position"] = filters.position
        if (filters.onlyApproved) where["isApproved"] = true
        if (filters.q) {
            where["OR"] = [
                { title: { contains: filters.q } },
                { body: { contains: filters.q } },
                { tags: { contains: filters.q } },
            ]
        }
        const rows = await prisma.clause.findMany({
            where,
            orderBy: [{ category: "asc" }, { position: "asc" }, { title: "asc" }],
        })
        return rows.map(toDTO)
    }

    /** Agrégats : nombre de clauses par catégorie + total approuvées. */
    async stats(userId: number): Promise<{ total: number; approved: number; byCategory: Record<string, number> }> {
        const rows = await prisma.clause.findMany({ where: { userId }, select: { category: true, isApproved: true } })
        const byCategory: Record<string, number> = {}
        let approved = 0
        for (const r of rows) {
            byCategory[r.category] = (byCategory[r.category] ?? 0) + 1
            if (r.isApproved) approved++
        }
        return { total: rows.length, approved, byCategory }
    }

    async get(userId: number, externalId: string): Promise<ClauseDTO | null> {
        const row = await prisma.clause.findFirst({ where: { userId, externalId } })
        return row ? toDTO(row) : null
    }

    async create(userId: number, input: ClauseInput): Promise<ClauseDTO> {
        const row = await prisma.clause.create({
            data: {
                externalId: crypto.randomUUID(),
                title: input.title.trim(),
                category: (input.category ?? "AUTRE") as ClauseCategoryValue,
                position: (input.position ?? "IDEALE") as ClausePositionValue,
                body: input.body,
                notes: input.notes ?? null,
                language: input.language ?? "fr",
                tags: input.tags?.length ? input.tags.join(",") : null,
                isApproved: input.isApproved ?? false,
                userId,
            },
        })
        return toDTO(row)
    }

    async update(userId: number, externalId: string, patch: Partial<ClauseInput>): Promise<boolean> {
        const existing = await prisma.clause.findFirst({ where: { userId, externalId } })
        if (!existing) return false
        const data: Record<string, unknown> = {}
        if (patch.title !== undefined) data["title"] = patch.title.trim()
        if (patch.category !== undefined) data["category"] = patch.category
        if (patch.position !== undefined) data["position"] = patch.position
        if (patch.body !== undefined) data["body"] = patch.body
        if (patch.notes !== undefined) data["notes"] = patch.notes
        if (patch.language !== undefined) data["language"] = patch.language
        if (patch.tags !== undefined) data["tags"] = patch.tags.length ? patch.tags.join(",") : null
        if (patch.isApproved !== undefined) data["isApproved"] = patch.isApproved
        await prisma.clause.update({ where: { idClause: existing.idClause }, data })
        return true
    }

    /** Incrémente le compteur d'usage (appelé lors d'une insertion dans un contrat). */
    async incrementUsage(userId: number, externalId: string): Promise<boolean> {
        const existing = await prisma.clause.findFirst({ where: { userId, externalId } })
        if (!existing) return false
        await prisma.clause.update({
            where: { idClause: existing.idClause },
            data: { usageCount: { increment: 1 } },
        })
        return true
    }

    async delete(userId: number, externalId: string): Promise<boolean> {
        const r = await prisma.clause.deleteMany({ where: { userId, externalId } })
        return r.count > 0
    }
}
