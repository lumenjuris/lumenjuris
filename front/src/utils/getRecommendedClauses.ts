import type { ClauseRisk, ClauseRecommendation } from "../types";
import type { AnalysisContext } from "../types/contextualAnalysis";
import { fetchProxy } from "./fetchProxy";
import type { OpenAIModelId } from "./aiClient";

export type { ClauseRecommendation };

export async function getRecommendedClauses(
  clause: ClauseRisk,
  context?: AnalysisContext,
  model: OpenAIModelId = "gpt-4o",
): Promise<ClauseRecommendation[]> {
  const res = await fetchProxy("/api/recommend-clause", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ clause, context, model }),
  });
  if (!res.ok) throw new Error(`recommend-clause error ${res.status}`);
  return (await res.json()) as ClauseRecommendation[];
}
