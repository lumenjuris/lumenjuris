import { Router } from "express"
import { withTracking, logOpenAiTokens } from "../tracking.js"
import { proxyAuthMiddleware } from "../middleware/authMiddleware.js";
import { relayJsonToPython } from "../relay.js";
import { hasQuota } from "../quota.js";
import { CHAT_JURIDIQUE_CONTEXT, buildClauseChatContext } from "../services/assistant/assistantPrompts.js";

// Monté sur "/api/openai" — chats uniquement.
// Aucune route n'accepte de prompt ou de contexte libre venant du client : le
// contexte du modèle est toujours construit ici (services/assistant/assistantPrompts.ts).
// Les autres aides IA sont dans routes/assistant.ts (/api/assistant).
export const openaiRouter : Router = Router()

// Page « Chat juridique » : réservée aux plans qui incluent chatJuridique
// (simple droit d'accès, rien n'est décompté).
openaiRouter.post("/chat-juridique", proxyAuthMiddleware, async (req, res) => {
  const userId = res.locals.userId as number | undefined;
  if (userId && !(await hasQuota("chatJuridique", userId))) {
    const message = "Le chat juridique n'est pas inclus dans votre formule. Passez à un plan supérieur pour y accéder.";
    res.status(402).json({ success: false, code: "QUOTA_EXCEEDED", message, detail: message });
    return;
  }
  // Le contexte est fixé ici : celui éventuellement envoyé par le client est ignoré.
  req.body = { ...req.body, context: CHAT_JURIDIQUE_CONTEXT };
  relayJsonToPython(req, res, "/chat", withTracking("chat", logOpenAiTokens));
});

// Chat sur une clause (analyzer) : le front envoie le texte de la clause,
// le contexte du modèle est construit ici.
openaiRouter.post("/chat-clause", proxyAuthMiddleware, (req, res) => {
  const clauseText = typeof req.body?.clauseText === "string" ? req.body.clauseText : "";
  if (!clauseText.trim()) {
    res.status(400).json({ detail: "Le champ 'clauseText' est requis." });
    return;
  }
  req.body = {
    message: req.body?.message,
    model: req.body?.model,
    context: buildClauseChatContext(clauseText),
  };
  relayJsonToPython(req, res, "/chat", withTracking("chat", logOpenAiTokens));
});
