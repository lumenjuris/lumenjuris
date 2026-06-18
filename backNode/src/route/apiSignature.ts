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
 * L'émetteur (senderEmail) reçoit une copie (CC) du même email.
 * Fire-and-forget : les erreurs sont loguées mais ne bloquent pas la réponse HTTP.
 */
function sendSignatureInvite(opts: {
    senderEmail: string
    counterpartyName: string
    counterpartyEmail: string
    documentName: string
    signingLink: string
}) {
    const subject = `Document à signer — ${opts.documentName}`
    const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px 24px;border:1px solid #e5e7eb;border-radius:12px">
      <div style="margin-bottom:24px">
        <span style="font-size:22px;font-weight:700;color:#354F99">LumenJuris</span>
        <span style="font-size:13px;color:#6b7280;margin-left:8px">· Signature électronique</span>
      </div>
      <p style="font-size:15px;color:#111827">Bonjour <strong>${opts.counterpartyName}</strong>,</p>
      <p style="font-size:14px;color:#374151;line-height:1.6">
        Vous avez reçu le document <strong>«&nbsp;${opts.documentName}&nbsp;»</strong> pour signature
        via la plateforme LumenJuris.
      </p>
      <div style="text-align:center;margin:28px 0">
        <a href="${opts.signingLink}"
           style="display:inline-block;background:#354F99;color:#fff;font-size:15px;font-weight:700;
                  padding:14px 32px;border-radius:10px;text-decoration:none;letter-spacing:0.01em">
          ✍️ Signer le document
        </a>
      </div>
      <p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:8px;word-break:break-all">
        Lien : <a href="${opts.signingLink}" style="color:#354F99">${opts.signingLink}</a>
      </p>
      <p style="font-size:13px;color:#6b7280;margin-top:24px;border-top:1px solid #f3f4f6;padding-top:16px">
        Si vous n'attendiez pas ce message, vous pouvez l'ignorer.
      </p>
    </div>`

    mailer.sendMail({
        from: `"LumenJuris" <${process.env["MAILER_USER"]}>`,
        to: opts.counterpartyEmail,
        cc: opts.senderEmail,          // l'émetteur reçoit une copie
        subject,
        html,
    }).then(() => {
        console.log(`[signature] email envoyé à ${opts.counterpartyEmail} (CC: ${opts.senderEmail})`)
    }).catch((err: unknown) => {
        console.error("[signature] échec envoi email:", err)
    })
}

/**
 * Envoie un email de confirmation aux DEUX parties une fois le document
 * entièrement signé. Le PDF original est joint en pièce jointe.
 * Fire-and-forget : les erreurs sont loguées mais ne bloquent pas la réponse HTTP.
 */
async function sendSignatureCompletion(opts: {
    documentName: string
    selfName: string
    selfEmail: string
    counterpartyName: string
    counterpartyEmail: string
    documentFilePath: string | null
}) {
    // Charge le PDF pour la pièce jointe (optionnel — on envoie sans si absent)
    let pdfBuffer: Buffer | undefined
    if (opts.documentFilePath) {
        try {
            pdfBuffer = await fs.readFile(opts.documentFilePath)
        } catch {
            console.warn("[signature] PDF introuvable pour la pièce jointe:", opts.documentFilePath)
        }
    }

    const attachment = pdfBuffer
        ? [{ filename: `${opts.documentName}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
        : []

    const dateStr = new Date().toLocaleDateString("fr-FR", {
        day: "numeric", month: "long", year: "numeric",
    })

    const subject = `Document signé — ${opts.documentName}`

    const buildHtml = (recipientName: string) => `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px 24px;
                border:1px solid #e5e7eb;border-radius:12px">
      <div style="margin-bottom:24px">
        <span style="font-size:22px;font-weight:700;color:#354F99">LumenJuris</span>
        <span style="font-size:13px;color:#6b7280;margin-left:8px">· Signature électronique</span>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;
                  padding:16px 20px;margin-bottom:24px">
        <p style="margin:0;font-size:15px;font-weight:700;color:#166534">
          Document signé par les deux parties
        </p>
      </div>
      <p style="font-size:15px;color:#111827">Bonjour <strong>${recipientName}</strong>,</p>
      <p style="font-size:14px;color:#374151;line-height:1.6">
        Le document <strong>«&nbsp;${opts.documentName}&nbsp;»</strong> a été signé
        par les deux parties le <strong>${dateStr}</strong>.
      </p>
      <p style="font-size:14px;color:#374151;line-height:1.6;margin-top:8px">
        Signataires :
        <br>• <strong>${opts.selfName || opts.selfEmail}</strong> (émetteur)
        <br>• <strong>${opts.counterpartyName}</strong> (cocontractant)
      </p>
      ${pdfBuffer
        ? `<p style="font-size:13px;color:#6b7280;margin-top:16px">
             Le document signé est joint en pièce jointe à cet email (PDF).
           </p>`
        : ""}
      <p style="font-size:13px;color:#9ca3af;margin-top:24px;border-top:1px solid #f3f4f6;
                padding-top:16px">
        Cet email est envoyé automatiquement par la plateforme LumenJuris. Conservez-le
        comme preuve de signature.
      </p>
    </div>`

    const sends = [
        mailer.sendMail({
            from: `"LumenJuris" <${process.env["MAILER_USER"]}>`,
            to: opts.selfEmail,
            subject,
            html: buildHtml(opts.selfName || opts.selfEmail),
            attachments: attachment,
        }),
        mailer.sendMail({
            from: `"LumenJuris" <${process.env["MAILER_USER"]}>`,
            to: opts.counterpartyEmail,
            subject,
            html: buildHtml(opts.counterpartyName),
            attachments: attachment,
        }),
    ]

    Promise.all(sends)
        .then(() => {
            console.log(`[signature] emails de complétion envoyés → ${opts.selfEmail}, ${opts.counterpartyEmail}`)
        })
        .catch((err: unknown) => {
            console.error("[signature] échec envoi emails de complétion:", err)
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
            counterpartyName?: string
            counterpartyEmail?: string
            selfSigned?: boolean
        }

        if (!body.documentName || !body.fileBase64 || !body.fields) {
            return res.status(400).json({ success: false, message: "documentName, fileBase64 et fields requis." })
        }
        if (!body.counterpartyName || !body.counterpartyEmail) {
            return res.status(400).json({ success: false, message: "Nom et email du cocontractant requis." })
        }

        // Sauvegarde le PDF sur le filesystem (pas en DB pour ne pas alourdir)
        await fs.mkdir(ENVELOPES_DIR, { recursive: true })
        const storedName = crypto.randomBytes(8).toString("hex") + ".pdf"
        const filePath = path.join(ENVELOPES_DIR, storedName)
        await fs.writeFile(filePath, Buffer.from(body.fileBase64, "base64"))

        // Récupère l'email de l'utilisateur connecté pour le mettre en CC
        const userEmail = (req as Request & { email?: string }).email ?? process.env["MAILER_USER"] ?? ""

        const dto = await svc.create(userId, {
            documentName: body.documentName,
            documentFilePath: filePath,
            numPages: body.numPages ?? 1,
            fields: body.fields,
            selfName: "",
            selfEmail: userEmail,
            counterpartyName: body.counterpartyName.trim(),
            counterpartyEmail: body.counterpartyEmail.trim(),
            selfSigned: !!body.selfSigned,
        })
        // Construire le lien de signature public
        const frontUrl = process.env["HOST_FRONT"] ?? "http://localhost:5173"
        const signingLink = `${frontUrl}/signer/${dto.signingToken}`

        // Envoi email fire-and-forget (ne bloque pas la réponse)
        sendSignatureInvite({
            senderEmail: userEmail,
            counterpartyName: body.counterpartyName.trim(),
            counterpartyEmail: body.counterpartyEmail.trim(),
            documentName: body.documentName,
            signingLink,
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

        // Récupère le chemin du PDF pour la pièce jointe (fire-and-forget)
        svc.getByToken(token).then((fullData) => {
            sendSignatureCompletion({
                documentName: dto.documentName,
                selfName: dto.selfName,
                selfEmail: dto.selfEmail,
                counterpartyName: dto.counterpartyName,
                counterpartyEmail: dto.counterpartyEmail,
                documentFilePath: fullData?.documentFilePath ?? null,
            })
        }).catch((err: unknown) => {
            console.error("[signature] impossible de charger les données pour l'email de complétion:", err)
        })

        return res.json({ success: true, data: dto })
    } catch (err) {
        console.error("[signature/public] sign error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

export default router
