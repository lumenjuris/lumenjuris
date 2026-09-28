import crypto from "crypto"
import { prisma } from "../../prisma/singletonPrisma.js"

export type RuleTypeValue = "MAX" | "MIN" | "REQUIRED" | "FORBIDDEN" | "ALLOWED_VALUES" | "INSTRUCTION"
export type RuleSeverityValue = "LOW" | "MEDIUM" | "HIGH"

const RULE_TYPES: RuleTypeValue[] = ["MAX", "MIN", "REQUIRED", "FORBIDDEN", "ALLOWED_VALUES", "INSTRUCTION"]
const SEVERITIES: RuleSeverityValue[] = ["LOW", "MEDIUM", "HIGH"]

/** DTO sérialisable exposé à l'API. */
export interface RuleDTO {
    id: string
    playbookId: string
    name: string
    category: string
    description: string | null
    ruleType: RuleTypeValue
    expectedValue: string | null
    unit: string | null
    severity: RuleSeverityValue
    suggestion: string | null
    keywords: string[]
    isActive: boolean
    createdAt: string
    updatedAt: string
}

export interface RuleInput {
    name: string
    category?: string
    description?: string | null
    ruleType?: RuleTypeValue
    expectedValue?: string | null
    unit?: string | null
    severity?: RuleSeverityValue
    suggestion?: string | null
    keywords?: string[] | string | null
    isActive?: boolean
}

export interface PlaybookDTO {
    id: string
    name: string
    contractType: string | null
    isDefault: boolean
    ruleCount: number
    activeCount: number
}

export interface AnalysisSummaryDTO {
    id: string
    fileName: string
    playbookName: string | null
    compliant: number
    nonCompliant: number
    toCheck: number
    createdAt: string
    updatedAt: string
}

export interface AnalysisInput {
    fileName?: string
    playbookId?: string | null
    summary?: { compliant?: number; nonCompliant?: number; toCheck?: number }
    snapshot?: unknown
}

type RuleRow = Awaited<ReturnType<typeof prisma.negotiationRule.findFirstOrThrow>> & { playbook: { externalId: string } }

const AVEC_PLAYBOOK = { playbook: { select: { externalId: true } } } as const

function toDTO(r: RuleRow): RuleDTO {
    return {
        id: r.externalId,
        playbookId: r.playbook.externalId,
        name: r.name,
        category: r.category,
        description: r.description,
        ruleType: r.ruleType as RuleTypeValue,
        expectedValue: r.expectedValue,
        unit: r.unit,
        severity: r.severity as RuleSeverityValue,
        suggestion: r.suggestion,
        keywords: (r.keywords ?? "").split(",").map((k) => k.trim()).filter(Boolean),
        isActive: r.isActive,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
    }
}

const texte = (v: unknown, max = 5000): string | null => {
    if (typeof v !== "string") return null
    const t = v.trim().slice(0, max)
    return t.length ? t : null
}

/** Ne garde que les champs connus et valides (l'entrée vient du navigateur). */
function cleanInput(input: Partial<RuleInput>) {
    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = String(input.name).trim().slice(0, 190)
    if (input.category !== undefined) data.category = (texte(input.category, 190) ?? "Autre")
    if (input.description !== undefined) data.description = texte(input.description)
    if (input.ruleType !== undefined && RULE_TYPES.includes(input.ruleType)) data.ruleType = input.ruleType
    if (input.expectedValue !== undefined) data.expectedValue = texte(input.expectedValue)
    if (input.unit !== undefined) data.unit = texte(input.unit, 190)
    if (input.severity !== undefined && SEVERITIES.includes(input.severity)) data.severity = input.severity
    if (input.suggestion !== undefined) data.suggestion = texte(input.suggestion)
    if (input.keywords !== undefined) {
        const list = Array.isArray(input.keywords) ? input.keywords : String(input.keywords ?? "").split(",")
        data.keywords = texte(list.map((k) => String(k).trim()).filter(Boolean).join(", "))
    }
    if (input.isActive !== undefined) data.isActive = Boolean(input.isActive)
    return data
}

