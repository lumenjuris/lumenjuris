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
  /**
   * Consigne concrète, une phrase : où agir et quoi faire ensuite. Le titre
   * seul ne suffisait pas — à l'arrivée, les zones étant pré-placées, on lisait
   * « Les deux zones sont placées » sans savoir qu'on pouvait les déplacer ni
   * qu'il fallait ensuite cliquer sur « Signer » (les étiquettes animées sur le
   * document sont souvent hors de l'écran, en bas de page).
   */
  hint: string;
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
      return {
        stepNumber: 1,
        title: "Placez votre zone de signature",
        hint: "Cliquez sur le document, à l'endroit où vous signerez.",
        signer: "self",
      };
    case "place-counterparty":
      return {
        stepNumber: 1,
        title: "Placez la zone du cocontractant",
        hint: "Cliquez sur le document, à l'endroit où signera votre cocontractant.",
        signer: "counterparty",
      };
    case "place-ready":
      // Les deux zones sont pré-placées par le wizard (dernière page, bas de
      // page, émetteur à gauche, cocontractant à droite) : c'est l'état
      // d'arrivée, d'où un titre qui dit quoi faire plutôt qu'un constat.
      return {
        stepNumber: 1,
        title: "Placez les zones de signature à l'endroit souhaité",
        hint: "Deux zones sont déjà posées en bas de la dernière page : la vôtre à gauche, celle du cocontractant à droite. Faites-les glisser si besoin, puis cliquez sur « Signer ».",
        signer: null,
      };
    case "sign-self":
      return {
        stepNumber: 2,
        title: "Apposez votre signature",
        hint: "Cliquez sur votre zone, sur le document, pour signer.",
        signer: "self",
      };
    case "sign-recipient":
      return {
        stepNumber: 3,
        title: "Indiquez à qui envoyer le contrat",
        hint: "Renseignez le nom et l'e-mail de votre cocontractant.",
        signer: "counterparty",
      };
    case "sign-send":
      return {
        stepNumber: 3,
        title: "Tout est prêt",
        hint: "Vérifiez le destinataire, puis cliquez sur « Envoyer ».",
        signer: null,
      };
  }
}
