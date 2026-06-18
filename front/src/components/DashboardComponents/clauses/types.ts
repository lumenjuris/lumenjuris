export type ClauseCategory =
  | "CONFIDENTIALITE" | "RESPONSABILITE" | "RESILIATION" | "PROPRIETE_INTELLECTUELLE"
  | "DONNEES_PERSONNELLES" | "PAIEMENT" | "DUREE_RENOUVELLEMENT" | "FORCE_MAJEURE"
  | "LITIGES" | "GARANTIES" | "NON_CONCURRENCE" | "AUTRE";

export type ClausePosition = "IDEALE" | "ACCEPTABLE" | "LIGNE_ROUGE";

export interface Clause {
  id: string;
  title: string;
  category: ClauseCategory;
  position: ClausePosition;
  body: string;
  notes: string | null;
  language: string;
  tags: string[];
  isApproved: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClauseStats {
  total: number;
  approved: number;
  byCategory: Record<string, number>;
}

export interface ClauseInput {
  title: string;
  category: ClauseCategory;
  position: ClausePosition;
  body: string;
  notes?: string | null;
  tags?: string[];
  isApproved?: boolean;
}

export const CATEGORY_LABEL: Record<ClauseCategory, string> = {
  CONFIDENTIALITE: "Confidentialité",
  RESPONSABILITE: "Responsabilité",
  RESILIATION: "Résiliation",
  PROPRIETE_INTELLECTUELLE: "Propriété intellectuelle",
  DONNEES_PERSONNELLES: "Données personnelles (RGPD)",
  PAIEMENT: "Paiement",
  DUREE_RENOUVELLEMENT: "Durée & renouvellement",
  FORCE_MAJEURE: "Force majeure",
  LITIGES: "Litiges & juridiction",
  GARANTIES: "Garanties",
  NON_CONCURRENCE: "Non-concurrence",
  AUTRE: "Autre",
};

export const POSITION_LABEL: Record<ClausePosition, string> = {
  IDEALE: "Position idéale",
  ACCEPTABLE: "Repli acceptable",
  LIGNE_ROUGE: "Ligne rouge",
};

/** Styles de pastille par position (fond + texte). */
export const POSITION_STYLE: Record<ClausePosition, { bg: string; fg: string }> = {
  IDEALE: { bg: "#d1fae5", fg: "#065f46" },
  ACCEPTABLE: { bg: "#fef3c7", fg: "#92400e" },
  LIGNE_ROUGE: { bg: "#fee2e2", fg: "#991b1b" },
};
