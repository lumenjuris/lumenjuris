import express from "express"
import type { Request, Response, Router } from "express"
import { authMiddleware } from "../middleware/authMiddleware"
import { ContractHistory } from "../services/classContractHistory"

const routerContractHistory: Router = express.Router()

routerContractHistory.get("/", authMiddleware, async (req: Request, res: Response) => {
    try {
        const items = await new ContractHistory().list(Number(req.idUser))
        return res.status(200).json({ success: true, data: items })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ success: false, message: "Erreur lors du chargement de l'historique." })
    }
})

routerContractHistory.get("/:externalId", authMiddleware, async (req: Request, res: Response) => {
    try {
        const snapshot = await new ContractHistory().getSnapshot(
            Number(req.idUser),
            req.params.externalId,
        )
        if (!snapshot) return res.status(404).json({ success: false, message: "Document introuvable." })
        return res.status(200).json({ success: true, data: snapshot })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ success: false, message: "Erreur lors du chargement du document." })
    }
})

routerContractHistory.post("/", authMiddleware, async (req: Request, res: Response) => {
    try {
        const item = await new ContractHistory().save(Number(req.idUser), req.body)
        return res.status(200).json({ success: true, data: item })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ success: false, message: "Erreur lors de la sauvegarde." })
    }
})

routerContractHistory.patch("/:externalId/touch", authMiddleware, async (req: Request, res: Response) => {
    try {
        await new ContractHistory().touch(Number(req.idUser), req.params.externalId)
        return res.status(200).json({ success: true })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ success: false, message: "Erreur lors de la mise à jour." })
    }
})

routerContractHistory.delete("/:externalId", authMiddleware, async (req: Request, res: Response) => {
    try {
        await new ContractHistory().delete(Number(req.idUser), req.params.externalId)
        return res.status(200).json({ success: true })
    } catch (err) {
        console.error(err)
        return res.status(500).json({ success: false, message: "Erreur lors de la suppression." })
    }
})

export default routerContractHistory
