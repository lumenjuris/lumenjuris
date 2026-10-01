import { Router } from "express"
import { withTracking, logOpenAiTokens } from "../tracking.js"
import { proxyAuthMiddleware } from "../middleware/authMiddleware.js";
import { relayJsonToPython } from "../relay.js";
import { callGpt5 } from "../utils/openaiResponses.js";


export const openaiRouter : Router = Router()


openaiRouter.post("/chat", proxyAuthMiddleware, (req, res) => {
  relayJsonToPython(req, res, "/chat", withTracking("chat", logOpenAiTokens));
});



openaiRouter.post("/openai-chat", proxyAuthMiddleware, (req, res) => {
  relayJsonToPython(req, res, "/openai-chat", withTracking("openai_chat", logOpenAiTokens))
});

// Questions et rédaction du générateur : appel direct d'OpenAI quand le relais a sa clé
// (voir utils/openaiResponses.ts), sans attendre le moteur Python (2 demandes à la fois en ligne).
const MODELS = new Set(["gpt-5.2", "gpt-5.4-nano"]);
const REASONINGS = new Set(["none", "low", "medium", "high", "xhigh"]);
const VERBOSITIES = new Set(["low", "medium", "high"]);

openaiRouter.post("/openai-chat-5", proxyAuthMiddleware, async (req, res) => {
  const { prompt, model, reasoning, verbosity } = req.body ?? {};
  if (typeof prompt !== "string" || !MODELS.has(model) || !REASONINGS.has(reasoning) || !VERBOSITIES.has(verbosity)) {
    res.status(400).json({ detail: "Requête OpenAI invalide" });
    return;
  }
  try {
    const data = await callGpt5({ prompt, model, reasoning, verbosity });
    await withTracking("openai_chat", logOpenAiTokens)(data, res.locals.userId as number | undefined);
    res.json(data);
  } catch (e) {
    console.error("[openai-chat-5]", (e as Error)?.message);
    res.status(502).json({ detail: "Service IA momentanément indisponible" });
  }
});
