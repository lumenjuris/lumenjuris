import express from "express"
import type { Request, Response, Router } from "express"
import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import { authMiddleware } from "../middleware/authMiddleware.js"
import { Mailer } from "../infrastructure/mailer/classMailer.js"
import { SignatureEnvelopeService } from "../services/classSignatureEnvelope.js"
import type { EnvelopeFieldsPayload, EnvelopeStatusValue } from "../services/classSignatureEnvelope.js"
import { prisma } from "../../prisma/singletonPrisma.js"

const router: Router = express.Router()
const svc = new SignatureEnvelopeService()

const ENVELOPES_DIR = path.join(process.cwd(), "signatureenvelopes")

/** GET /signature-envelope/stats — agrégats pour le dashboard. */
router.get("/stats", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        const stats = await svc.stats(userId)
        return res.json({ success: true, data: stats })
    } catch (err) {
        console.error("[signature] stats error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

/**
 * GET /signature-envelope?status=DRAFT|SENT|...
 * Liste des enveloppes de l'utilisateur, optionnellement filtrées par statut.
 */
router.get("/", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        const statusRaw = req.query["status"] as string | undefined
        const status = isValidStatus(statusRaw) ? (statusRaw as EnvelopeStatusValue) : undefined
        const list = await svc.list(userId, status)
        return res.json({ success: true, data: list })
    } catch (err) {
        console.error("[signature] list error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

/**
 * POST /signature-envelope
 * Crée une nouvelle enveloppe. Reçoit le PDF en base64 (sauvegardé sur disque)
 * + les champs/signatures (chiffrés en DB) + les coordonnées des signataires.
 */
router.post("/", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        const body = req.body as {
            documentName?: string
            fileBase64?: string
            numPages?: number
            fields?: EnvelopeFieldsPayload
            counterpartyName?: string
            counterpartyEmail?: string
            selfSigned?: boolean
        }

        if (!body.documentName || !body.fileBase64 || !body.fields) {
            return res.status(400).json({ success: false, message: "documentName, fileBase64 et fields requis." })
        }
        if (!body.counterpartyName || !body.counterpartyEmail) {
            return res.status(400).json({ success: false, message: "Nom et e-mail du cocontractant requis." })
        }

        // Sauvegarde le PDF sur le filesystem (pas en DB pour ne pas alourdir)
        await fs.mkdir(ENVELOPES_DIR, { recursive: true })
        const storedName = crypto.randomBytes(8).toString("hex") + ".pdf"
        const filePath = path.join(ENVELOPES_DIR, storedName)
        await fs.writeFile(filePath, Buffer.from(body.fileBase64, "base64"))

        // Récupère l'email de l'utilisateur connecté pour le mettre en CC
        const user = await prisma.user.findUnique({
            where: {idUser: userId},
            select: {
                email: true,
                prenom: true,
                nom: true,
            },
        });

        if (!user?.email) {
            throw new Error ("L'e-mail de l'utilisateur est introuvable.");
        }

        const selfName = [user.prenom, user.nom].filter(Boolean).join(" ").trim();

        const dto = await svc.create(userId, {
            documentName: body.documentName,
            documentFilePath: filePath,
            numPages: body.numPages ?? 1,
            fields: body.fields,
            selfName: selfName,
            selfEmail: user.email,
            counterpartyName: body.counterpartyName.trim(),
            counterpartyEmail: body.counterpartyEmail.trim(),
            selfSigned: !!body.selfSigned,
        })
        // Construire le lien de signature public
        const frontUrl = process.env["HOST_FRONT"] ?? "http://localhost:5173"
        const signingLink = `${frontUrl}/signer/${dto.signingToken}`

        // Envoi email fire-and-forget (ne bloque pas la réponse). L'émetteur
        // reçoit une copie via le CC.
        new Mailer(body.counterpartyEmail.trim())
            .sendSignatureInvite({
                counterpartyName: body.counterpartyName.trim(),
                documentName: body.documentName,
                signingLink,
            })
            .catch((err: unknown) => console.error("[signature] échec envoi invitation:", err))

        return res.status(201).json({ success: true, data: dto })
    } catch (err) {
        console.error("[signature] create error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

/** DELETE /signature-envelope/:externalId */
router.delete("/:externalId", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        await svc.delete(userId, req.params["externalId"] as string)
        return res.json({ success: true })
    } catch (err) {
        console.error("[signature] delete error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

/** Garde-fou : seuls les statuts attendus sont acceptés en filtre. */
function isValidStatus(s: string | undefined): boolean {
    return s === "DRAFT" || s === "SENT" || s === "PARTIALLY_SIGNED"
        || s === "SIGNED" || s === "DECLINED" || s === "EXPIRED"
}

// ─── Routes PUBLIQUES (sans auth) pour la page de signature cocontractant ──────

/**
 * GET /public/sign/:token
 * Retourne les métadonnées de l'enveloppe + les champs (déchiffrés) + le PDF
 * en base64. Accessible sans cookie d'auth — le token est le secret.
 */
router.get("/public/:token", async (req: Request, res: Response) => {
    try {
        const token = req.params["token"] as string
        const result = await svc.getByToken(token)
        if (!result) return res.status(404).json({ success: false, message: "Lien invalide ou expiré." })

        // Charge le PDF en base64 si le fichier existe
        let fileBase64: string | null = null
        if (result.documentFilePath) {
            try {
                const buf = await fs.readFile(result.documentFilePath)
                fileBase64 = buf.toString("base64")
            } catch { /* fichier absent → null */ }
        }

        return res.json({ success: true, data: { meta: result.meta, fields: result.fields, fileBase64 } })
    } catch (err) {
        console.error("[signature/public] get error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

/**
 * POST /public/sign/:token
 * Le cocontractant soumet ses signatures. Passe l'enveloppe en statut SIGNED.
 * Déclenche ensuite un email aux deux parties avec le PDF signé en pièce jointe.
 */
router.post("/public/:token", async (req: Request, res: Response) => {
    try {
        const token = req.params["token"] as string
        const { fields } = req.body as { fields?: EnvelopeFieldsPayload }
        if (!fields) return res.status(400).json({ success: false, message: "fields requis." })
        const dto = await svc.signByToken(token, fields)
        if (!dto) return res.status(404).json({ success: false, message: "Lien invalide ou expiré." })

        // Confirmation aux deux parties (fire-and-forget) : on charge le PDF
        // pour la pièce jointe puis on notifie chaque partie via le Mailer.
        svc.getByToken(token).then(async (fullData) => {
            let pdf: { filename: string; content: Buffer } | undefined
            if (fullData?.documentFilePath) {
                try {
                    pdf = { filename: `${dto.documentName}.pdf`, content: await fs.readFile(fullData.documentFilePath) }
                } catch {
                    console.warn("[signature] PDF introuvable pour la pièce jointe:", fullData.documentFilePath)
                }
            }

            const selfLabel = dto.selfName || dto.selfEmail
            const signedDate = dto.completedAt ? new Date(dto.completedAt) : new Date()
            const common = {
                documentName: dto.documentName,
                selfLabel,
                counterpartyName: dto.counterpartyName,
                signedDate,
                pdf,
            }

            new Mailer(dto.selfEmail)
                .sendSignatureCompletion({ recipientName: selfLabel, ...common })
                .catch((err: unknown) => console.error("[signature] échec confirmation (émetteur):", err))
            new Mailer(dto.counterpartyEmail)
                .sendSignatureCompletion({ recipientName: dto.counterpartyName, ...common })
                .catch((err: unknown) => console.error("[signature] échec confirmation (cocontractant):", err))
        }).catch((err: unknown) => {
            console.error("[signature] impossible de charger les données pour l'email de complétion:", err)
        })

        return res.json({ success: true, data: dto })
    } catch (err) {
        console.error("[signature/public] sign error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})


/**
 * GET /download/:externalId
 * Renvoie le contrat « aplati » (PDF original + signatures incrustées) afin que
 * l'utilisateur puisse le télécharger. Le PDF est généré à la volée : les
 * signatures ne sont jamais stockées fusionnées sur disque.
 */
router.get("/download/:externalId", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        const externalId = req.params["externalId"] as string

        const result = await svc.generateSignedPdf(userId, externalId)
        if (!result) {
            return res.status(404).json({ success: false, message: "Enveloppe introuvable ou document manquant." })
        }

        // Nom de fichier propre : on retire l'extension et les caractères gênants.
        const baseName = result.documentName.replace(/\.pdf$/i, "").replace(/[^\w.\- ]+/g, "_").trim() || "document"
        res.setHeader("Content-Type", "application/pdf")
        res.setHeader("Content-Disposition", `attachment; filename="${baseName}_signe.pdf"`)
        return res.send(result.buffer)
    } catch (err: unknown) {
        console.error("[Signature-download] - Une erreur est survenue lors de la route backend err:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

/**
 * POST /resend
 * Renvoie l'email d'invitation à signer au cocontractant pour une enveloppe
 * existante. Bloqué si le document est déjà signé par les deux parties.
 */
router.post("/resend", authMiddleware, async (req: Request, res: Response) => {
    try {
        const userId = Number(req.idUser)
        const { externalId } = req.body as { externalId?: string }
        if (!externalId) {
            return res.status(400).json({ success: false, message: "externalId requis." })
        }

        const envelope = await svc.get(userId, externalId)
        if (!envelope) {
            return res.status(404).json({ success: false, message: "Enveloppe introuvable." })
        }

        const { meta } = envelope
        // On bloque le renvoi si le document est déjà signé par les deux parties.
        if (meta.status === "SIGNED") {
            return res.status(409).json({ success: false, message: "Ce document est déjà signé par les deux parties." })
        }

        // Réutilise le lien + l'email d'invitation de la création. L'email de
        // l'émetteur (CC) est repris depuis l'enveloppe (selfEmail) plutôt que
        // du token courant, pour rester fiable dans le temps.
        const frontUrl = process.env["HOST_FRONT"] ?? "http://localhost:5173"
        const signingLink = `${frontUrl}/signer/${meta.signingToken}`

        new Mailer(meta.counterpartyEmail)
            .sendSignatureInvite({
                counterpartyName: meta.counterpartyName,
                documentName: meta.documentName,
                signingLink,
            })
            .catch((err: unknown) => console.error("[signature] échec renvoi invitation:", err))

        return res.json({ success: true })
    } catch (err: unknown) {
        console.error("[Signature] - Une erreur backend est survenue lors du resend d'une enveloppe, error : ", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})
export default router
