import express from "express"
import type { Request, Response, Router, NextFunction } from "express"
import { prisma } from "../../prisma/singletonPrisma.js"
import { authMiddleware } from "../middleware/authMiddleware.js"

const router: Router = express.Router()

const VALID_ROLES = new Set(["ADMIN", "JURISTE", "USER", "LECTEUR"])

/**
 * Réserve l'accès aux administrateurs.
 * Le rôle est vérifié EN BASE (et non depuis le token JWT) : un changement de
 * rôle prend effet immédiatement, sans attendre une reconnexion, et un token
 * périmé ne peut pas être utilisé pour une élévation de privilèges.
 */
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    try {
        const user = await prisma.user.findUnique({
            where: { idUser: Number(req.idUser) },
            select: { role: true },
        })
        if (!user || user.role !== "ADMIN") {
            return res.status(403).json({ success: false, message: "Action réservée aux administrateurs." })
        }
        next()
    } catch (err) {
        console.error("[admin] requireAdmin error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
}

/** GET /admin/users — liste tous les utilisateurs (mono-entreprise). */
router.get("/users", authMiddleware, requireAdmin, async (_req: Request, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            select: { idUser: true, email: true, nom: true, prenom: true, role: true, isVerified: true },
            orderBy: { idUser: "asc" },
        })
        return res.json({ success: true, data: users })
    } catch (err) {
        console.error("[admin] list users error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

/** PATCH /admin/users/:idUser/role — change le rôle d'un utilisateur. */
router.patch("/users/:idUser/role", authMiddleware, requireAdmin, async (req: Request, res: Response) => {
    try {
        const targetId = Number(req.params["idUser"])
        const { role } = req.body as { role?: string }
        if (!role || !VALID_ROLES.has(role)) {
            return res.status(400).json({ success: false, message: "Rôle invalide." })
        }
        // Garde-fou : un admin ne peut pas se rétrograder lui-même (évite de perdre le dernier admin).
        if (targetId === Number(req.idUser) && role !== "ADMIN") {
            return res.status(400).json({ success: false, message: "Vous ne pouvez pas modifier votre propre rôle d'administrateur." })
        }
        const target = await prisma.user.findUnique({ where: { idUser: targetId }, select: { idUser: true } })
        if (!target) return res.status(404).json({ success: false, message: "Utilisateur introuvable." })

        await prisma.user.update({ where: { idUser: targetId }, data: { role: role as "ADMIN" | "JURISTE" | "USER" | "LECTEUR" } })
        return res.json({ success: true })
    } catch (err) {
        console.error("[admin] update role error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

export default router
