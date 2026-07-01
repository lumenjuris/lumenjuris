/**
 * Moteur de dépendances + validation + complétude (générique, pur).
 *
 * Pipeline : état → règles déclaratives → contraintes dérivées → validation des
 * variables → état de complétude (décisions à traiter, alternatives non
 * arbitrées, mentions obligatoires) → autorisation d'export selon le mode.
 */
import type {
  AlternativeDef,
  ContractModel,
  DecisionDef,
  DraftState,
  Effect,
} from "./types";
import { asNumber, evaluateCondition } from "./conditions";
import { blockStatus } from "./state";

export interface DerivedVarConstraint {
  max?: number;
  min?: number;
  required?: boolean;
}

export interface Derived {
  varConstraints: Record<string, DerivedVarConstraint>;
  /** Blocs rendus obligatoires par une règle. */
  requiredBlocks: Set<string>;
  /** Blocs désactivés par une règle. */
  disabledBlocks: Set<string>;
  /** Décisions rendues obligatoires par une règle. */
  requiredDecisions: Set<string>;
}

/** Applique les règles de dépendance pour produire les contraintes dérivées. */
export function deriveConstraints(
  model: ContractModel,
  state: DraftState,
): Derived {
  const varConstraints: Record<string, DerivedVarConstraint> = {};
  const requiredBlocks = new Set<string>();
  const disabledBlocks = new Set<string>();
  const requiredDecisions = new Set<string>();

  const ensure = (v: string) => (varConstraints[v] ??= {});

  // 1. Contraintes intrinsèques (conditionnelles) portées par les variables.
  for (const v of model.variables) {
    for (const c of v.constraints ?? []) {
      if (c.when && !evaluateCondition(c.when, state)) continue;
      const target = ensure(v.id);
      if (c.max !== undefined) target.max = Math.min(target.max ?? Infinity, c.max);
      if (c.min !== undefined) target.min = Math.max(target.min ?? -Infinity, c.min);
      if (c.required) target.required = true;
    }
  }

  // 2. Effets des règles de dépendance.
  const apply = (e: Effect) => {
    switch (e.type) {
      case "setVarMax":
        ensure(e.var).max = Math.min(ensure(e.var).max ?? Infinity, e.value);
        break;
      case "setVarMin":
        ensure(e.var).min = Math.max(ensure(e.var).min ?? -Infinity, e.value);
        break;
      case "requireVar":
        ensure(e.var).required = true;
        break;
      case "requireBlock":
        requiredBlocks.add(e.block);
        break;
      case "disableBlock":
        disabledBlocks.add(e.block);
        break;
      case "enableBlock":
        disabledBlocks.delete(e.block);
        break;
      case "requireDecision":
        requiredDecisions.add(e.decision);
        break;
    }
  };
  for (const rule of model.rules) {
    if (evaluateCondition(rule.when, state)) rule.then.forEach(apply);
  }

  return { varConstraints, requiredBlocks, disabledBlocks, requiredDecisions };
}

export interface VarIssue {
  varId: string;
  label: string;
  kind: "required" | "max" | "min" | "type";
  message: string;
}

/** Valide les variables au regard des contraintes dérivées. */
export function validateVariables(
  model: ContractModel,
  state: DraftState,
  derived: Derived,
): VarIssue[] {
  const issues: VarIssue[] = [];
  for (const v of model.variables) {
    const value = (state.variables[v.id] ?? "").trim();
    const c = derived.varConstraints[v.id] ?? {};

    if (c.required && !value) {
      issues.push({ varId: v.id, label: v.label, kind: "required", message: `${v.label} est requis.` });
      continue;
    }
    if (!value) continue;

    if (v.type === "number" || v.type === "money" || v.type === "duration") {
      const n = asNumber(value);
      if (Number.isNaN(n)) {
        issues.push({ varId: v.id, label: v.label, kind: "type", message: `${v.label} doit être un nombre.` });
        continue;
      }
      if (c.max !== undefined && n > c.max)
        issues.push({ varId: v.id, label: v.label, kind: "max", message: `${v.label} ne peut excéder ${c.max}.` });
      if (c.min !== undefined && n < c.min)
        issues.push({ varId: v.id, label: v.label, kind: "min", message: `${v.label} ne peut être inférieur à ${c.min}.` });
    }
  }
  return issues;
}

export interface Completeness {
  decisionsPending: DecisionDef[];
  /** Décisions à fort enjeu (eleve/critique) non traitées. */
  decisionsBlocking: DecisionDef[];
  alternativesUnarbitrated: AlternativeDef[];
  missingMandatory: { id: string; label: string }[];
  varIssues: VarIssue[];
  ready: boolean;
  /** Export autorisé (dépend du mode juriste/non-juriste). */
  canExport: boolean;
}

/**
 * Une alternative est « non arbitrée » tant qu'elle est restée sur son option
 * par défaut (l'utilisateur ne l'a pas explicitement confirmée/changée).
 */
function isArbitrated(state: DraftState, altId: string): boolean {
  // touched: présent dans un set d'arbitrage explicite (cf. UI). Par défaut, on
  // considère arbitré dès que l'option diffère du défaut OU est confirmée.
  return state.alternatives[`${altId}__arbitrated`] === "1";
}

export function computeCompleteness(
  model: ContractModel,
  state: DraftState,
  derived: Derived,
): Completeness {
  // Décisions non traitées.
  const decisionsPending = model.decisions.filter(
    (d) => (state.decisions[d.id] ?? "pending") === "pending",
  );
  const decisionsBlocking = decisionsPending.filter(
    (d) => d.impact === "eleve" || d.impact === "critique" || derived.requiredDecisions.has(d.id),
  );

  // Alternatives non arbitrées.
  const alternativesUnarbitrated = model.alternatives.filter(
    (a) => !isArbitrated(state, a.id),
  );

  // Mentions obligatoires : satisfaites si le bloc porteur est actif.
  const missingMandatory = model.mandatoryMentions
    .filter((m) => blockStatus(state, m.satisfiedByBlock) === "removed")
    .map((m) => ({ id: m.id, label: m.label }));

  // Blocs rendus obligatoires par une règle mais retirés.
  for (const blockId of derived.requiredBlocks) {
    if (blockStatus(state, blockId) === "removed") {
      const b = model.blocks.find((x) => x.id === blockId);
      missingMandatory.push({ id: blockId, label: b?.heading ?? blockId });
    }
  }

  const varIssues = validateVariables(model, state, derived);

  const ready =
    decisionsPending.length === 0 &&
    alternativesUnarbitrated.length === 0 &&
    missingMandatory.length === 0 &&
    varIssues.length === 0;

  // Mode : le juriste a le dernier mot (export toujours permis, avec alertes).
  // Le non-juriste est protégé : pas d'export tant que des garde-fous sautent.
  const canExport =
    state.mode === "juriste"
      ? true
      : missingMandatory.length === 0 &&
        decisionsBlocking.length === 0 &&
        varIssues.filter((i) => i.kind === "max" || i.kind === "min").length === 0;

  return {
    decisionsPending,
    decisionsBlocking,
    alternativesUnarbitrated,
    missingMandatory,
    varIssues,
    ready,
    canExport,
  };
}
