import crypto from "crypto"
import { prisma } from "../../prisma/singletonPrisma.js"

export interface DoctrinalNoteDTO {
    id: string
    templateId: number
    title: string
    content: string
    clauseRef: string | null
    createdAt: string
    updatedAt: string
}

function toDTO(n: {
    externalId: string
    templateId: number
    title: string
    content: string
    clauseRef: string | null
    createdAt: Date
    updatedAt: Date
}): DoctrinalNoteDTO {
    return {
        id: n.externalId,
        templateId: n.templateId,
        title: n.title,
        content: n.content,
        clauseRef: n.clauseRef,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
    }
}

export class DoctrinalNoteService {
    async list(userId: number, externalId: string): Promise<DoctrinalNoteDTO[]> {
        const template = await prisma.contractTemplate.findFirst({ where: { userId, externalId } })
        if (!template) return []
        const rows = await prisma.doctrinalNote.findMany({
            where: { templateId: template.idTemplate },
            orderBy: { createdAt: "asc" },
        })
        return rows.map(toDTO)
    }

    async create(
        userId: number,
        templateExternalId: string,
        data: { title: string; content: string; clauseRef?: string },
    ): Promise<DoctrinalNoteDTO> {
        const template = await prisma.contractTemplate.findFirst({
            where: { userId, externalId: templateExternalId },
        })
        if (!template) throw new Error("Template not found")
        const row = await prisma.doctrinalNote.create({
            data: {
                externalId: crypto.randomUUID(),
                title: data.title,
                content: data.content,
                clauseRef: data.clauseRef ?? null,
                templateId: template.idTemplate,
            },
        })
        return toDTO(row)
    }

    async update(
        userId: number,
        noteExternalId: string,
        data: { title?: string; content?: string; clauseRef?: string | null },
    ): Promise<DoctrinalNoteDTO | null> {
        const note = await prisma.doctrinalNote.findFirst({
            where: { externalId: noteExternalId },
            include: { template: { select: { userId: true } } },
        })
        if (!note || note.template.userId !== userId) return null
        const row = await prisma.doctrinalNote.update({
            where: { idNote: note.idNote },
            data,
        })
        return toDTO(row)
    }

    async delete(userId: number, noteExternalId: string): Promise<void> {
        const note = await prisma.doctrinalNote.findFirst({
            where: { externalId: noteExternalId },
            include: { template: { select: { userId: true } } },
        })
        if (!note || note.template.userId !== userId) return
        await prisma.doctrinalNote.delete({ where: { idNote: note.idNote } })
    }
}
