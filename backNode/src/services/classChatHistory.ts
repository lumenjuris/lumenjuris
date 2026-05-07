import { prisma } from "../../prisma/singletonPrisma"

export class ChatHistory {
    async get(userId: number): Promise<object[]> {
        const row = await prisma.chatHistory.findUnique({
            where: { userId },
            select: { conversations: true },
        })
        if (!row) return []
        try {
            return JSON.parse(row.conversations) as object[]
        } catch {
            return []
        }
    }

    async save(userId: number, conversations: object[]): Promise<void> {
        const json = JSON.stringify(conversations)
        await prisma.chatHistory.upsert({
            where: { userId },
            create: { userId, conversations: json },
            update: { conversations: json },
        })
    }
}
