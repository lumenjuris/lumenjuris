import { Prisma } from "@prisma/client"
import { prisma } from "../../prisma/singletonPrisma.js"

// Le champ `snapshot` est chiffré/déchiffré automatiquement par l'extension Prisma.

const MAX_ITEMS = 20

export type ContractHistoryItemDTO = {
    id: string
    fileName: string
    contractType: string | null
    overallRiskScore: number | null
    wordCount: number
    clausesCount: number
    activePatchCount: number
    createdAt: string
    updatedAt: string
    lastOpenedAt: string
    status: "analyzed"
}

function toDTO(item: {
    externalId: string
    fileName: string
    contractType: string | null
    overallRiskScore: number | null
    wordCount: number
    clausesCount: number
    activePatchCount: number
    createdAt: Date
    updatedAt: Date
    lastOpenedAt: Date
}): ContractHistoryItemDTO {
    return {
        id: item.externalId,
        fileName: item.fileName,
        contractType: item.contractType,
        overallRiskScore: item.overallRiskScore,
        wordCount: item.wordCount,
        clausesCount: item.clausesCount,
        activePatchCount: item.activePatchCount,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        lastOpenedAt: item.lastOpenedAt.toISOString(),
        status: "analyzed",
    }
}

export class ContractHistory {
    async list(userId: number): Promise<ContractHistoryItemDTO[]> {
        const items = await prisma.contractHistory.findMany({
            where: { userId },
            select: {
                externalId: true,
                fileName: true,
                contractType: true,
                overallRiskScore: true,
                wordCount: true,
                clausesCount: true,
                activePatchCount: true,
                createdAt: true,
                updatedAt: true,
                lastOpenedAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: MAX_ITEMS,
        })
        return items.map(toDTO)
    }

    async getSnapshot(userId: number, externalId: string): Promise<object | null> {
        const item = await prisma.contractHistory.findFirst({
            where: { userId, externalId },
            select: { snapshot: true },
        })
        if (!item) return null
        return item.snapshot as object
    }

    async save(
        userId: number,
        body: { externalId: string; snapshot: Record<string, unknown> },
    ): Promise<ContractHistoryItemDTO> {
        const { externalId, snapshot } = body
        const contract = snapshot.contract as Record<string, unknown> | undefined
        const patches = (snapshot.patches as Array<{ active?: boolean }> | undefined) ?? []

        const fileName = String(contract?.fileName ?? "Document")
        const contractType = (contract?.contractType as string | null) || null
        const overallRiskScore =
            typeof contract?.overallRiskScore === "number" ? contract.overallRiskScore : null
        const wordCount =
            typeof (contract?.extractionMetadata as Record<string, unknown> | undefined)
                ?.wordCount === "number"
                ? ((contract?.extractionMetadata as Record<string, unknown>).wordCount as number)
                : 0
        const clausesCount = Array.isArray(contract?.clauses) ? contract.clauses.length : 0
        const activePatchCount = patches.filter((p) => p.active).length
        const snapshotJson = snapshot as Prisma.InputJsonValue

        const item = await prisma.contractHistory.upsert({
            where: { externalId },
            create: {
                externalId,
                fileName,
                contractType,
                overallRiskScore,
                wordCount,
                clausesCount,
                activePatchCount,
                snapshot: snapshotJson,
                userId,
            },
            update: {
                fileName,
                contractType,
                overallRiskScore,
                wordCount,
                clausesCount,
                activePatchCount,
                snapshot: snapshotJson,
                lastOpenedAt: new Date(),
            },
        })
        return toDTO(item)
    }

    async touch(userId: number, externalId: string): Promise<void> {
        await prisma.contractHistory.updateMany({
            where: { userId, externalId },
            data: { lastOpenedAt: new Date() },
        })
    }

    async delete(userId: number, externalId: string): Promise<void> {
        await prisma.contractHistory.deleteMany({
            where: { userId, externalId },
        })
    }
}
