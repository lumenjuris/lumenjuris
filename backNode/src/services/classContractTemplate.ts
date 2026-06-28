import crypto from "crypto"
import { prisma } from "../../prisma/singletonPrisma.js"

const ALGO = "aes-256-gcm"

function getKey(): Buffer {
    const hex = process.env.CONTRACT_ENCRYPTION_KEY
    if (!hex || hex.length !== 64) throw new Error("CONTRACT_ENCRYPTION_KEY must be a 64-char hex string")
    return Buffer.from(hex, "hex")
}

export function encryptJson(obj: unknown): string {
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
    const plain = JSON.stringify(obj)
    const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
    const tag = cipher.getAuthTag()
    return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("base64")}`
}

export function decryptJson<T = unknown>(stored: string): T {
    const i1 = stored.indexOf(":")
    const i2 = stored.indexOf(":", i1 + 1)
    const iv = Buffer.from(stored.slice(0, i1), "hex")
    const tag = Buffer.from(stored.slice(i1 + 1, i2), "hex")
    const ct = Buffer.from(stored.slice(i2 + 1), "base64")
    const dec = crypto.createDecipheriv(ALGO, getKey(), iv)
    dec.setAuthTag(tag)
    return JSON.parse(Buffer.concat([dec.update(ct), dec.final()]).toString("utf8")) as T
}

export interface TemplateStructure {
    sections: Array<{
        title: string
        clauses: Array<{
            id: string
            title: string
            content: string
            variables: string[]
        }>
    }>
    detectedVariables: string[]
    rawText?: string
}

export interface ContractTemplateDTO {
    id: string
    name: string
    contractType: string | null
    sourceFilename: string | null
    version: number
    createdAt: string
    updatedAt: string
}

function toDTO(t: {
    externalId: string
    name: string
    contractType: string | null
    sourceFilename: string | null
    version: number
    createdAt: Date
    updatedAt: Date
}): ContractTemplateDTO {
    return {
        id: t.externalId,
        name: t.name,
        contractType: t.contractType,
        sourceFilename: t.sourceFilename,
        version: t.version,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
    }
}

export class ContractTemplateService {
    async list(userId: number): Promise<ContractTemplateDTO[]> {
        const rows = await prisma.contractTemplate.findMany({
            where: { userId },
            select: {
                externalId: true,
                name: true,
                contractType: true,
                sourceFilename: true,
                version: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: "desc" },
        })
        return rows.map(toDTO)
    }

    async get(userId: number, externalId: string): Promise<{ meta: ContractTemplateDTO; structure: TemplateStructure } | null> {
        const row = await prisma.contractTemplate.findFirst({
            where: { userId, externalId },
        })
        if (!row) return null
        const structure = decryptJson<TemplateStructure>(row.encryptedStructure)
        return { meta: toDTO(row), structure }
    }

    async create(
        userId: number,
        data: {
            name: string
            contractType?: string
            sourceFilename?: string
            sourceFilePath?: string
            structure: TemplateStructure
        },
    ): Promise<ContractTemplateDTO> {
        const row = await prisma.contractTemplate.create({
            data: {
                externalId: crypto.randomUUID(),
                name: data.name,
                contractType: data.contractType ?? null,
                sourceFilename: data.sourceFilename ?? null,
                sourceFilePath: data.sourceFilePath ?? null,
                encryptedStructure: encryptJson(data.structure),
                userId,
            },
        })
        return toDTO(row)
    }

    async updateStructure(
        userId: number,
        externalId: string,
        structure: TemplateStructure,
    ): Promise<ContractTemplateDTO | null> {
        const existing = await prisma.contractTemplate.findFirst({ where: { userId, externalId } })
        if (!existing) return null
        const row = await prisma.contractTemplate.update({
            where: { idTemplate: existing.idTemplate },
            data: {
                encryptedStructure: encryptJson(structure),
                version: existing.version + 1,
            },
        })
        return toDTO(row)
    }

    async delete(userId: number, externalId: string): Promise<void> {
        await prisma.contractTemplate.deleteMany({ where: { userId, externalId } })
    }
}
