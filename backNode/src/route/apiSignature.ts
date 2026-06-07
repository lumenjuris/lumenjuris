import express from "express"
import type { Request, Response, Router } from "express"
import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import nodemailer from "nodemailer"
import { authMiddleware } from "../middleware/authMiddleware"
import { SignatureEnvelopeService } from "../services/classSignatureEnvelope"
import type { EnvelopeFieldsPayload, EnvelopeStatusValue } from "../services/classSignatureEnvelope"

const router: Router = express.Router()
const svc = new SignatureEnvelopeService()

/**
 * Transporteur Gmail réutilisable. Utilise les credentials MAILER_USER /
 * MAILER_PASS (App Password Gmail) définis dans le .env.
 */
const mailer = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env["MAILER_USER"],
        pass: process.env["MAILER_PASS"],
    },
})

/**
 * Envoie l'email d'invitation à signer au cocontractant.
 * Fire-and-forget : les erreurs sont loguées mais ne bloquent pas la réponse HTTP.
 */
function sendSignatureInvite(opts: {
    selfName: string
    selfEmail: string
    counterpartyName: string
    counterpartyEmail: string
    documentName: string
}) {
    const subject = `${opts.selfName} vous invite à signer un document — ${opts.documentName}`
    const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px 24px;border:1px solid #e5e7eb;border-radius:12px">
      <div style="margin-bottom:24px">
        <span style="font-size:22px;font-weight:700;color:#354F99">LumenJuris</span>
        <span style="font-size:13px;color:#6b7280;margin-left:8px">· Signature électronique</span>
      </div>
      <p style="font-size:15px;color:#111827">Bonjour <strong>${opts.counterpartyName}</strong>,</p>
      <p style="font-size:14px;color:#374151;line-height:1.6">
        <strong>${opts.selfName}</strong> (<a href="mailto:${opts.selfEmail}" style="color:#354F99">${opts.selfEmail}</a>)
        vous a envoyé le document <strong>«&nbsp;${opts.documentName}&nbsp;»</strong> pour signature.
      </p>
      <p style="font-size:13px;color:#6b7280;margin-top:24px;border-top:1px solid #f3f4f6;padding-top:16px">
        Vous recevrez sous peu un lien sécurisé pour consulter et signer ce document.<br>
        Si vous n'attendiez pas ce message, vous pouvez l'ignorer.
      </p>
    </div>`

    mailer.sendMail({
        from: `"LumenJuris" <${process.env["MAILER_USER"]}>`,
        to: opts.counterpartyEmail,
        subject,
        html,
    }).then(() => {
        console.log(`[signature] email envoyé à ${opts.counterpartyEmail}`)
    }).catch((err: unknown) => {
        console.error("[signature] échec envoi email:", err)
    })
}

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
            selfName?: string
            selfEmail?: string
            counterpartyName?: string
            counterpartyEmail?: string
            selfSigned?: boolean
        }

        if (!body.documentName || !body.fileBase64 || !body.fields) {
            return res.status(400).json({ success: false, message: "documentName, fileBase64 et fields requis." })
        }
        if (!body.selfName || !body.selfEmail || !body.counterpartyName || !body.counterpartyEmail) {
            return res.status(400).json({ success: false, message: "Tous les champs des signataires sont requis." })
        }

        // Sauvegarde le PDF sur le filesystem (pas en DB pour ne pas alourdir)
        await fs.mkdir(ENVELOPES_DIR, { recursive: true })
        const storedName = crypto.randomBytes(8).toString("hex") + ".pdf"
        const filePath = path.join(ENVELOPES_DIR, storedName)
        await fs.writeFile(filePath, Buffer.from(body.fileBase64, "base64"))

        const dto = await svc.create(userId, {
            documentName: body.documentName,
            documentFilePath: filePath,
            numPages: body.numPages ?? 1,
            fields: body.fields,
            selfName: body.selfName.trim(),
            selfEmail: body.selfEmail.trim(),
            counterpartyName: body.counterpartyName.trim(),
            counterpartyEmail: body.counterpartyEmail.trim(),
            selfSigned: !!body.selfSigned,
        })
        // Envoi email fire-and-forget (ne bloque pas la réponse)
        sendSignatureInvite({
            selfName: body.selfName.trim(),
            selfEmail: body.selfEmail.trim(),
            counterpartyName: body.counterpartyName.trim(),
            counterpartyEmail: body.counterpartyEmail.trim(),
            documentName: body.documentName,
        })

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

export default router
