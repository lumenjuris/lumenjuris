import { Router, type Request, type Response } from "express";
import { proxyAuthMiddleware as auth } from "../middleware/authMiddleware.js";
import { BACKEND_URL } from "../config.js";
import { logOpenAiTokens, withTracking } from "../tracking.js";
import type { PythonJsonResponse } from "../relay.js";
import { callGpt5, type Gpt5Request } from "../utils/openaiResponses.js";
import {
  buildCddClausePrompt,
  buildContractInstructionPrompt,
  buildConventionPrompt,
  buildFieldDraftPrompt,
  buildReformulationPrompt,
  buildClauseAnalysisPrompt,
  buildAddinClauseDetailPrompt,
  buildAddinQuestionPrompt,
} from "../services/assistant/assistantPrompts.js";

// Monté sur "/api/assistant" — petites aides IA de l'application.
// Les prompts sont construits ici (services/assistant/assistantPrompts.ts) :
// le front n'envoie que des données et reçoit { content }.
export const assistantRouter: Router = Router();

/** Lit un champ texte du body ; renvoie "" s'il est absent ou invalide. */
function readText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Appelle GPT-5 avec le prompt et les réglages donnés, puis renvoie { content }. */
async function answerWithGpt5(
  res: Response,
  feature: string,
  request: Gpt5Request,
): Promise<void> {
  try {
    const data = await callGpt5(request);
    await withTracking(feature, logOpenAiTokens)(data, res.locals.userId as number | undefined);
    res.json({ content: data.content });
  } catch (e) {
    console.error(`[assistant/${feature}]`, (e as Error)?.message);
    res.status(502).json({ detail: "Service IA momentanément indisponible" });
  }
}

/** Refuse la requête (400) si un des champs obligatoires est vide. */
function hasRequiredFields(res: Response, fields: Record<string, string>): boolean {
  const missing = Object.entries(fields).filter(([, value]) => !value.trim()).map(([name]) => name);
  if (missing.length > 0) {
    res.status(400).json({ detail: `Champ(s) requis : ${missing.join(", ")}.` });
    return false;
  }
  return true;
}

// ─── Éditeur de CDD ──────────────────────────────────────────────────────────

// Modification d'une clause de CDD selon une consigne.
assistantRouter.post("/cdd-clause", auth, (req: Request, res: Response) => {
  const clauseText = readText(req.body?.clauseText);
  const instruction = readText(req.body?.instruction);
  if (!hasRequiredFields(res, { clauseText, instruction })) return;

  // gpt-5.4-nano : modèle très rapide ; réflexion « medium » pour une modification
  // juridiquement soignée sans allonger sensiblement l'attente.
  void answerWithGpt5(res, "cdd_clause", {
    prompt: buildCddClausePrompt(clauseText, instruction),
    model: "gpt-5.4-nano",
    reasoning: "medium",
    verbosity: "medium",
  });
});

// Modification globale d'un contrat selon une consigne.
assistantRouter.post("/contract-instruction", auth, (req: Request, res: Response) => {
  const contractText = readText(req.body?.contractText);
  const instruction = readText(req.body?.instruction);
  if (!hasRequiredFields(res, { contractText, instruction })) return;

  void answerWithGpt5(res, "contract_instruction", {
    prompt: buildContractInstructionPrompt(contractText, instruction),
    model: "gpt-5.2",
    reasoning: "medium",
    verbosity: "medium",
  });
});

// Vérification de la convention collective d'un CDD.
assistantRouter.post("/cdd-convention", auth, (req: Request, res: Response) => {
  void answerWithGpt5(res, "cdd_convention", {
    prompt: buildConventionPrompt(
      readText(req.body?.convention),
      readText(req.body?.poste),
      readText(req.body?.naf),
    ),
    model: "gpt-5.2",
    reasoning: "low",
    verbosity: "low",
  });
});

