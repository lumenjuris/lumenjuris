/**
 * Lecture du niveau de risque d'une analyse et mise en forme associée.
 *
 * Ces fonctions sont partagées par le tableau des analyses et par la vue
 * mobile de la page conformité, d'où ce fichier à part.
 */

/** Niveau de risque affiché, déduit du score global de l'analyse. */
export type RiskLevel = "Élevé" | "Moyen" | "Faible" | "—";

/** Le score est un niveau de risque : plus il est haut, plus le contrat est exposé. */
export function getRiskLevel(score?: number): RiskLevel {
  if (score === undefined || score === null) return "—";
  if (score >= 60) return "Élevé";
  if (score >= 30) return "Moyen";
  return "Faible";
}

export function getRiskStyles(level: RiskLevel): string {
  switch (level) {
    case "Élevé": return "text-danger-dark border-danger/20 bg-danger-light";
    case "Moyen": return "text-warning-dark border-warning/20 bg-warning-light";
    case "Faible": return "text-success-dark border-success/20 bg-success-light";
    default: return "text-ink-subtle border-line bg-surface-muted";
  }
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(date);
}
