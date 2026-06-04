import type { AnalysisContext } from "../types/contextualAnalysis";
import { fetchProxy } from "./fetchProxy";

export async function detectContractWithAI(
  text: string,
): Promise<AnalysisContext> {
  const res = await fetchProxy("/api/detect-contract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`detect-contract error ${res.status}`);
  return (await res.json()) as AnalysisContext;
}
