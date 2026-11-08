import { Router } from "express"
import { relayToNode } from "../relay.js"
import { proxyAuthMiddleware as auth } from "../middleware/authMiddleware.js"


export const addinRouter: Router = Router()

/**
 * Login du complément Word : mêmes identifiants que la plateforme, mais le
 * JWT est renvoyé dans le corps (l'iframe Word ne peut pas recevoir le cookie
 * httpOnly cross-site). Le token est ensuite passé en Authorization: Bearer.
 */
addinRouter.post(["/login", "/session"], async (req, res) => {
    try {

        const BACKNODE_URL = process.env.BACKNODE_URL

        const { email, password } = req.body as {
            email?: string;
            password?: string;
        };
        if (!email || !password) {
            res
                .status(400)
                .json({ success: false, message: "E-mail et mot de passe requis." });
            return;
        }
        const r = await fetch(`${BACKNODE_URL}/user/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-internal-api-key": process.env.INTERNAL_API_KEY ?? "",
            },
            body: JSON.stringify({ email, password }),
        });
        const data = (await r.json().catch(() => ({}))) as {
            success?: boolean;
            twoFactorRequired?: boolean;
            data?: { idUser?: number; email?: string };
            message?: string;
        };
        if (!r.ok || !data.success || !data.data?.idUser) {
            res.status(401).json({
                success: false,
                message: data.message || "Identifiants invalides.",
            });
            return;
        }
        if (data.twoFactorRequired) {
            res.status(403).json({
                success: false,
                message:
                    "Ce compte a la double authentification activée : utilisez un compte sans 2FA pour le complément Word (POC).",
            });
            return;
        }
        const jwt = (await import("jsonwebtoken")).default;
        const token = jwt.sign(
            { userId: data.data.idUser, role: "USER" },
            process.env.JWT_SECRET!,
            {
                expiresIn: "7d",
            },
        );
        res.json({
            success: true,
            token,
            user: { idUser: data.data.idUser, email: data.data.email },
        });
    } catch (error) {
        console.error("addin/login error:", error);
        res.status(500).json({
            success: false,
            message: "Erreur interne lors de la connexion.",
        });
    }
});