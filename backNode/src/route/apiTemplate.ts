import express from "express"
import type { Request, Response, Router } from "express"
import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import { authMiddleware } from "../middleware/authMiddleware.js"
import { ContractTemplateService } from "../services/classContractTemplate.js"
import type { TemplateStructure } from "../services/classContractTemplate.js"
import { TemplatePlaybookService } from "../services/classTemplatePlaybook.js"

const router: Router = express.Router()
const svc = new ContractTemplateService()
const playbookSvc = new TemplatePlaybookService()

const TEMPLATES_DIR = path.join(process.cwd(), "templatesources")

// GET / — liste des templates de l'utilisateur
router.get("/", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        const list = await svc.list(userId)
        return res.json({ success: true, data: list })
    } catch (err) {
        console.error("[template] list error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

// GET /:externalId — template + structure déchiffrée
router.get("/:externalId", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        const result = await svc.get(userId, req.params["externalId"] as string)
        if (!result) return res.status(404).json({ success: false, message: "Template introuvable." })
        return res.json({ success: true, data: result })
    } catch (err) {
        console.error("[template] get error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

// POST / — création (appelé par le proxy après extraction + structuration AI)
router.post("/", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        const { name, contractType, sourceFilename, fileBase64, structure } = req.body as {
            name?: string
            contractType?: string
            sourceFilename?: string
            fileBase64?: string
            structure?: TemplateStructure
        }

        if (!name || typeof name !== "string") {
            return res.status(400).json({ success: false, message: "Le champ 'name' est requis." })
        }
        if (!structure || typeof structure !== "object") {
            return res.status(400).json({ success: false, message: "Le champ 'structure' est requis." })
        }

        let savedFilePath: string | undefined
        if (fileBase64 && sourceFilename) {
            await fs.mkdir(TEMPLATES_DIR, { recursive: true })
            const ext = path.extname(sourceFilename) || ".bin"
            const storedName = crypto.randomBytes(8).toString("hex") + ext
            savedFilePath = path.join(TEMPLATES_DIR, storedName)
            await fs.writeFile(savedFilePath, Buffer.from(fileBase64, "base64"))
        }

        const created = await svc.create(userId, {
            name,
            contractType,
            sourceFilename,
            sourceFilePath: savedFilePath,
            structure,
        })

        return res.status(201).json({ success: true, data: created })
    } catch (err) {
        console.error("[template] create error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur lors de la création." })
    }
})

// PUT /:externalId — mise à jour de la structure
router.put("/:externalId", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        const { structure, name } = req.body as { structure?: TemplateStructure; name?: string }

        if (!structure) {
            return res.status(400).json({ success: false, message: "Le champ 'structure' est requis." })
        }

        const updated = await svc.updateStructure(userId, req.params["externalId"] as string, structure)
        if (!updated) return res.status(404).json({ success: false, message: "Template introuvable." })
        return res.json({ success: true, data: updated })
    } catch (err) {
        console.error("[template] update error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

// DELETE /:externalId
router.delete("/:externalId", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        await svc.delete(userId, req.params["externalId"] as string)
        return res.json({ success: true })
    } catch (err) {
        console.error("[template] delete error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

// ─── Playbook ────────────────────────────────────────────────────────────────

// GET /:externalId/playbook
router.get("/:externalId/playbook", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        const playbook = await playbookSvc.get(userId, req.params["externalId"] as string)
        return res.json({ success: true, data: playbook })
    } catch (err) {
        console.error("[template/playbook] get error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

// PUT /:externalId/playbook
router.put("/:externalId/playbook", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        const { rulesText, metadata } = req.body as { rulesText?: string; metadata?: unknown }
        if (typeof rulesText !== "string") {
            return res.status(400).json({ success: false, message: "rulesText requis." })
        }
        const playbook = await playbookSvc.upsert(
            userId,
            req.params["externalId"] as string,
            rulesText,
            metadata,
        )
        return res.json({ success: true, data: playbook })
    } catch (err) {
        console.error("[template/playbook] upsert error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

export default router