/**
 * Playbook (règles de négociation). Un utilisateur peut avoir plusieurs
 * playbooks (« Contrats artistes », « NDA »…) ; un playbook « Mes règles »
 * par défaut est créé au premier accès. `enterpriseId` prépare le partage
 * par organisation.
 */
export class PlaybookService {
    /** Playbook par défaut de l'utilisateur, créé s'il n'existe pas. */
    async defaultPlaybookId(userId: number): Promise<number> {
        const found = await prisma.negotiationPlaybook.findFirst({
            where: { userId, isDefault: true },
            select: { idPlaybook: true },
        })
        if (found) return found.idPlaybook
        const created = await prisma.negotiationPlaybook.create({
            data: { userId, externalId: crypto.randomUUID(), name: "Mes règles", isDefault: true },
            select: { idPlaybook: true },
        })
        return created.idPlaybook
    }

    /** Identifiant interne d'un playbook de l'utilisateur ; sans identifiant, son playbook par défaut. */
    async resolvePlaybookId(userId: number, playbookExternalId?: string | null): Promise<number | null> {
        if (!playbookExternalId) return this.defaultPlaybookId(userId)
        const p = await prisma.negotiationPlaybook.findFirst({
            where: { userId, externalId: playbookExternalId },
            select: { idPlaybook: true },
        })
        return p?.idPlaybook ?? null
    }

    // ─── Règles ───

    /** Règles d'un playbook (le playbook par défaut si non précisé) ; null si playbook inconnu. */
    async list(userId: number, onlyActive = false, playbookExternalId?: string | null): Promise<RuleDTO[] | null> {
        const playbookId = await this.resolvePlaybookId(userId, playbookExternalId)
        if (playbookId === null) return null
        const rows = await prisma.negotiationRule.findMany({
            where: { playbookId, ...(onlyActive ? { isActive: true } : {}) },
            orderBy: [{ category: "asc" }, { createdAt: "asc" }],
            include: AVEC_PLAYBOOK,
        })
        return rows.map(toDTO)
    }

    async create(userId: number, input: RuleInput & { playbookId?: string | null }): Promise<RuleDTO | null> {
        const playbookId = await this.resolvePlaybookId(userId, input.playbookId)
        if (playbookId === null) return null
        const row = await prisma.negotiationRule.create({
            data: { ...(cleanInput(input) as any), name: String(input.name).trim().slice(0, 190), playbookId, externalId: crypto.randomUUID() },
            include: AVEC_PLAYBOOK,
        })
        return toDTO(row)
    }

    /** Renvoie null si la règle n'existe pas ou n'appartient pas à l'utilisateur. */
    async update(userId: number, externalId: string, input: Partial<RuleInput>): Promise<RuleDTO | null> {
        const existing = await prisma.negotiationRule.findFirst({ where: { externalId, playbook: { userId } }, select: { idRule: true } })
        if (!existing) return null
        const data = cleanInput(input)
        if (data.name === "") delete data.name
        const row = await prisma.negotiationRule.update({ where: { idRule: existing.idRule }, data: data as any, include: AVEC_PLAYBOOK })
        return toDTO(row)
    }

    async delete(userId: number, externalId: string): Promise<boolean> {
        const res = await prisma.negotiationRule.deleteMany({ where: { externalId, playbook: { userId } } })
        return res.count > 0
    }

    // ─── Playbooks ───

    async listPlaybooks(userId: number): Promise<PlaybookDTO[]> {
        await this.defaultPlaybookId(userId)
        const rows = await prisma.negotiationPlaybook.findMany({
            where: { userId },
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
            include: { rules: { select: { isActive: true } } },
        })
        return rows.map((p) => ({
            id: p.externalId,
            name: p.name,
            contractType: p.contractType,
            isDefault: p.isDefault,
            ruleCount: p.rules.length,
            activeCount: p.rules.filter((r) => r.isActive).length,
        }))
    }

    async createPlaybook(userId: number, input: { name?: string; contractType?: string | null }): Promise<PlaybookDTO> {
        const p = await prisma.negotiationPlaybook.create({
            data: {
                userId,
                externalId: crypto.randomUUID(),
                name: String(input.name ?? "").trim().slice(0, 190) || "Nouveau playbook",
                contractType: texte(input.contractType, 190),
            },
        })
        return { id: p.externalId, name: p.name, contractType: p.contractType, isDefault: p.isDefault, ruleCount: 0, activeCount: 0 }
    }

