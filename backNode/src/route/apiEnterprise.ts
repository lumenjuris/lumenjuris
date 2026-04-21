import express from "express"
import type { Request, Response, Router } from "express"
import { authMiddleware } from "../middleware/authMiddleware"
import { Enterprise } from "../services/classEnterprise"

const routerEnterprise: Router = express.Router()

// Cette route prévisualise les données INSEE enrichies avec les IDCC NAF avant toute écriture en base.
routerEnterprise.get("/insee/:siren", async (req: Request, res: Response) => {
    try {
        const siren = String(req.params.siren ?? "")
        const result = await new Enterprise().previewFromSiren(siren)

        return res.status(result.success ? 200 : 400).json(result)
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de la récupération des données INSEE.",
        })
    }
})

// Cette route lit les informations de l'entreprise rattachée au user.
routerEnterprise.get("/", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        const result = await new Enterprise().getByUser(userId)

        return res.status(result.success ? 200 : 404).json(result)
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de la récupération du profil entreprise.",
        })
    }
})

// Cette route enregistre les modif manuelles de l'entreprise par l'user (aussi utilisée par l'onboarding si l'user corrige des données)
routerEnterprise.put("/", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        const result = await new Enterprise().updateByUser(userId, req.body)

        return res.status(result.success ? 200 : 400).json(result)
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de la mise à jour du profil entreprise.",
        })
    }
})

// Cette route supprime le profil entreprise rattaché à l'utilisateur.
routerEnterprise.delete("/", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        const result = await new Enterprise().deleteByUser(userId)

        return res.status(result.success ? 200 : 400).json(result)
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de la suppression du profil entreprise.",
        })
    }
})

// Cette route ajoute une IDCC custom dans la liste sélectionnable (deja populated par le NAF).
routerEnterprise.post("/idcc/custom", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        const result = await new Enterprise().addCustomConventionCollective(userId, req.body)

        return res.status(result.success ? 200 : 400).json(result)
    } catch (err) {
        console.error(`Une erreur est survenue lors de l'ajout d'une convention collective personnalisée, error : \n ${err}`)
        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de l'ajout d'une convention collective personnalisée.",
        })
    }
})

// Cette route supprime une IDCC custom existante sans toucher aux propositions issues du NAF.
routerEnterprise.delete("/idcc/custom/:selectedIdccKey", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        const selectedIdccKey = String(req.params.selectedIdccKey ?? "")
        const result = await new Enterprise().deleteCustomConventionCollective(userId, selectedIdccKey)

        return res.status(result.success ? 200 : 400).json(result)
    } catch (err) {
        console.error(`Une erreur est survenue lors de la suppression d'une convention collective personnalisée, error : \n ${err}`)
        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de la suppression d'une convention collective personnalisée.",
        })
    }
})

export default routerEnterprise
