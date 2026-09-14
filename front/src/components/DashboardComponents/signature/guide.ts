import type { SignerRole } from "./types";

/**
 * Contenu du guide de la colonne de gauche du wizard de signature.
 *
 * Le parcours visible par l'utilisateur compte 3 étapes (le document est déjà
 * importé quand le wizard s'ouvre) :
 *   1. Placer les zones de signature
 *   2. Signer
 *   3. Envoyer
 *
 * Chaque état réel du wizard est traduit en une "phase". À chaque phase
 * correspond un numéro d'étape et un titre : le panneau de gauche suit ainsi
 * la progression réelle au lieu d'afficher une notice statique.
 */
export type GuidePhase =
  /** Étape 1 — aucune zone posée pour l'émetteur. */
  | "place-self"
  /** Étape 1 — la zone de l'émetteur est posée, pas celle du cocontractant. */
  | "place-counterparty"
  /** Étape 1 — les deux zones sont posées, on peut passer à l'étape 2. */
  | "place-ready"
  /** Étape 2 — l'émetteur n'a pas encore apposé sa signature. */
  | "sign-self"
  /** Étape 3 — signé, il reste les coordonnées du cocontractant à saisir. */
  | "sign-recipient"
  /** Étape 3 — tout est prêt, il ne reste que l'envoi. */
  | "sign-send";

export interface GuideContent {
  /** Numéro d'étape affiché dans le bandeau ("Étape 1 sur 3"). */
  stepNumber: GuideStepNumber;
  /** Titre de ce qu'il y a à faire maintenant. */
  title: string;
  /** Signataire concerné — sert à colorer le bandeau d'étape. */
  signer: SignerRole | null;
}

/** Libellés des étapes visibles du parcours, dans l'ordre. */
export const GUIDE_STEP_LABELS = [
  "Placez les zones de signature",
  "Signez",
  "Envoyez",
];

/**
 * Nombre d'étapes visibles (le document est déjà importé). Déduit des libellés
 * pour qu'ajouter ou retirer une étape ne demande qu'une seule modification.
 */
export const GUIDE_STEP_TOTAL = GUIDE_STEP_LABELS.length;

/** Index d'étape, 1-based : 1 = premier libellé de `GUIDE_STEP_LABELS`. */
export type GuideStepNumber = 1 | 2 | 3;

/** Traduit l'état du wizard en étape + titre à afficher à gauche. */
export function getGuideContent(phase: GuidePhase): GuideContent {
  switch (phase) {
    case "place-self":
      return { stepNumber: 1, title: "Placez votre zone de signature", signer: "self" };
    case "place-counterparty":
      return { stepNumber: 1, title: "Placez la zone du cocontractant", signer: "counterparty" };
    case "place-ready":
      return { stepNumber: 1, title: "Les deux zones sont placées", signer: null };
    case "sign-self":
      return { stepNumber: 2, title: "Apposez votre signature", signer: "self" };
    case "sign-recipient":
      return { stepNumber: 3, title: "Indiquez à qui envoyer le contrat", signer: "counterparty" };
    case "sign-send":
      return { stepNumber: 3, title: "Tout est prêt", signer: null };
  }
}