    async renamePlaybook(userId: number, externalId: string, input: { name?: string; contractType?: string | null }): Promise<boolean> {
        const data: Record<string, unknown> = {}
        if (input.name !== undefined && String(input.name).trim()) data.name = String(input.name).trim().slice(0, 190)
        if (input.contractType !== undefined) data.contractType = texte(input.contractType, 190)
        const res = await prisma.negotiationPlaybook.updateMany({ where: { userId, externalId }, data })
        return res.count > 0
    }

    /** Supprime un playbook et ses règles. Le playbook par défaut ne peut pas être supprimé. */
    async deletePlaybook(userId: number, externalId: string): Promise<"ok" | "introuvable" | "defaut"> {
        const p = await prisma.negotiationPlaybook.findFirst({ where: { userId, externalId }, select: { idPlaybook: true, isDefault: true } })
        if (!p) return "introuvable"
        if (p.isDefault) return "defaut"
        await prisma.negotiationPlaybook.delete({ where: { idPlaybook: p.idPlaybook } })
        return "ok"
    }

    // ─── Historique des analyses playbook ───

    async listAnalyses(userId: number): Promise<AnalysisSummaryDTO[]> {
        const rows = await prisma.negotiationPlaybookAnalysis.findMany({
            where: { userId },
            orderBy: { updatedAt: "desc" },
            take: 100,
            select: {
                externalId: true, fileName: true, compliantCount: true, nonCompliantCount: true, toCheckCount: true,
                createdAt: true, updatedAt: true, playbook: { select: { name: true } },
            },
        })
        return rows.map((a) => ({
            id: a.externalId,
            fileName: a.fileName,
            playbookName: a.playbook?.name ?? null,
            compliant: a.compliantCount,
            nonCompliant: a.nonCompliantCount,
            toCheck: a.toCheckCount,
            createdAt: a.createdAt.toISOString(),
            updatedAt: a.updatedAt.toISOString(),
        }))
    }

    async getAnalysis(userId: number, externalId: string) {
        const a = await prisma.negotiationPlaybookAnalysis.findFirst({
            where: { userId, externalId },
            include: { playbook: { select: { externalId: true, name: true } } },
        })
        if (!a) return null
        return {
            id: a.externalId,
            fileName: a.fileName,
            playbookId: a.playbook?.externalId ?? null,
            playbookName: a.playbook?.name ?? null,
            snapshot: a.snapshot,
            createdAt: a.createdAt.toISOString(),
        }
    }

    /** Crée (sans id) ou met à jour (avec id) une analyse enregistrée. */
    async saveAnalysis(userId: number, input: AnalysisInput, externalId?: string): Promise<string | null> {
        const counts = {
            compliantCount: Math.max(0, Number(input.summary?.compliant) || 0),
            nonCompliantCount: Math.max(0, Number(input.summary?.nonCompliant) || 0),
            toCheckCount: Math.max(0, Number(input.summary?.toCheck) || 0),
        }
        if (externalId) {
            const existing = await prisma.negotiationPlaybookAnalysis.findFirst({ where: { userId, externalId }, select: { idAnalysis: true } })
            if (!existing) return null
            await prisma.negotiationPlaybookAnalysis.update({
                where: { idAnalysis: existing.idAnalysis },
                data: { ...counts, snapshot: (input.snapshot ?? {}) as any },
            })
            return externalId
        }
        const playbookId = input.playbookId ? await this.resolvePlaybookId(userId, input.playbookId) : null
        const id = crypto.randomUUID()
        await prisma.negotiationPlaybookAnalysis.create({
            data: {
                userId,
                externalId: id,
                playbookId,
                fileName: String(input.fileName ?? "Contrat").slice(0, 500),
                ...counts,
                snapshot: (input.snapshot ?? {}) as any,
            },
        })
        return id
    }

    async deleteAnalysis(userId: number, externalId: string): Promise<boolean> {
        const res = await prisma.negotiationPlaybookAnalysis.deleteMany({ where: { userId, externalId } })
        return res.count > 0
    }
}
