import { fetchProxy } from "./fetchProxy";
import { readQuotaValue, type PlanQuotas } from "../types/quotas";

/**
 * Features pouvant être bloquées faute de crédits (quota épuisé) ou parce que
 * la formule ne les inclut pas (droit d'accès). Les clés correspondent à celles
 * utilisées côté serveur (proxy `hasQuota` / backNode `hasFeatureQuota`).
 */
export type QuotaFeature =
  | "analyzer"
  | "analyzerPlaybook"
  | "comprendreContrat"
  | "generatorFromScratch"
  | "generatorImport"
  | "signature"
  | "chatJuridique"
  | "contrathequeLimit";

/**
 * Titre + message affichés dans la QuotaLimitModal, par feature. Centralisés ici
 * pour garder un discours cohérent partout.
 *
 * `chatJuridique` est un droit d'accès booléen (inclus ou non dans la formule),
 * pas un compteur : son message parle donc d'une fonctionnalité non active, et
 * non d'un quota épuisé.
 */
export const QUOTA_LIMIT_MESSAGES: Record<QuotaFeature, { title: string; message: string }> = {
  analyzer: {
    title: "Limite d'analyses atteinte",
    message:
      "Votre formule ne permet plus d'analyser de contrat ce mois-ci. Passez à une formule supérieure pour continuer.",
  },
  analyzerPlaybook: {
    title: "Limite d'analyses playbook atteinte",
    message:
      "Votre formule ne permet plus d'analyse playbook ce mois-ci. Passez à une formule supérieure pour continuer.",
  },
  comprendreContrat: {
    title: "Limite de résumés atteinte",
    message:
      "Votre formule ne permet plus de résumer de contrat ce mois-ci. Passez à une formule supérieure pour continuer.",
  },
  generatorFromScratch: {
    title: "Limite de contrats générés atteinte",
    message:
      "Votre formule ne permet plus de générer de contrat ce mois-ci. Passez à une formule supérieure pour continuer.",
  },
  generatorImport: {
    title: "Limite d'imports atteinte",
    message:
      "Votre formule ne permet plus d'importer de modèle ce mois-ci. Passez à une formule supérieure pour continuer.",
  },
  signature: {
    title: "Limite de signatures atteinte",
    message:
      "Votre formule ne permet plus d'envoyer de contrat à signer ce mois-ci. Passez à une formule supérieure pour continuer.",
  },
  chatJuridique: {
    title: "Fonctionnalité non incluse",
    message:
      "Cette fonctionnalité n'est pas active sur votre plan d'abonnement. Passez à une formule supérieure pour y accéder.",
  },
  contrathequeLimit: {
    title: "Contrathèque pleine",
    message:
      "Vous avez atteint le nombre maximal de contrats suivis sur votre formule. Passez à une formule supérieure pour en ajouter davantage.",
  },
};

/**
 * Erreur levée par les couches d'accès API quand le serveur refuse l'action
 * faute de quota / de droit d'accès (réponse HTTP 402). Elle porte la feature
 * concernée pour que l'UI affiche le bon message via la QuotaLimitModal.
 */
export class QuotaExceededError extends Error {
  feature: QuotaFeature;

  constructor(feature: QuotaFeature, message?: string) {
    super(message ?? QUOTA_LIMIT_MESSAGES[feature].message);
    this.name = "QuotaExceededError";
    this.feature = feature;
  }
}

/**
 * Lève QuotaExceededError si la réponse du proxy signale un blocage de quota
 * (HTTP 402). À appeler juste après `fetchProxy`, avant de lire le corps utile :
 * le corps n'est consommé que dans le cas 402 (sinon la réponse reste lisible
 * par l'appelant).
 */
export async function throwIfQuotaExceeded(res: Response, feature: QuotaFeature): Promise<void> {
  if (res.status === 402) {
    await res.json().catch(() => ({}));
    throw new QuotaExceededError(feature);
  }
}

/**
 * Indique si le crédit d'une feature est épuisé (ou la feature non incluse),
 * pour bloquer tôt côté UX avant de lancer une action coûteuse.
 *
 * Fail-open : en cas d'erreur (réseau, réponse invalide), renvoie `false` — le
 * serveur reste le garde-fou (il renverra un 402). Purement UX.
 */
export async function isFeatureExhausted(feature: QuotaFeature): Promise<boolean> {
  try {
    const res = await fetchProxy("/api/billing/credits", {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = await res.json();
    const quotas = data?.data?.quotas as PlanQuotas | undefined;
    if (!quotas) return false;
    const state = readQuotaValue(quotas[feature] as never);
    if (state.kind === "finite") return state.value <= 0;
    if (state.kind === "disabled") return true;
    return false; // illimité
  } catch {
    return false; // fail-open
  }
}
