import express from "express"
import type { Request, Response, Router, NextFunction } from "express"
import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import { authMiddleware } from "../middleware/authMiddleware.js"
import { ContractService } from "../services/classContract.js"
import type { ContractListFilters } from "../services/classContract.js"
import { encryptBuffer, decryptBuffer } from "../services/cryptoFile.js"

const router: Router = express.Router()
const svc = new ContractService()

const CONTRACTS_DIR = path.join(process.cwd(), "contracts")

// ─── RBAC ──────────────────────────────────────────────────────────────────────
// Rôles : ADMIN (tout), JURISTE/USER (édition), LECTEUR (lecture seule).

const EDITOR_ROLES = new Set(["ADMIN", "JURISTE", "USER"])

/** Autorise uniquement les rôles éditeurs (import, validation, édition, export). */
function requireEditor(req: Request, res: Response, next: NextFunction) {
    if (!EDITOR_ROLES.has(String(req.role))) {
        return res.status(403).json({ success: false, message: "Action réservée aux éditeurs (juriste/admin)." })
    }
    next()
}

/** Écrit un PDF chiffré sur le filesystem, retourne le chemin. */
async function storeEncryptedPdf(fileBase64: string): Promise<string> {
    await fs.mkdir(CONTRACTS_DIR, { recursive: true })
    const storedName = crypto.randomBytes(8).toString("hex") + ".pdf.enc"
    const filePath = path.join(CONTRACTS_DIR, storedName)
    const encrypted = encryptBuffer(Buffer.from(fileBase64, "base64"))
    await fs.writeFile(filePath, encrypted)
    return filePath
}

// ─── KPI / liste ────────────────────────────────────────────────────────────────

