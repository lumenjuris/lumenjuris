import { Upload, type LucideIcon } from "lucide-react";

import { INTENT_OPTIONS } from "../../../onboarding/constants";

/** Une carte d'outil du tableau de bord. */
export interface ToolCard {
  key: string;
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Renseigné une fois l'outil utilisé (« 3 contrats suivis ») ; sinon la carte reste une invitation. */
  status: string | null;
}

/** Volumes déjà chargés par le tableau de bord, par outil. */
export interface ToolCounts {
  contracts: number;
  negotiations: number;
  envelopes: number;
}

type ToolDefinition = Omit<ToolCard, "status">;

/**
 * Catalogue des cartes : les outils proposés à l'onboarding, plus l'import de
 * modèle, qui n'est pas un choix du formulaire mais fait partie des cartes par
 * défaut.
 */
const TOOL_CATALOG: ToolDefinition[] = [
  ...INTENT_OPTIONS.map((option) => ({
    key: option.code,
    to: option.to,
    title: option.title,
    description: `${option.description}.`,
    icon: option.icon,
  })),
  {
    key: "import_template",
    to: "/contrat-generation?section=import",
    title: "Importer un modèle",
    description: "Transformer un contrat existant en modèle réutilisable.",
    icon: Upload,
  },
];

/** Cartes affichées quand l'utilisateur n'a choisi aucun outil (formulaire passé ou refusé). */
const DEFAULT_TOOL_KEYS = ["generate_contract", "import_template", "analyze_contract"];

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

/** État affiché sur la carte, pour les outils dont le volume est connu du tableau de bord. */
function statusOf(key: string, counts: ToolCounts): string | null {
  if (key === "contract_library" && counts.contracts > 0) {
    return plural(counts.contracts, "contrat suivi", "contrats suivis");
  }
  if (key === "negotiation" && counts.negotiations > 0) {
    return plural(counts.negotiations, "négociation", "négociations");
  }
  if (key === "esignature" && counts.envelopes > 0) {
    return plural(counts.envelopes, "envoi en signature", "envois en signature");
  }
  return null;
}

/**
 * Cartes d'outils du tableau de bord : celles choisies à l'onboarding
 * (`primaryIntents`, dans l'ordre de sélection), sinon les cartes par défaut.
 */
export function buildToolCards(intents: string[], counts: ToolCounts): ToolCard[] {
  const chosen = intents.filter((code) => TOOL_CATALOG.some((tool) => tool.key === code));
  const keys = chosen.length > 0 ? chosen : DEFAULT_TOOL_KEYS;

  return keys.flatMap((key) => {
    const tool = TOOL_CATALOG.find((candidate) => candidate.key === key);
    return tool ? [{ ...tool, status: statusOf(key, counts) }] : [];
  });
}