// Rédaction du contenu d'un champ à remplir.
assistantRouter.post("/field-draft", auth, (req: Request, res: Response) => {
  const fieldLabel = readText(req.body?.fieldLabel);
  if (!hasRequiredFields(res, { fieldLabel })) return;

  const knownFields = (Array.isArray(req.body?.knownFields) ? req.body.knownFields : [])
    .filter((field: any) => typeof field?.label === "string" && typeof field?.value === "string")
    .slice(0, 30);

  void answerWithGpt5(res, "field_draft", {
    prompt: buildFieldDraftPrompt(
      readText(req.body?.contractTitle),
      fieldLabel,
      readText(req.body?.sentence),
      knownFields,
    ),
    model: "gpt-5.4-nano",
    reasoning: "low",
    verbosity: "low",
  });
});

// ─── Contrathèque ────────────────────────────────────────────────────────────

// Reformulation d'une clause (consigne facultative).
assistantRouter.post("/reformulate-clause", auth, (req: Request, res: Response) => {
  const clauseText = readText(req.body?.clauseText);
  if (!hasRequiredFields(res, { clauseText })) return;

  void answerWithGpt5(res, "reformulate_clause", {
    prompt: buildReformulationPrompt(clauseText, readText(req.body?.instruction)),
    model: "gpt-5.4-nano",
    reasoning: "none",
    verbosity: "medium",
  });
});

// ─── Analyse détaillée d'une clause (analyzer) ───────────────────────────────

const GPT5_MODELS = new Set(["gpt-5.2", "gpt-5.4-nano"]);
const GPT4_MODELS = new Set(["gpt-4o", "gpt-4o-mini"]);

// Analyse d'une clause en JSON. Le modèle est choisi par l'utilisateur dans l'analyzer.
assistantRouter.post("/clause-analysis", auth, async (req: Request, res: Response) => {
  const clauseText = readText(req.body?.clauseText);
  const model = readText(req.body?.model) || "gpt-4o";
  if (!hasRequiredFields(res, { clauseText })) return;

  const prompt = buildClauseAnalysisPrompt(clauseText);

  if (GPT5_MODELS.has(model)) {
    await answerWithGpt5(res, "clause_analysis", {
      prompt,
      model: model as Gpt5Request["model"],
      reasoning: "medium",
      verbosity: "medium",
    });
    return;
  }

  if (!GPT4_MODELS.has(model)) {
    res.status(400).json({ detail: "Modèle IA inconnu." });
    return;
  }

  // gpt-4o / gpt-4o-mini : passent par le moteur Python (route /openai-chat).
  try {
    const pythonRes = await fetch(`${BACKEND_URL}/openai-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });
    const data = (await pythonRes.json().catch(() => ({}))) as PythonJsonResponse;
    if (!pythonRes.ok) throw new Error(`Python backend error ${pythonRes.status}`);
    await withTracking("clause_analysis", logOpenAiTokens)(data, res.locals.userId as number | undefined);
    res.json({ content: data.content ?? "" });
  } catch (e) {
    console.error("[assistant/clause_analysis]", (e as Error)?.message);
    res.status(502).json({ detail: "Service IA momentanément indisponible" });
  }
});

// ─── Complément Word ─────────────────────────────────────────────────────────
// reasoning "none" = réglage de la plateforme pour gpt-5.4-nano : même qualité
// de sortie, latence réduite.

// Détail d'une clause (JSON : résumé, risque, problèmes, conseil, alternatives).
assistantRouter.post("/addin-clause-detail", auth, (req: Request, res: Response) => {
  const clauseText = readText(req.body?.clauseText);
  if (!hasRequiredFields(res, { clauseText })) return;

  void answerWithGpt5(res, "addin_clause_detail", {
    prompt: buildAddinClauseDetailPrompt(clauseText),
    model: "gpt-5.4-nano",
    reasoning: "none",
    verbosity: "low",
  });
});

// Question libre du juriste sur une clause.
assistantRouter.post("/addin-question", auth, (req: Request, res: Response) => {
  const clauseText = readText(req.body?.clauseText);
  const question = readText(req.body?.question);
  if (!hasRequiredFields(res, { clauseText, question })) return;

  void answerWithGpt5(res, "addin_question", {
    prompt: buildAddinQuestionPrompt(
      clauseText,
      readText(req.body?.clauseType),
      readText(req.body?.justification),
      question,
    ),
    model: "gpt-5.4-nano",
    reasoning: "low",
    verbosity: "low",
  });
});
