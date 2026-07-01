/** Construction de l'état initial d'un brouillon à partir d'un modèle. */
import type { ContractModel, DraftMode, DraftState } from "./types";

export function createInitialState(
  model: ContractModel,
  mode: DraftMode = "juriste",
): DraftState {
  const variables: Record<string, string> = {};
  for (const v of model.variables) variables[v.id] = v.default ?? "";

  const alternatives: Record<string, string> = {};
  for (const a of model.alternatives) alternatives[a.id] = a.defaultOptionId;

  const decisions: Record<string, DraftState["decisions"][string]> = {};
  for (const d of model.decisions) decisions[d.id] = d.defaultResolution;

  return {
    modelKey: model.key,
    modelVersion: model.version,
    mode,
    variables,
    alternatives,
    decisions,
    traces: [],
    blocks: {}, // vide = tous les blocs au défaut (model / active)
  };
}

/** État effectif d'un bloc (défaut si non dérogé). */
export function blockSource(state: DraftState, blockId: string) {
  return state.blocks[blockId]?.source ?? "model";
}
export function blockStatus(state: DraftState, blockId: string) {
  return state.blocks[blockId]?.status ?? "active";
}
