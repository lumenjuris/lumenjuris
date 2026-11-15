/**
 * Onboarding — référentiel : étapes, listes de réponses et libellés.
 *
 * ⚠ Les codes de réponse doivent rester identiques à ceux de
 * `backNode/src/services/classUserMetadata.ts` : le serveur refuse un code
 * inconnu. Pour ajouter une réponse, l'ajouter ici ET côté serveur.
 */
import {
  FolderOpen,
  Handshake,
  Library,
  MessageSquare,
  PenLine,
  PenTool,
  ScanSearch,
  type LucideIcon,
} from "lucide-react";

export type StepId = "intent" | "profession" | "activity" | "enterprise";

/**
 * Étapes du formulaire. `index` est l'identifiant envoyé au serveur
 * (`currentStep`) : il ne change pas même quand une étape est masquée, pour que
 * les statistiques d'abandon restent comparables entre utilisateurs.
 */
export const STEPS: { id: StepId; index: number; label: string }[] = [
  { id: "intent", index: 0, label: "Vos priorités" },
  { id: "profession", index: 1, label: "Votre profil" },
  { id: "activity", index: 2, label: "Votre activité" },
  { id: "enterprise", index: 3, label: "Votre structure" },
];

/** Outils proposés à la première étape. `to` est la page ouverte en fin de parcours. */
export const INTENT_OPTIONS: {
  code: string;
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
}[] = [
  {
    code: "analyze_contract",
    title: "Analyser un contrat",
    description: "Repérer les clauses à risque d'un contrat reçu",
    to: "/conformite",
    icon: ScanSearch,
  },
  {
    code: "generate_contract",
    title: "Rédiger un contrat",
    description: "Partir d'un modèle ou d'une page blanche",
    to: "/generateur",
    icon: PenLine,
  },
  {
    code: "negotiation",
    title: "Négocier",
    description: "Échanger les versions avec l'autre partie",
    to: "/negociations",
    icon: Handshake,
  },
  {
    code: "esignature",
    title: "Faire signer",
    description: "Envoyer un contrat en signature électronique",
    to: "/signature",
    icon: PenTool,
  },
  {
    code: "contract_library",
    title: "Centraliser mes contrats",
    description: "Contrathèque, échéances et renouvellements",
    to: "/contratheque",
    icon: FolderOpen,
  },
  {
    code: "clause_library",
    title: "Gérer mes clauses",
    description: "Constituer une bibliothèque de clauses de référence",
    to: "/clauses",
    icon: Library,
  },
  {
    code: "chat",
    title: "Poser une question juridique",
    description: "Interroger l'assistant sur un point de droit",
    to: "/chatjuridique",
    icon: MessageSquare,
  },
];

export const MAX_INTENTS = 3;

export const PROFESSION_OPTIONS: { code: string; label: string }[] = [
  { code: "avocat", label: "Avocat" },
  { code: "juriste_entreprise", label: "Juriste d'entreprise" },
  { code: "notaire_commissaire", label: "Notaire ou commissaire de justice" },
  { code: "dirigeant", label: "Dirigeant ou fondateur" },
  { code: "rh", label: "Ressources humaines" },
  { code: "expert_comptable", label: "Expert-comptable ou conseil" },
  { code: "independant", label: "Indépendant ou freelance" },
  { code: "etudiant", label: "Étudiant" },
  { code: "particulier", label: "Particulier" },
  { code: "autre", label: "Autre" },
];

export const PROFESSION_OTHER = "autre";
export const PROFESSION_OTHER_MAX_LENGTH = 60;

/** Profils à qui l'on ne demande ni volume de contrats, ni équipe, ni structure. */
export const PROFESSIONS_WITHOUT_ORGANISATION = ["etudiant", "particulier"];

export const CONTRACT_VOLUME_OPTIONS: { code: string; label: string }[] = [
  { code: "lt_5", label: "Moins de 5" },
  { code: "5_20", label: "5 à 20" },
  { code: "20_100", label: "20 à 100" },
  { code: "gt_100", label: "Plus de 100" },
];

export const TEAM_SIZE_OPTIONS: { code: string; label: string }[] = [
  { code: "solo", label: "Moi seul" },
  { code: "2_5", label: "2 à 5" },
  { code: "6_20", label: "6 à 20" },
  { code: "gt_20", label: "Plus de 20" },
];

/** Courbe d'animation commune : départ franc, arrivée douce (celle du tableau de bord). */
export const EASE_OUT = [0.2, 0.7, 0.2, 1] as const;
