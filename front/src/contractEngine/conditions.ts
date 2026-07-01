/** Évaluation des conditions déclaratives sur l'état d'un brouillon. */
import type { Condition, DraftState } from "./types";
import { blockStatus } from "./state";

function asNumber(v: string): number {
  // Tolère "18", "18 mois", "2 500 €" → 18 / 18 / 2500
  const n = parseFloat(String(v).replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

export function evaluateCondition(cond: Condition, state: DraftState): boolean {
  if ("all" in cond) return cond.all.every((c) => evaluateCondition(c, state));
  if ("any" in cond) return cond.any.some((c) => evaluateCondition(c, state));
  if ("not" in cond) return !evaluateCondition(cond.not, state);

  if ("decision" in cond) {
    return (state.decisions[cond.decision] ?? "pending") === cond.is;
  }
  if ("alternative" in cond) {
    return state.alternatives[cond.alternative] === cond.is;
  }
  if ("block" in cond) {
    return blockStatus(state, cond.block) === cond.is;
  }

  // Variable
  const raw = state.variables[cond.var] ?? "";
  switch (cond.op) {
    case "eq":
      return raw === String(cond.value);
    case "neq":
      return raw !== String(cond.value);
    case "in":
      return Array.isArray(cond.value) && cond.value.includes(raw);
    case "gt":
      return asNumber(raw) > Number(cond.value);
    case "lt":
      return asNumber(raw) < Number(cond.value);
    case "gte":
      return asNumber(raw) >= Number(cond.value);
    case "lte":
      return asNumber(raw) <= Number(cond.value);
    default:
      return false;
  }
}

export { asNumber };
