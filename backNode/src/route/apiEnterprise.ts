import express from "express";
import type { Request, Response, Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { Enterprise } from "../services/classEnterprise";

const routerEnterprise: Router = express.Router();

// INSEE preview
routerEnterprise.get("/insee/:siren", async (req: Request, res: Response) => {
    try {
        const siren = String(req.params.siren ?? "");
        const result = await new Enterprise().previewFromSiren(siren);

        return res.status(result.success ? 200 : 400).json(result);
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération des données INSEE.",
        });
    }
});

// Create enterprise from SIREN
routerEnterprise.post("/create", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser);
        const { siren } = req.body;

        const result = await new Enterprise().createForUserFromSiren(userId, siren);

        return res.status(result.success ? 200 : 400).json(result);
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Erreur lors de la création de l'entreprise.",
        });
    }
});

// Get enterprise
routerEnterprise.get("/", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser);
        const result = await new Enterprise().getByUser(userId);

        return res.status(result.success ? 200 : 404).json(result);
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Erreur lors de la récupération du profil entreprise.",
        });
    }
});

// Update enterprise
routerEnterprise.put("/", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser);
        const result = await new Enterprise().updateByUser(userId, req.body);

        return res.status(result.success ? 200 : 400).json(result);
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Erreur lors de la mise à jour du profil entreprise.",
        });
    }
});

// Delete enterprise
routerEnterprise.delete("/", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser);
        const result = await new Enterprise().deleteByUser(userId);

        return res.status(result.success ? 200 : 400).json(result);
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Erreur lors de la suppression du profil entreprise.",
        });
    }
});

// Add custom IDCC
routerEnterprise.post("/idcc/custom", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser);
        const result = await new Enterprise().addCustomConventionCollective(userId, req.body);

        return res.status(result.success ? 200 : 400).json(result);
    } catch (err) {
        console.error("Erreur ajout IDCC custom:", err);
        return res.status(500).json({
            success: false,
            message: "Erreur lors de l'ajout d'une convention collective personnalisée.",
        });
    }
});

// Delete custom IDCC
routerEnterprise.delete("/idcc/custom/:selectedIdccKey", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser);
        const selectedIdccKey = String(req.params.selectedIdccKey ?? "");

        const result = await new Enterprise().deleteCustomConventionCollective(
            userId,
            selectedIdccKey
        );

        return res.status(result.success ? 200 : 400).json(result);
    } catch (err) {
        console.error("Erreur suppression IDCC custom:", err);
        return res.status(500).json({
            success: false,
            message: "Erreur lors de la suppression d'une convention collective personnalisée.",
        });
    }
});

export default routerEnterprise;