router.get("/stats", authMiddleware, async (req: Request, res: Response) => {
    try {
        const stats = await svc.stats(Number(req.idUser))
        return res.json({ success: true, data: stats })
    } catch (err) {
        console.error("[contract] stats error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

router.get("/deadlines", authMiddleware, async (req: Request, res: Response) => {
    try {
        const horizon = req.query["horizonDays"] ? Number(req.query["horizonDays"]) : 365
        const data = await svc.deadlines(Number(req.idUser), Number.isFinite(horizon) ? horizon : 365)
        return res.json({ success: true, data })
    } catch (err) {
        console.error("[contract] deadlines error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

/** Construit les filtres de liste depuis la query string. */
function parseFilters(req: Request): ContractListFilters {
    const q = req.query
    const str = (k: string) => (typeof q[k] === "string" ? (q[k] as string) : undefined)
    return {
        status: str("status") as ContractListFilters["status"],
        contractType: str("type"),
        counterpartyName: str("counterparty"),
        responsibleName: str("responsible"),
        folderExternalId: str("folder"),
        tagExternalIds: typeof q["tags"] === "string" ? (q["tags"] as string).split(",").filter(Boolean) : undefined,
        isB2C: str("isB2C") === "true" ? true : str("isB2C") === "false" ? false : undefined,
        q: str("q"),
        signedFrom: str("signedFrom"),
        signedTo: str("signedTo"),
        endFrom: str("endFrom"),
        endTo: str("endTo"),
        includeArchived: str("includeArchived") === "true",
        sortBy: str("sortBy") as ContractListFilters["sortBy"],
        sortDir: str("sortDir") === "asc" ? "asc" : "desc",
        page: str("page") ? Number(str("page")) : undefined,
        pageSize: str("pageSize") ? Number(str("pageSize")) : undefined,
    }
}

router.get("/", authMiddleware, async (req: Request, res: Response) => {
    try {
        const data = await svc.list(Number(req.idUser), parseFilters(req))
        return res.json({ success: true, data })
    } catch (err) {
        console.error("[contract] list error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

router.get("/export.csv", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    try {
        const csv = await svc.exportCsv(Number(req.idUser), parseFilters(req))
        await svc.audit(Number(req.idUser), "EXPORT", "Contract", "list", null, null, { format: "csv" })
        res.setHeader("Content-Type", "text/csv; charset=utf-8")
        res.setHeader("Content-Disposition", 'attachment; filename="contratheque.csv"')
        return res.send("﻿" + csv) // BOM pour Excel
    } catch (err) {
        console.error("[contract] export error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

// ─── Tags ─────────────────────────────────────────────────────────────────────

router.get("/tags", authMiddleware, async (req: Request, res: Response) => {
    return res.json({ success: true, data: await svc.listTags(Number(req.idUser)) })
})

router.post("/tags", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    const { label, color } = req.body as { label?: string; color?: string }
    if (!label) return res.status(400).json({ success: false, message: "label requis." })
    const r = await svc.createTag(Number(req.idUser), label, color || "#354F99")
    return res.status(201).json({ success: true, data: r })
})

router.delete("/tags/:externalId", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    const ok = await svc.deleteTag(Number(req.idUser), req.params["externalId"] as string)
    return res.json({ success: ok })
})

// ─── Dossiers ───────────────────────────────────────────────────────────────────

router.get("/folders", authMiddleware, async (req: Request, res: Response) => {
    return res.json({ success: true, data: await svc.listFolders(Number(req.idUser)) })
})

router.post("/folders", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    const { name, parentExternalId } = req.body as { name?: string; parentExternalId?: string }
    if (!name) return res.status(400).json({ success: false, message: "name requis." })
    const r = await svc.createFolder(Number(req.idUser), name, parentExternalId ?? null)
    return res.status(201).json({ success: true, data: r })
})

router.delete("/folders/:externalId", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    const ok = await svc.deleteFolder(Number(req.idUser), req.params["externalId"] as string)
    return res.json({ success: ok })
})

// ─── Création (après revue humaine) ─────────────────────────────────────────────

router.post("/", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    try {
        const body = req.body as Record<string, unknown> & { fileBase64?: string }
        if (!body.title) return res.status(400).json({ success: false, message: "title requis." })

        let documentFilePath: string | null = null
        if (body.fileBase64) documentFilePath = await storeEncryptedPdf(body.fileBase64)

        const r = await svc.create(Number(req.idUser), {
            ...(body as object),
            documentFilePath,
        } as Parameters<ContractService["create"]>[1])

        return res.status(201).json({ success: true, data: r })
    } catch (err) {
        console.error("[contract] create error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

// ─── Détail / document / mutations ──────────────────────────────────────────────

router.get("/:externalId", authMiddleware, async (req: Request, res: Response) => {
    const data = await svc.get(Number(req.idUser), req.params["externalId"] as string)
    if (!data) return res.status(404).json({ success: false, message: "Contrat introuvable." })
    return res.json({ success: true, data })
})

/** Télécharge le PDF déchiffré (et trace l'accès — RGPD). */
router.get("/:externalId/document", authMiddleware, async (req: Request, res: Response) => {
    try {
        const externalId = req.params["externalId"] as string
        const filePath = await svc.getDocumentPath(Number(req.idUser), externalId)
        if (!filePath) return res.status(404).json({ success: false, message: "Aucun document." })
        const encrypted = await fs.readFile(filePath)
        const pdf = decryptBuffer(encrypted)
        await svc.audit(Number(req.idUser), "DOCUMENT_ACCESS", "Contract", externalId, null, null, null)
        res.setHeader("Content-Type", "application/pdf")
        return res.send(pdf)
    } catch (err) {
        console.error("[contract] document error:", err)
        return res.status(500).json({ success: false, message: "Erreur serveur." })
    }
})

router.patch("/:externalId", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    const ok = await svc.update(Number(req.idUser), req.params["externalId"] as string, req.body)
    return res.json({ success: ok })
})

router.post("/:externalId/validate-field", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    const { fieldKey, value, status } = req.body as { fieldKey?: string; value?: string | null; status?: string }
    if (!fieldKey || !status) return res.status(400).json({ success: false, message: "fieldKey et status requis." })
    const ok = await svc.validateField(Number(req.idUser), req.params["externalId"] as string, fieldKey, value ?? null, status as "AI_SUGGESTED" | "HUMAN_VALIDATED" | "HUMAN_CORRECTED")
    return res.json({ success: ok })
})

router.post("/:externalId/amendment", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    const body = req.body as { title?: string; summary?: string; signatureDate?: string; effectiveDate?: string; fileBase64?: string }
    if (!body.title) return res.status(400).json({ success: false, message: "title requis." })
    let documentFilePath: string | null = null
    if (body.fileBase64) documentFilePath = await storeEncryptedPdf(body.fileBase64)
    const r = await svc.addAmendment(Number(req.idUser), req.params["externalId"] as string, {
        title: body.title,
        summary: body.summary,
        signatureDate: body.signatureDate,
        effectiveDate: body.effectiveDate,
        documentFilePath,
    })
    if (!r) return res.status(404).json({ success: false, message: "Contrat introuvable." })
    return res.status(201).json({ success: true, data: r })
})

router.post("/:externalId/version", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    const body = req.body as { note?: string; fileBase64?: string }
    let documentFilePath: string | null = null
    if (body.fileBase64) documentFilePath = await storeEncryptedPdf(body.fileBase64)
    const ok = await svc.addVersion(Number(req.idUser), req.params["externalId"] as string, { note: body.note, documentFilePath })
    return res.json({ success: ok })
})

/** Enregistre un instantané du texte courant (pour la comparaison de versions). */
router.post("/:externalId/snapshot", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    const body = req.body as { note?: string; contentText?: string | null }
    const ok = await svc.addSnapshot(Number(req.idUser), req.params["externalId"] as string, body.note ?? null, body.contentText ?? null)
    if (!ok) return res.status(404).json({ success: false, message: "Contrat introuvable." })
    return res.status(201).json({ success: true })
})

router.post("/:externalId/archive", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    const { archived } = req.body as { archived?: boolean }
    const ok = await svc.archive(Number(req.idUser), req.params["externalId"] as string, archived !== false)
    return res.json({ success: ok })
})

router.get("/:externalId/audit", authMiddleware, async (req: Request, res: Response) => {
    const data = await svc.listAudit(Number(req.idUser), req.params["externalId"] as string)
    return res.json({ success: true, data })
})

// ─── Négociation : commentaires collaboratifs ──────────────────────────────────

router.post("/:externalId/comments", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    const { body } = req.body as { body?: string }
    if (!body || !body.trim()) return res.status(400).json({ success: false, message: "Commentaire vide." })
    const data = await svc.addComment(Number(req.idUser), req.params["externalId"] as string, body)
    if (!data) return res.status(404).json({ success: false, message: "Contrat introuvable." })
    return res.status(201).json({ success: true, data })
})

// Placé AVANT `DELETE /:externalId` pour ne pas être capturé par ce dernier.
router.delete("/comments/:commentId", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    const ok = await svc.deleteComment(Number(req.idUser), req.params["commentId"] as string)
    return res.json({ success: ok })
})

router.patch("/comments/:commentId/resolve", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    const { resolved } = req.body as { resolved?: boolean }
    const ok = await svc.resolveComment(Number(req.idUser), req.params["commentId"] as string, resolved !== false)
    return res.json({ success: ok })
})

// ─── Négociation : workflow d'approbation ──────────────────────────────────────

router.post("/:externalId/approval", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    const { status, note } = req.body as { status?: string; note?: string | null }
    const valid = new Set(["DRAFT", "PENDING", "APPROVED", "REJECTED"])
    if (!status || !valid.has(status)) return res.status(400).json({ success: false, message: "Statut d'approbation invalide." })
    const ok = await svc.setApproval(Number(req.idUser), req.params["externalId"] as string, status as "DRAFT" | "PENDING" | "APPROVED" | "REJECTED", note ?? null)
    if (!ok) return res.status(404).json({ success: false, message: "Contrat introuvable." })
    await svc.audit(Number(req.idUser), "METADATA_UPDATE", "Contract", req.params["externalId"] as string, null, null, { approvalStatus: status })
    return res.json({ success: true })
})

// La suppression est filtrée par userId dans le service : un éditeur ne peut
// supprimer que ses propres contrats. (Avant : réservé aux admins.)
router.delete("/:externalId", authMiddleware, requireEditor, async (req: Request, res: Response) => {
    const ok = await svc.delete(Number(req.idUser), req.params["externalId"] as string)
    return res.json({ success: ok })
})

export default router
