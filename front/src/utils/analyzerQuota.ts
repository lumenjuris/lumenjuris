import { fetchProxy } from "./fetchProxy";
import { readQuotaValue, type PlanQuotas } from "../types/quotas";

/**
 * Indique si le quota d'analyses de contrat de l'utilisateur est épuisé.
 * Utilisé pour bloquer tôt côté UX (avant de lancer une analyse ou d'ouvrir
 * l'analyzer).
 *
 * Fail-open : en cas d'erreur (réseau, réponse invalide), renvoie `false` — le
 * serveur `/analyze-contract` reste le garde-fou (renvoie un 402). Purement UX.
 */
export async function isAnalyzerQuotaExhausted(): Promise<boolean> {
  try {
    const res = await fetchProxy("/api/billing/credits", {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = await res.json();
    const quotas = data?.data?.quotas as PlanQuotas | undefined;
    if (!quotas) return false;
    const analyzer = readQuotaValue(quotas.analyzer);
    if (analyzer.kind === "finite") return analyzer.value <= 0;
    if (analyzer.kind === "disabled") return true;
    return false; // illimité
  } catch {
    return false; // fail-open
  }
}
