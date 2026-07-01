/**
 * Assemble le document effectif (liste de blocs rendus) à partir du modèle et de
 * l'état. Utilisé par l'éditeur (rendu + ancrage marge) et l'export.
 */
import type { ContractModel, DraftState } from "./types";
import { blockSource, blockStatus } from "./state";

export interface RenderedBlock {
  id: string;
  kind: string;
  heading?: string;
  content: string;
  mandatory: boolean;
  source: "model" | "manual";
  alternativeId?: string;
  decisionId?: string;
  /** Option d'alternative actuellement appliquée (le cas échéant). */
  chosenOptionId?: string;
}

/** Remplace les {{variables}} par leur valeur (ou un repère si vide). */
export function substituteVariables(
  content: string,
  variables: Record<string, string>,
): string {
  return content.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_m, name: string) => {
    const v = variables[name];
    return v && v.trim() ? v : `…`;
  });
}

export function buildDocument(
  model: ContractModel,
  state: DraftState,
): RenderedBlock[] {
  const out: RenderedBlock[] = [];

  for (const block of model.blocks) {
    if (blockStatus(state, block.id) === "removed") continue;

    const override = state.blocks[block.id]?.contentOverride;
    let content: string;

    if (override !== undefined) {
      // Édition manuelle : le contenu utilisateur prime, pas de substitution.
      content = override;
    } else if (block.alternativeId) {
      const alt = model.alternatives.find((a) => a.id === block.alternativeId);
      const chosenId = state.alternatives[block.alternativeId] ?? alt?.defaultOptionId;
      const opt = alt?.options.find((o) => o.id === chosenId);
      content = substituteVariables(opt?.content ?? block.content, state.variables);
    } else {
      content = substituteVariables(block.content, state.variables);
    }

    out.push({
      id: block.id,
      kind: block.kind,
      heading: block.heading,
      content,
      mandatory: !!block.mandatory,
      source: blockSource(state, block.id),
      alternativeId: block.alternativeId,
      decisionId: block.decisionId,
      chosenOptionId: block.alternativeId
        ? state.alternatives[block.alternativeId]
        : undefined,
    });
  }

  return out;
}

/** Rendu texte brut (export simple / tests). */
export function renderDocumentText(blocks: RenderedBlock[]): string {
  return blocks
    .map((b) => (b.heading ? `${b.heading}\n${b.content}` : b.content))
    .join("\n\n");
}
