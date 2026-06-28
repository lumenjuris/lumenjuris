import crypto from "crypto"
import { prisma } from "../../prisma/singletonPrisma.js"
import { encryptJson, decryptJson } from "./classContractTemplate.js"

export interface GenerationLogDTO {
    id: string
    templateId: number
    variables: Record<string, string>
    promptTokens: number
    completionTokens: number
    createdAt: string
}

export interface GenerationLogWithOutput extends GenerationLogDTO {
    output: string
}

function toDTO(r: {
    externalId: string
    templateId: number
    variables: unknown
    promptTokens: number
    completionTokens: number
    createdAt: Date
}): GenerationLogDTO {
    return {
        id: r.externalId,
        templateId: r.templateId,
        variables: r.variables as Record<string, string>,
        promptTokens: r.promptTokens,
        completionTokens: r.completionTokens,
        createdAt: r.createdAt.toISOString(),
    }
}

export class GenerationLogService {
    async list(userId: number, templateExternalId: string): Promise<GenerationLogDTO[]> {
        const template = await prisma.contractTemplate.findFirst({
            where: { userId, externalId: templateExternalId },
        })
        if (!template) return []
        const rows = await prisma.generationLog.findMany({
            where: { templateId: template.idTemplate },
            orderBy: { createdAt: "desc" },
            take: 50,
        })
        return rows.map(toDTO)
    }

    async getWithOutput(userId: number, logExternalId: string): Promise<GenerationLogWithOutput | null> {
        const row = await prisma.generationLog.findFirst({
            where: { externalId: logExternalId },
            include: { template: { select: { userId: true } } },
        })
        if (!row || row.template.userId !== userId) return null
        const output = decryptJson<string>(row.encryptedOutput)
        return { ...toDTO(row), output }
    }

    async save(
        userId: number,
        templateExternalId: string,
        data: {
            variables: Record<string, string>
            promptTokens: number
            completionTokens: number
            output: string
        },
    ): Promise<GenerationLogDTO> {
        const template = await prisma.contractTemplate.findFirst({
            where: { userId, externalId: templateExternalId },
        })
        if (!template) throw new Error("Template not found")
        const row = await prisma.generationLog.create({
            data: {
                externalId: crypto.randomUUID(),
                variables: data.variables,
                promptTokens: data.promptTokens,
                completionTokens: data.completionTokens,
                encryptedOutput: encryptJson(data.output),
                templateId: template.idTemplate,
            },
        })
        return toDTO(row)
    }
}
