import express from "express"
import type { Request, Response, Router, NextFunction } from "express"
import { authMiddleware } from "../middleware/authMiddleware.js"
import { ClauseService } from "../services/classClause.js"
import type { ClauseListFilters, ClauseInput } from "../services/classClause.js"

const router: Router = express.Router()
const svc = new ClauseService()

// RBAC : ADMIN/JURISTE/USER peuvent éditer ; LECTEUR lecture seule.
const EDITOR_ROLES = new Set(["ADMIN", "JURISTE", "USER"])
function requireEditor(req: Request, res: Response, next: NextFunction) {
    if (!EDITOR_ROLES.has(String(req.role))) {
        return res.status(403).json({ success: false, message: "Action réservée aux éditeurs (juriste/admin)." })
    }
    next()
}

function parseFilters(req: Request): ClauseListFilters {
    const q = req.query
    const str = (k: string) => (typeof q[k] === "string" ? (q[k] as string) : undefined)
    return {
        category: str("category") as ClauseListFilters["category"],
        position: str("position") as ClauseListFilters["position"],
        onlyApproved: str("onlyApproved") === "true",
        q: str("q"),
    }
}

router.get("/stats", authMiddleware, async (req: Request, res: Response) => {
    try {
        return res.json({ success: true, data: await svc.stats(Number(req.idUser)) })
    } catch (err) {
        console.error("[clause] stats error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

router.get("/", authMiddleware, async (req: Request, res: Response) => {
    try {
        return res.json({ success: true, data: await svc.list(Number(req.idUser), parseFilters(req)) })
    } catch (err) {
        console.error("[clause] list error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

router.get("/:externalId", authMiddleware, async (req: Request, res: Response) => {
    const data = await svc.get(Number(req.idUser), req.params["externalId"] as string)
    if (!data) return res.status(404).json({ success: false, message: "Clause introuvable." })
    return res.json({ success: true, data })
})

router.post("/", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    try {
        const body = req.body as ClauseInput
        if (!body.title || !body.body) {
            return res.status(400).json({ success: false, message: "title et body requis." })
        }
        const data = await svc.create(Number(req.idUser), body)
        return res.status(201).json({ success: true, data })
    } catch (err) {
        console.error("[clause] create error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

router.patch("/:externalId", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    const ok = await svc.update(Number(req.idUser), req.params["externalId"] as string, req.body as Partial<ClauseInput>)
    if (!ok) return res.status(404).json({ success: false, message: "Clause introuvable." })
    return res.json({ success: true })
})

router.post("/:externalId/use", authMiddleware, async (req: Request, res: Response) => {
    const ok = await svc.incrementUsage(Number(req.idUser), req.params["externalId"] as string)
    return res.json({ success: ok })
})

router.delete("/:externalId", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    const ok = await svc.delete(Number(req.idUser), req.params["externalId"] as string)
    return res.json({ success: ok })
})

export default router
