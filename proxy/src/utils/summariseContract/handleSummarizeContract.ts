
import { type Request, Response } from "express"
import { summarizeContract } from "../contractSummarizer.js";
import { hasQuota, consumeQuota } from "../../quota.js";


export async function handleSummarizeContract(req: Request, res: Response): Promise<void> {


    const { content, fileName, selectedLlm } = req.body as { content?: string; fileName?: string, selectedLlm: string };
    const BACKNODE_URL = process.env.BACKNODE_URL

    if (!content || typeof content !== "string") {
        res.status(400).json({ success: false, message: "Le champs 'content' est requis." });
        return;
    }

    if (!selectedLlm || typeof selectedLlm !== "string") {
        res.status(400).json({ success: false, message: "Aucun llm n'a été attribué." });
    }

    const userId = res.locals.userId;
    if (!userId) {
        res.status(401).json({ success: false, message: "Utilisateur non authentifié." });
        return;
    }

    // Quota : 1 résumé = 1 crédit "comprendreContrat", vérifié AVANT l'appel IA.
    if (!(await hasQuota("comprendreContrat", userId))) {
        res.status(402).json({
            success: false,
            code: "QUOTA_EXCEEDED",
            message: "Quota de résumés de contrat épuisé. Passez à un plan supérieur pour continuer.",
        });
        return;
    }

    try {
        const data = await summarizeContract(content, selectedLlm ?? "gpt-4o-mini");

        // Décrément après succès uniquement.
        await consumeQuota("comprendreContrat", userId, 1);

        const response = await fetch(`${BACKNODE_URL}/contract/contract-summary`, {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
                "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
                "x-user-id": String(userId),
                "x-user-role": String(res.locals.role ?? "USER"),
            },
            body: JSON.stringify({ summary: data, fileName, rawText: content }),
        })

        if (!response.ok) {
            console.error("[PROXY] Echec de la sauvegarde back-node : ", response.status, response.text());
        }

        res.json({ success: true, data });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Erreur interne";
        res.status(500).json({ success: false, message: message });
    }
}