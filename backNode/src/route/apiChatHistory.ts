import express from "express"
import type { Request, Response, Router } from "express"
import { authMiddleware } from "../middleware/authMiddleware"
import { ChatHistory } from "../services/classChatHistory"

const routerChatHistory: Router = express.Router()

routerChatHistory.get("/", authMiddleware, async (req: Request, res: Response) => {
    try {
        const conversations = await new ChatHistory().get(Number(req.idUser))
        return res.status(200).json({ success: true, conversations })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ success: false, message: "Erreur lors du chargement." })
    }
})

routerChatHistory.put("/", authMiddleware, async (req: Request, res: Response) => {
    try {
        const { conversations } = req.body
        if (!Array.isArray(conversations)) {
            return res.status(400).json({ success: false, message: "conversations doit être un tableau." })
        }
        await new ChatHistory().save(Number(req.idUser), conversations)
        return res.status(200).json({ success: true })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ success: false, message: "Erreur lors de la sauvegarde." })
    }
})

export default routerChatHistory
