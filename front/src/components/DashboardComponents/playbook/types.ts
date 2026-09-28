/** Playbook : règles de négociation internes comparées aux contrats analysés. */

export type RuleType = "MAX" | "MIN" | "REQUIRED" | "FORBIDDEN" | "ALLOWED_VALUES" | "INSTRUCTION";
export type RuleSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface PlaybookInfo {
  id: string;
  name: string;
  contractType: string | null;
  isDefault: boolean;
  ruleCount: number;
  activeCount: number;
}

export interface PlaybookRule {
  id: string;
  playbookId: string;
  name: string;
  category: string;
  description: string | null;
  ruleType: RuleType;
  expectedValue: string | null;
  unit: string | null;
  severity: RuleSeverity;
  suggestion: string | null;
  keywords: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RuleInput = Partial<Omit<PlaybookRule, "id" | "createdAt" | "updatedAt">> & { name: string };

/** Catégories proposées ; l'utilisateur peut aussi en saisir une autre. */
export const PLAYBOOK_CATEGORIES = [
  "Paiement", "Rémunération", "Commission", "Durée", "Renouvellement", "Résiliation",
  "Exclusivité", "Non-concurrence", "Territoire", "Propriété intellectuelle", "Droit à l'image",
  "Cession de droits", "Confidentialité", "Responsabilité", "Indemnisation", "Garanties",
  "Intelligence artificielle", "Utilisation de l'image ou de la voix", "Juridiction",
  "Loi applicable", "Délais", "Obligations particulières", "Autre",
];

export const RULE_TYPE_LABEL: Record<RuleType, string> = {
  MAX: "Valeur maximale",
  MIN: "Valeur minimale",
  REQUIRED: "Clause obligatoire",
  FORBIDDEN: "Interdit",
  ALLOWED_VALUES: "Valeurs autorisées",
  INSTRUCTION: "Consigne libre",
};

/** Aide affichée sous le champ « Valeur », selon le type choisi. */
export const RULE_TYPE_HINT: Record<RuleType, string> = {
  MAX: "ex. 24 mois, 30 jours",
  MIN: "ex. 15 %",
  REQUIRED: "ex. possibilité de résiliation pour chaque partie",
  FORBIDDEN: "ex. utilisation de l'image pour entraîner une IA",
  ALLOWED_VALUES: "ex. France, Union européenne",
  INSTRUCTION: "ex. tout usage sur produits physiques exige une autorisation spécifique",
};

export const SEVERITY_LABEL: Record<RuleSeverity, string> = { HIGH: "Élevée", MEDIUM: "Moyenne", LOW: "Faible" };

export const SEVERITY_STYLE: Record<RuleSeverity, string> = {
  HIGH: "bg-danger-light text-danger-dark",
  MEDIUM: "bg-amber-50 text-amber-800",
  LOW: "bg-surface-subtle text-ink-secondary",
};

// ─── Résultat d'une analyse playbook (renvoyé par /api/playbook/check) ───

export type Compliance = "compliant" | "non_compliant" | "to_check";

export interface PlaybookFinding {
  rule_id: string;
  rule_name: string;
  category: string;
  status: Compliance;
  confidence: number;
  clause: string;
  contract_excerpt: string;
  detected_value: string;
  expected_value: string;
  explanation: string;
  recommendation: string;
  replacement: string;
  severity: RuleSeverity;
}

export interface PlaybookCheckResult {
  totalRules: number;
  relevantRules: number;
  findings: PlaybookFinding[];
  summary: { analysed: number; compliant: number; nonCompliant: number; toCheck: number };
}

// ─── Historique des analyses ───

/** Ce qui est enregistré pour rouvrir une analyse telle qu'on l'a laissée. */
export interface AnalysisSnapshot {
  /** Texte du contrat, suggestions appliquées comprises. */
  text: string;
  result: PlaybookCheckResult;
  /** Règle → texte (éventuellement retouché) mis à la place du passage d'origine. */
  applied: Record<string, string>;
}

export interface PlaybookAnalysisSummary {
  id: string;
  fileName: string;
  playbookName: string | null;
  compliant: number;
  nonCompliant: number;
  toCheck: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlaybookAnalysisDetail {
  id: string;
  fileName: string;
  playbookId: string | null;
  playbookName: string | null;
  snapshot: AnalysisSnapshot;
  createdAt: string;
}
