/**
 * Structure des quotas d'un plan / d'un utilisateur (miroir de `CreditPlan`
 * défini côté backend dans prisma/seedPlans.ts). Trois natures d'entrées :
 *  - quotas À VALEUR ({unlimited,value}) : décomptés à l'usage, sauf
 *    contrathequeLimit qui est un plafond de contrats suivis ;
 *  - feature réservée + quota ({enabled,value}) : signatureEnhanced ;
 *  - features BOOLÉENNES ({enabled}) : simples droits d'accès.
 */

export type Quota = { unlimited: true } | { unlimited: false; value: number };
export type MeteredFeature = { enabled: false } | { enabled: true; value: number };
export type BooleanFeature = { enabled: boolean };

export type PlanQuotas = {
  analyzer: Quota;
  analyzerPlaybook: Quota;
  contrathequeLimit: Quota;
  generatorFromScratch: Quota;
  generatorImport: Quota;
  signature: Quota;
  comprendreContrat: Quota;
  chatJuridique: BooleanFeature;
  generationContractWithFiligrane: BooleanFeature;
  signatureEnhanced: MeteredFeature;
};

/** Valeur normalisée d'un quota à valeur, pour l'affichage. */
export type QuotaValue =
  | { kind: "unlimited" }
  | { kind: "disabled" } // feature non incluse dans le plan
  | { kind: "finite"; value: number };

/** Lit un quota à valeur (analyzer/contrathequeLimit) ou mesuré (signatureEnhanced). */
export function readQuotaValue(
  q: Quota | MeteredFeature | undefined | null,
): QuotaValue {
  if (!q) return { kind: "disabled" };
  if ("unlimited" in q) {
    return q.unlimited ? { kind: "unlimited" } : { kind: "finite", value: q.value };
  }
  if (!q.enabled) return { kind: "disabled" };
  // Les anciens crédits en base utilisent encore "limit" au lieu de "value".
  const remaining = q.value ?? (q as { limit?: number }).limit;
  // Activée sans plafond (comptes administrateurs) : illimitée.
  return typeof remaining === "number" ? { kind: "finite", value: remaining } : { kind: "unlimited" };
}

/** Libellés FR des features à valeur (consommables ou plafond). */
export const NUMERIC_FEATURES: { key: keyof PlanQuotas; label: string }[] = [
  { key: "analyzer", label: "Analyses de contrat" },
  { key: "analyzerPlaybook", label: "Analyses avec playbook" },
  { key: "comprendreContrat", label: "Résumés de contrat" },
  { key: "generatorFromScratch", label: "Contrats générés" },
  { key: "generatorImport", label: "Modèles importés" },
  { key: "signature", label: "Signatures électroniques" },
  { key: "contrathequeLimit", label: "Contrathèque" },
];

/**
 * Libellés FR des features booléennes (droits d'accès).
 * `isRestriction` : la feature est une contrainte (activée = moins bien), on
 * affiche donc l'avantage inverse comme « inclus » quand elle est désactivée.
 */
export const BOOLEAN_FEATURES: {
  key: keyof PlanQuotas;
  label: string;
  isRestriction?: boolean;
}[] = [
  { key: "chatJuridique", label: "Chat juridique" },
  {
    key: "generationContractWithFiligrane",
    label: "Contrats générés sans filigrane",
    isRestriction: true,
  },
];
