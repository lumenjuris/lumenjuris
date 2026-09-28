import express from "express"
import type { Request, Response, Router, NextFunction } from "express"
import { authMiddleware } from "../middleware/authMiddleware.js"
import { PlaybookService } from "../services/classPlaybook.js"
import type { AnalysisInput, RuleInput } from "../services/classPlaybook.js"

const router: Router = express.Router()
const svc = new PlaybookService()

// RBAC : ADMIN/JURISTE/USER peuvent éditer ; LECTEUR lecture seule (comme la bibliothèque de clauses).
const EDITOR_ROLES = new Set(["ADMIN", "JURISTE", "USER"])
function requireEditor(req: Request, res: Response, next: NextFunction) {
    if (!EDITOR_ROLES.has(String(req.role))) {
        return res.status(403).json({ success: false, message: "Action réservée aux éditeurs (juriste/admin)." })
    }
    next()
}

/** Enveloppe commune : erreurs serveur journalisées et renvoyées proprement. */
function handler(nom: string, fn: (req: Request, res: Response) => Promise<unknown>) {
    return async (req: Request, res: Response) => {
        try {
            await fn(req, res)
        } catch (err) {
            console.error(`[playbook] ${nom} error:`, err)
            if (!res.headersSent) res.status(500).json({ success: false, message: "Erreur serveur." })
        }
    }
}

const uid = (req: Request) => Number(req.idUser)
const param = (req: Request, k: string) => req.params[k] as string
const query = (req: Request, k: string) => (typeof req.query[k] === "string" ? (req.query[k] as string) : undefined)

// ─── Playbooks ───

router.get("/playbooks", authMiddleware, handler("playbooks", async (req, res) => {
    res.json({ success: true, data: await svc.listPlaybooks(uid(req)) })
}))

router.post("/playbooks", authMiddleware, requireEditor, handler("create playbook", async (req, res) => {
    res.status(201).json({ success: true, data: await svc.createPlaybook(uid(req), req.body ?? {}) })
}))

router.patch("/playbooks/:externalId", authMiddleware, requireEditor, handler("rename playbook", async (req, res) => {
    const ok = await svc.renamePlaybook(uid(req), param(req, "externalId"), req.body ?? {})
    if (!ok) return res.status(404).json({ success: false, message: "Playbook introuvable." })
    res.json({ success: true })
}))

router.delete("/playbooks/:externalId", authMiddleware, requireEditor, handler("delete playbook", async (req, res) => {
    const r = await svc.deletePlaybook(uid(req), param(req, "externalId"))
    if (r === "introuvable") return res.status(404).json({ success: false, message: "Playbook introuvable." })
    if (r === "defaut") return res.status(400).json({ success: false, message: "Le playbook principal ne peut pas être supprimé." })
    res.json({ success: true })
}))

// ─── Règles ───

router.get("/rules", authMiddleware, handler("list", async (req, res) => {
    const data = await svc.list(uid(req), query(req, "active") === "true", query(req, "playbook"))
    if (!data) return res.status(404).json({ success: false, message: "Playbook introuvable." })
    res.json({ success: true, data })
}))

router.post("/rules", authMiddleware, requireEditor, handler("create", async (req, res) => {
    const body = req.body as RuleInput & { playbookId?: string }
    if (!body?.name || !String(body.name).trim()) {
        return res.status(400).json({ success: false, message: "Le nom de la règle est requis." })
    }
    const data = await svc.create(uid(req), body)
    if (!data) return res.status(404).json({ success: false, message: "Playbook introuvable." })
    res.status(201).json({ success: true, data })
}))

router.patch("/rules/:externalId", authMiddleware, requireEditor, handler("update", async (req, res) => {
    const data = await svc.update(uid(req), param(req, "externalId"), req.body as Partial<RuleInput>)
    if (!data) return res.status(404).json({ success: false, message: "Règle introuvable." })
    res.json({ success: true, data })
}))

router.delete("/rules/:externalId", authMiddleware, requireEditor, handler("delete", async (req, res) => {
    const ok = await svc.delete(uid(req), param(req, "externalId"))
    if (!ok) return res.status(404).json({ success: false, message: "Règle introuvable." })
    res.json({ success: true })
}))

// ─── Historique des analyses ───

router.get("/analyses", authMiddleware, handler("list analyses", async (req, res) => {
    res.json({ success: true, data: await svc.listAnalyses(uid(req)) })
}))

router.get("/analyses/:externalId", authMiddleware, handler("get analysis", async (req, res) => {
    const data = await svc.getAnalysis(uid(req), param(req, "externalId"))
    if (!data) return res.status(404).json({ success: false, message: "Analyse introuvable." })
    res.json({ success: true, data })
}))

router.post("/analyses", authMiddleware, handler("save analysis", async (req, res) => {
    const id = await svc.saveAnalysis(uid(req), req.body as AnalysisInput)
    res.status(201).json({ success: true, data: { id } })
}))

router.patch("/analyses/:externalId", authMiddleware, handler("update analysis", async (req, res) => {
    const id = await svc.saveAnalysis(uid(req), req.body as AnalysisInput, param(req, "externalId"))
    if (!id) return res.status(404).json({ success: false, message: "Analyse introuvable." })
    res.json({ success: true, data: { id } })
}))

router.delete("/analyses/:externalId", authMiddleware, handler("delete analysis", async (req, res) => {
    const ok = await svc.deleteAnalysis(uid(req), param(req, "externalId"))
    if (!ok) return res.status(404).json({ success: false, message: "Analyse introuvable." })
    res.json({ success: true })
}))

export default router
