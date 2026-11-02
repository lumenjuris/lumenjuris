import { callOpenAi52 } from "../../utils/openaiClient.js";
import { promptSummary } from "../../utils/templatePrompt.js";

/**
 * Synthèse IA de la fiche récapitulative d'un contrat acheté (Pack Contrat).
 *
 * Réutilise le prompt de l'outil « Comprendre contrat » (même analyse, même
 * structure JSON), avec gpt-5.2. Le niveau de risque est retiré : on ne note
 * pas un contrat que l'on vient de vendre (et ce serait un avis juridique).
 */
export type ContractPackSummary = {
  identification: unknown;
  resume_executif: string | null;
  parties: unknown;
  dates: unknown;
  objet: string | null;
  obligations: unknown;
  conditions_financieres: unknown;
  resiliation: unknown;
  responsabilite: unknown;
  clauses_particulieres: unknown;
  delais_importants: unknown;
  annexes: unknown;
  points_attention: unknown;
};

export async function summarizePurchasedContract(contractText: string, userId?: number): Promise<ContractPackSummary> {
  // Réflexion « low » : extraction factuelle, pas de raisonnement juridique attendu
  const raw = await callOpenAi52(promptSummary(contractText), "low", "low", "gpt-5.2", userId);
  const cleanedRaw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleanedRaw);
  } catch {
    console.error("[contract-pack] Réponse IA non JSON :", raw.slice(0, 500));
    throw new Error("Réponse IA invalide (JSON corrompu)");
  }

  // Le niveau de risque n'est jamais transmis à la fiche
  delete parsed.niveau_risque;
  return parsed as ContractPackSummary;
}
