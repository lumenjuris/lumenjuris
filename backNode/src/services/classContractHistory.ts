import crypto from "crypto"
import { prisma } from "../../prisma/singletonPrisma"

const ALGO = "aes-256-gcm"
const MAX_ITEMS = 20

function getKey(): Buffer {
    const hex = process.env.CONTRACT_ENCRYPTION_KEY
    if (!hex || hex.length !== 64) {
        throw new Error("CONTRACT_ENCRYPTION_KEY must be a 64-char hex string")
    }
    return Buffer.from(hex, "hex")
}

function encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
    const authTag = cipher.getAuthTag()
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("base64")}`
}

function decrypt(stored: string): string {
    const i1 = stored.indexOf(":")
    const i2 = stored.indexOf(":", i1 + 1)
    const iv = Buffer.from(stored.slice(0, i1), "hex")
    const authTag = Buffer.from(stored.slice(i1 + 1, i2), "hex")
    const ciphertext = Buffer.from(stored.slice(i2 + 1), "base64")
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv)
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}

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
            select: { encryptedSnapshot: true },
        })
        if (!item) return null
        try {
            return JSON.parse(decrypt(item.encryptedSnapshot)) as object
        } catch {
            return null
        }
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
        const encryptedSnapshot = encrypt(JSON.stringify(snapshot))

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
                encryptedSnapshot,
                userId,
            },
            update: {
                fileName,
                contractType,
                overallRiskScore,
                wordCount,
                clausesCount,
                activePatchCount,
                encryptedSnapshot,
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
