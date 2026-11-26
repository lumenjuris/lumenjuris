/**
 * Types repris de la plateforme LumenJuris (front/src/types/index.ts et
 * proxy/src/services/aiAnalyser/types.ts) — identiques pour que le complément
 * consomme les MÊMES endpoints du proxy que la page « Analyse des risques ».
 */

/** Clause à risque détectée par l'analyseur (= ClauseRisk plateforme). */
export interface ClauseRisk {
  id: string;
  type: string;
  content: string;
  /** Score de risque 1 (faible) → 5 (critique). */
  riskScore: number;
  justification: string;
  suggestion: string;
  legalReference?: string | string[];
  category?: string;
  keywords?: string[];
  startIndex?: number;
  endIndex?: number;
  reponse_question_specifique?: string;
}

/** Détail IA d'une clause (= ClauseAI plateforme). */
export interface ClauseAI {
  summary: string;
  riskLevel: "High" | "Medium" | "Low";
  riskScore: number;
  litigation: string;
  issues: string[];
  advice: string;
  alternatives: AltProposal[];
  error?: string;
}

export interface AltProposal {
  clause: string;
  benefits: string;
  riskReduction: string;
}

/** Recommandation de clause alternative (= Recommendation plateforme). */
export interface Recommendation {
  title: string;
  clauseText: string;
  benefits: string;
  riskReduction: string;
}

/** Décision de jurisprudence (= JurisprudenceCase plateforme). */
export interface JurisprudenceCase {
  id: string;
  title: string;
  citation?: string;
  court: string;
  year?: number;
  relevanceScore: number;
  summary: string;
  url: string;
  keyPrinciples?: string[];
  date?: string;
  litige?: string;
  resultat?: string;
}

/** Contexte d'analyse (= AnalysisContext plateforme). */
export interface AnalysisContext {
  contractType: string;
  industry?: string;
  userRole: string;
  missionContext?: string;
  specificQuestions: string;
  specificConcerns?: string[];
  analysisDepth: "quick" | "detailed" | "expert";
  interestOrientation: "defensive" | "balanced" | "assertive";
  mission?: string;
  legalRegime?: string;
  contractObjective?: string;
}

/* ---------------- Génération de contrat « de zéro » (= front/generateur/contractAi.ts) ---------------- */

/** Question de cadrage posée avant la rédaction. */
export interface WizardQuestion {
  id: string;
  question: string;
  type: "choice" | "text";
  options?: string[];
  /** Exemple de réponse (question "text") ou explication courte (question "choice"). */
  hint?: string;
}

/** Importance d'un champ à remplir : pilote l'affichage (optionnels repliés). */
export type ImportanceChamp = "obligatoire" | "recommande" | "optionnel";

/** Donnée factuelle à compléter, présente dans le texte sous la forme {{id}}. */
export interface DraftVariable {
  id: string;
  label: string;
  importance?: ImportanceChamp;
}

export interface DraftSection {
  heading?: string;
  content: string;
}

/** Contrat rédigé par l'IA, structuré en articles. */
export interface ContractDraft {
  title: string;
  variables: DraftVariable[];
  sections: DraftSection[];
}
