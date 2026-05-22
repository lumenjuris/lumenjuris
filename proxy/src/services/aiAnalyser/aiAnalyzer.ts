import type { ClauseRisk, AnalysisContext } from "./types.js";
import { buildClauseExtractionPromptForAI } from "./buildingPrompt.js";
import { parseAIResponse } from "./parsingData.js";

const IS_PROD = process.env.NODE_ENV === "production";
const BACKEND_URL = IS_PROD ? process.env.BACKEND_URL : "http://localhost:5678";
const BACKNODE_URL = IS_PROD ? process.env.BACKNODE_URL : "http://localhost:3020";

const RISK_PATTERNS = [
  { pattern: /pénalité|pénalités/gi, type: "Clause pénale", category: "penalty" as const, riskScore: 4 },
  { pattern: /résiliation|résilie|résilier/gi, type: "Résiliation", category: "termination" as const, riskScore: 3 },
  { pattern: /responsabilité|responsable/gi, type: "Responsabilité", category: "responsibility" as const, riskScore: 3 },
  { pattern: /confidentialité|confidentiel/gi, type: "Confidentialité", category: "confidentiality" as const, riskScore: 2 },
];

async function logTokens(model: string, inputTokens: number, outputTokens: number): Promise<void> {
  try {
    await fetch(
      `${BACKNODE_URL}/llm/increment/${encodeURIComponent(model)}/${Math.trunc(inputTokens)}/${Math.trunc(outputTokens)}`,
      { method: "PUT" },
    );
  } catch {
    // token logging is best-effort
  }
}

async function callPythonOpenAi(prompt: string): Promise<string> {
  const r = await fetch(`${BACKEND_URL}/openai-chat-5`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, reasoning: "none", verbosity: "low", model: "gpt-5.2" }),
  });

  if (!r.ok) throw new Error(`Python backend error ${r.status}`);

  const data = (await r.json()) as { content?: string; openai_tokens?: { model?: string; input_tokens?: number; output_tokens?: number } };

  if (data.openai_tokens?.model) {
    void logTokens(
      data.openai_tokens.model,
      data.openai_tokens.input_tokens ?? 0,
      data.openai_tokens.output_tokens ?? 0,
    );
  }

  return data.content ?? "";
}

function localFallback(content: string): ClauseRisk[] {
  return RISK_PATTERNS
    .filter(({ pattern }) => content.match(pattern))
    .map(({ type, category, riskScore }, index) => ({
      id: `local-${index}-${Date.now()}`,
      type,
      content: `Clause ${type.toLowerCase()} détectée`,
      riskScore,
      category,
      justification: "Détection par analyse locale",
      suggestion: "Révision recommandée",
      page: 1,
      keywords: [type.toLowerCase()],
    }));
}

export async function analyzeContractWithAI(
  content: string,
  context?: AnalysisContext,
): Promise<ClauseRisk[]> {
  const totalAttempts = 3;

  try {
    for (let i = 0; i < totalAttempts; i++) {
      const retryState = i > 1;
      const prompt = buildClauseExtractionPromptForAI(
        "CONTRAT À ANALYSER:",
        content,
        context,
        retryState,
      );

      const responseText = await callPythonOpenAi(prompt);
      const clauses = parseAIResponse(responseText);

      if (clauses.length > 0) return clauses;
    }

    return [];
  } catch {
    return localFallback(content);
  }
}
