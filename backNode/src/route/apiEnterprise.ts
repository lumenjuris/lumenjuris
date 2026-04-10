import express from "express"
import type { Request, Response, Router } from "express"
import { authMiddleware } from "../middleware/authMiddleware"
import { Enterprise } from "../services/classEnterprise"

const routerEnterprise: Router = express.Router()

routerEnterprise.get("/insee/:siren", async (req: Request, res: Response) => {
    try {
        const siren = String(req.params.siren ?? "")
        const enterprise = new Enterprise()
        const result = await enterprise.previewFromSiren(siren)

        return res.status(result.success ? 200 : 400).json(result)
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de la récupération des données INSEE.",
        })
    }
})

routerEnterprise.post("/create", authMiddleware, async (req: Request, res: Response) => {
    try {
        const { siren } = req.body
        const userId = Number(req.idUser)
        const enterprise = new Enterprise()
        const result = await enterprise.createForUserFromSiren(userId, siren)

        return res.status(result.success ? 200 : 400).json(result)
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de la création de l'entreprise.",
        })
    }
})

routerEnterprise.get("/get", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        const enterprise = new Enterprise()
        const result = await enterprise.getByUser(userId)

        return res.status(result.success ? 200 : 404).json(result)
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de la récupération de l'entreprise.",
        })
    }
})

routerEnterprise.put("/update", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        const enterprise = new Enterprise()
        const result = await enterprise.updateByUser(userId, req.body)

        return res.status(result.success ? 200 : 400).json(result)
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de la mise à jour de l'entreprise.",
        })
    }
})

routerEnterprise.delete("/delete", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        const enterprise = new Enterprise()
        const result = await enterprise.deleteByUser(userId)

        return res.status(result.success ? 200 : 400).json(result)
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de la suppression de l'entreprise.",
        })
    }
})

export default routerEnterprise
