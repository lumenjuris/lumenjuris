import { Router } from "express";
import { internalApiKeyMiddleware } from "../middleware/internalApiKeyMiddleware.js";
import { summarizePurchasedContract } from "../services/contractPack/contractPackSummary.js";

/**
 * Routes internes du Pack Contrat, appelées uniquement par le backNode
 * (jamais par le navigateur) : protégées par la clé interne.
 */
export const contractPackRouter: Router = Router();

// Synthèse IA de la fiche récapitulative d'un contrat acheté.
// Aucun quota consommé : la fiche fait partie de l'achat.
contractPackRouter.post("/summary", internalApiKeyMiddleware, async (req, res) => {
  const { contractText, userId } = req.body as { contractText?: unknown; userId?: unknown };

  if (typeof contractText !== "string" || !contractText.trim()) {
    res.status(400).json({ success: false, message: "Le texte du contrat est requis." });
    return;
  }

  try {
    const summary = await summarizePurchasedContract(
      contractText,
      typeof userId === "number" ? userId : undefined,
    );
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error("[contract-pack] Synthèse IA impossible :", error);
    res.status(502).json({ success: false, message: "La synthèse IA n'a pas pu être générée." });
  }
});
