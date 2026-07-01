/**
 * Moteur de contrat — types GÉNÉRIQUES (réutilisables pour tout type de contrat).
 *
 * Taxonomie (cf. spec produit) :
 *  - Variables  : remplissage inline, avec validations conditionnelles.
 *  - Alternatives : arbitrage entre rédactions valides d'un même bloc (marge).
 *  - Décisions  : points de fond à fort enjeu, « traités » et tracés (marge).
 *  - Dépendances : règles déclaratives (un choix contraint/active ailleurs).
 *
 * Rien d'ici n'est spécifique au CDD : un modèle concret (ex. CDD accroissement)
 * n'est qu'une instance de `ContractModel`.
 */

// ─── Conditions déclaratives ──────────────────────────────────────────────────

export type Condition =
  | { var: string; op: "eq" | "neq" | "in" | "gt" | "lt" | "gte" | "lte"; value: string | number | string[] }
  | { decision: string; is: DecisionResolution }
  | { alternative: string; is: string } // option choisie
  | { block: string; is: "active" | "removed" }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

// ─── Variables (inline) ───────────────────────────────────────────────────────

export type VarType = "text" | "date" | "number" | "money" | "duration";

/** Contrainte (éventuellement conditionnelle) attachée à une variable. */
export interface VariableConstraint {
  /** Si présent, la contrainte ne s'applique que lorsque la condition est vraie. */
  when?: Condition;
  max?: number;
  min?: number;
  required?: boolean;
  /** Message d'aide affiché si la contrainte est violée. */
  message?: string;
}

export interface VariableDef {
  id: string;
  label: string;
  type: VarType;
  default?: string;
  placeholder?: string;
  constraints?: VariableConstraint[];
}

// ─── Alternatives (marge) ─────────────────────────────────────────────────────

export interface AlternativeOption {
  id: string;
  label: string;
  /** « Pourquoi » : dans quel cas la choisir, quel risque elle couvre. */
  why: string;
  /** Rédaction de la clause (peut contenir des {{variables}}). */
  content: string;
}

export interface AlternativeDef {
  id: string;
  blockId: string;
  label: string;
  options: AlternativeOption[];
  defaultOptionId: string;
}

// ─── Points de décision (marge) ───────────────────────────────────────────────

export type DecisionImpact = "confort" | "eleve" | "critique";
export type DecisionResolution = "pending" | "active" | "ecartee";

export interface DecisionDef {
  id: string;
  /** Bloc auquel la décision est ancrée (pour le positionnement marge). */
  blockId?: string;
  title: string;
  /** Explication ton juriste. */
  explanation: string;
  /** Explication ton non-juriste (langage simple). */
  explanationSimple: string;
  impact: DecisionImpact;
  defaultResolution: DecisionResolution;
  /** Écarter exige-t-il une justification (trace) ? */
  reasonRequiredToDismiss?: boolean;
}

// ─── Dépendances (effets déclaratifs) ─────────────────────────────────────────

export type Effect =
  | { type: "setVarMax"; var: string; value: number }
  | { type: "setVarMin"; var: string; value: number }
  | { type: "requireVar"; var: string }
  | { type: "enableBlock"; block: string }
  | { type: "disableBlock"; block: string }
  | { type: "requireBlock"; block: string }
  | { type: "requireDecision"; decision: string };

export interface DependencyRule {
  id: string;
  when: Condition;
  then: Effect[];
}

// ─── Blocs (clauses du document par défaut) ──────────────────────────────────

export type BlockKind = "title" | "preamble" | "clause" | "signature";

export interface BlockDef {
  id: string;
  kind: BlockKind;
  heading?: string;
  /** Texte par défaut (peut contenir des {{variables}}). */
  content: string;
  /** Mention obligatoire : non supprimable sans alerte explicite. */
  mandatory?: boolean;
  alternativeId?: string;
  decisionId?: string;
}

export interface MandatoryMention {
  id: string;
  label: string;
  /** Bloc dont la présence satisfait la mention. */
  satisfiedByBlock: string;
}

// ─── Modèle de contrat ────────────────────────────────────────────────────────

export interface ContractModel {
  key: string;
  version: number;
  label: string;
  variables: VariableDef[];
  blocks: BlockDef[];
  alternatives: AlternativeDef[];
  decisions: DecisionDef[];
  rules: DependencyRule[];
  mandatoryMentions: MandatoryMention[];
}

// ─── État d'un brouillon ──────────────────────────────────────────────────────

export type DraftMode = "juriste" | "nonjuriste";
export type BlockSource = "model" | "manual";

export interface BlockState {
  source: BlockSource;
  status: "active" | "removed";
  /** Édition manuelle : contenu qui remplace le contenu modèle/alternative. */
  contentOverride?: string;
}

export interface DecisionTrace {
  decisionId: string;
  resolution: DecisionResolution;
  reason?: string;
  at: string; // ISO
}

export interface DraftState {
  modelKey: string;
  modelVersion: number;
  mode: DraftMode;
  variables: Record<string, string>;
  /** alternativeId -> optionId choisi. */
  alternatives: Record<string, string>;
  decisions: Record<string, DecisionResolution>;
  /** Trace durable des décisions (responsabilité du professionnel engagée). */
  traces: DecisionTrace[];
  /** blockId -> état (présent uniquement si dérogé au défaut). */
  blocks: Record<string, BlockState>;
}
