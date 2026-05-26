import type { ClauseRisk } from "../types";
import { fetchProxy } from "./fetchProxy";

export interface MissingClause {
  nom: string;
  importance: "obligatoire" | "recommandé" | "utile";
  explicationAbsence: string;
  standardMarche: string;
  suggestionAjout: string;
  priorite: "critique" | "important" | "mineur";
}

export interface MarketDeviation {
  clause: string;
  votreContrat: string;
  standard: string;
  ecart: "favorable" | "défavorable" | "neutre";
  recommandation: string;
  impact: "faible" | "moyen" | "élevé";
}

export interface ContextualQuestion {
  question: string;
  contexte: string;
  urgence: "haute" | "moyenne" | "basse";
  categorie: "risque" | "manque" | "clarification" | "negociation";
}

export interface MarketAnalysisResult {
  clausesManquantes: MissingClause[];
  scoreConformite: number;
}

export async function performCompleteMarketAnalysis(
  contractText: string,
  contractType: string,
  detectedClauses: ClauseRisk[],
): Promise<MarketAnalysisResult> {
  const res = await fetchProxy("/api/market-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ contractText, contractType, detectedClauses }),
  });
  if (!res.ok) throw new Error(`market-analysis error ${res.status}`);
  return (await res.json()) as MarketAnalysisResult;
}
