/**
 * Structure des quotas d'un plan / d'un utilisateur (miroir de `CreditPlan`
 * défini côté backend dans seedPlans.ts). Deux natures d'entrées :
 *  - quotas À VALEUR : analyzer, contrathequeLimit ({unlimited,value}) et
 *    signatureEnhanced ({enabled,limit}) — consommables ;
 *  - features BOOLÉENNES : le reste ({enabled}) — simples droits d'accès.
 */

export type Quota = { unlimited: true } | { unlimited: false; value: number };
export type MeteredFeature = { enabled: false } | { enabled: true; limit: number };
export type BooleanFeature = { enabled: boolean };

export type PlanQuotas = {
  analyzer: Quota;
  signatureEnhanced: MeteredFeature;
  generationContractWithFiligrane: BooleanFeature;
  contrathequeLimit: Quota;
  suivisEcheance: BooleanFeature;
  dashboardRenouvellements: BooleanFeature;
  veilleReviewContract: BooleanFeature;
  internalWorkflowValidator: BooleanFeature;
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
  // Activée sans plafond (comptes administrateurs) : illimitée.
  return typeof q.limit === "number" ? { kind: "finite", value: q.limit } : { kind: "unlimited" };
}

/** Libellés FR des features à valeur (consommables). */
export const NUMERIC_FEATURES: { key: keyof PlanQuotas; label: string }[] = [
  { key: "analyzer", label: "Analyses de contrat" },
  { key: "signatureEnhanced", label: "Signatures électronique"},
  { key: "contrathequeLimit", label: "Contrathèque" },
];

/** Libellés FR des features booléennes (droits d'accès). */
export const BOOLEAN_FEATURES: { key: keyof PlanQuotas; label: string }[] = [
  { key: "generationContractWithFiligrane", label: "Génération avec filigrane" },
  { key: "suivisEcheance", label: "Suivi des échéances" },
  { key: "dashboardRenouvellements", label: "Dashboard renouvellements" },
  { key: "veilleReviewContract", label: "Veille juridique" },
  { key: "internalWorkflowValidator", label: "Workflow de validation interne" },
];
