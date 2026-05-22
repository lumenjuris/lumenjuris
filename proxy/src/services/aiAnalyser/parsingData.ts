import type { ClauseRisk } from "./types.js";

export function parseAIResponse(response: string): ClauseRisk[] {
  let cleanedText = response.trim();
  if (cleanedText.startsWith("```json")) cleanedText = cleanedText.substring(7).trim();
  if (cleanedText.endsWith("```")) cleanedText = cleanedText.slice(0, -3).trim();

  try {
    const parsedResponse = JSON.parse(cleanedText);
    if (!parsedResponse.clauses || !Array.isArray(parsedResponse.clauses)) {
      return [];
    }

    const clauses: ClauseRisk[] = [];
    parsedResponse.clauses.forEach((parsed: Record<string, unknown>, index: number) => {
      if (
        parsed.type &&
        parsed.text &&
        parsed.riskScore &&
        typeof parsed.startIndex === "number" &&
        typeof parsed.endIndex === "number" &&
        Array.isArray(parsed.keywords)
      ) {
        clauses.push({
          id: `ai-clause-${Date.now()}-${index}`,
          type: parsed.type as string,
          content: parsed.text as string,
          riskScore: Math.min(5, Math.max(1, parsed.riskScore as number)),
          category: mapTypeToCategory(parsed.type as string),
          justification: (parsed.justification as string) || "Clause identifiée par IA",
          suggestion: (parsed.suggestion as string) || "Révision recommandée",
          page: 1,
          keywords: parsed.keywords as string[],
          startIndex: parsed.startIndex as number,
          endIndex: parsed.endIndex as number,
        });
      }
    });

    return clauses;
  } catch {
    return [];
  }
}

function mapTypeToCategory(
  type: string,
): ClauseRisk["category"] {
  const typeMap: Record<string, ClauseRisk["category"]> = {
    résiliation: "termination",
    pénalité: "penalty",
    responsabilité: "responsibility",
    confidentialité: "confidentiality",
    "non-concurrence": "nonCompete",
    garantie: "warranty",
  };
  const normalized = type.toLowerCase();
  for (const [key, category] of Object.entries(typeMap)) {
    if (normalized.includes(key)) return category;
  }
  return "other";
}
