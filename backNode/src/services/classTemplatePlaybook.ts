import { prisma } from "../../prisma/singletonPrisma.js"

export interface PlaybookDTO {
    id: number
    templateId: number
    rulesText: string
    metadata: unknown
    createdAt: string
    updatedAt: string
}

function toDTO(p: {
    idPlaybook: number
    templateId: number
    rulesText: string
    metadata: unknown
    createdAt: Date
    updatedAt: Date
}): PlaybookDTO {
    return {
        id: p.idPlaybook,
        templateId: p.templateId,
        rulesText: p.rulesText,
        metadata: p.metadata,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
    }
}

export class TemplatePlaybookService {
    async get(userId: number, externalId: string): Promise<PlaybookDTO | null> {
        const template = await prisma.contractTemplate.findFirst({
            where: { userId, externalId },
            include: { playbook: true },
        })
        if (!template?.playbook) return null
        return toDTO(template.playbook)
    }

    async upsert(userId: number, externalId: string, rulesText: string, metadata?: unknown): Promise<PlaybookDTO> {
        const template = await prisma.contractTemplate.findFirst({
            where: { userId, externalId },
        })
        if (!template) throw new Error("Template not found")

        const row = await prisma.templatePlaybook.upsert({
            where: { templateId: template.idTemplate },
            create: {
                templateId: template.idTemplate,
                rulesText,
                metadata: metadata ? (metadata as object) : undefined,
            },
            update: {
                rulesText,
                metadata: metadata ? (metadata as object) : undefined,
            },
        })
        return toDTO(row)
    }

    async delete(userId: number, externalId: string): Promise<void> {
        const template = await prisma.contractTemplate.findFirst({
            where: { userId, externalId },
        })
        if (!template) return
        await prisma.templatePlaybook.deleteMany({ where: { templateId: template.idTemplate } })
    }
}
