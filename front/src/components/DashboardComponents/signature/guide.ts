import type { SignerRole } from "./types";

/**
 * Contenu du guide de la colonne de gauche du wizard de signature.
 *
 * Le parcours visible par l'utilisateur compte 2 étapes (le document est déjà
 * importé quand le wizard s'ouvre) :
 *   1. Placer les zones de signature
 *   2. Signer et envoyer
 *
 * Chaque état réel du wizard est traduit en une "phase". À chaque phase
 * correspond une seule consigne : ce qu'il faut faire maintenant, et ce qui
 * viendra juste après. Le panneau de gauche suit ainsi la progression réelle
 * au lieu d'afficher une notice statique.
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
  /** Étape 2 — signé, il reste les coordonnées du cocontractant à saisir. */
  | "sign-recipient"
  /** Étape 2 — tout est prêt, il ne reste que l'envoi. */
  | "sign-send";

export interface GuideContent {
  /** Numéro d'étape affiché dans le bandeau ("Étape 1 sur 2"). */
  stepNumber: 1 | 2;
  /** Titre de l'étape en cours. */
  title: string;
  /** Action attendue maintenant — une seule phrase, à l'impératif. */
  action: string;
  /** Ce qu'il restera à faire ensuite (null = dernière action du parcours). */
  next: string | null;
  /** Signataire concerné par l'action — sert à colorer le panneau. */
  signer: SignerRole | null;
  /** Vrai quand l'action attendue est un clic dans le document. */
  pointsToDocument: boolean;
}

/** Nombre d'étapes visibles du parcours (le document est déjà importé). */
export const GUIDE_STEP_TOTAL = 2;

/** Libellés des 2 étapes visibles, affichés dans le fil de progression. */
export const GUIDE_STEP_LABELS = [
  "Placer les zones de signature",
  "Signer et envoyer",
];

/** Traduit l'état du wizard en consigne unique à afficher à gauche. */
export function getGuideContent(phase: GuidePhase): GuideContent {
  switch (phase) {
    case "place-self":
      return {
        stepNumber: 1,
        title: "Placez votre zone de signature",
        action: "Cliquez dans le contrat à l'endroit où vous signerez.",
        next: "Placer la zone du cocontractant",
        signer: "self",
        pointsToDocument: true,
      };
    case "place-counterparty":
      return {
        stepNumber: 1,
        title: "Placez la zone du cocontractant",
        action: "Cliquez à l'endroit où votre cocontractant signera.",
        next: "Signer et envoyer le contrat",
        signer: "counterparty",
        pointsToDocument: true,
      };
    case "place-ready":
      return {
        stepNumber: 1,
        title: "Les deux zones sont placées",
        action:
          "Déplacez-les si besoin, puis cliquez sur « Signer et envoyer ».",
        next: "Apposer votre signature",
        signer: null,
        pointsToDocument: false,
      };
    case "sign-self":
      return {
        stepNumber: 2,
        title: "Apposez votre signature",
        action:
          "Dessinez ou saisissez votre signature dans la fenêtre qui s'ouvre. Si vous l'avez fermée, cliquez sur votre zone dans le document.",
        next: "Indiquer à qui envoyer le contrat",
        signer: "self",
        pointsToDocument: true,
      };
    case "sign-recipient":
      return {
        stepNumber: 2,
        title: "Indiquez à qui envoyer le contrat",
        action:
          "Saisissez le nom et l'e-mail de votre cocontractant ci-dessous.",
        next: "Envoyer le contrat pour signature",
        signer: "counterparty",
        pointsToDocument: false,
      };
    case "sign-send":
      return {
        stepNumber: 2,
        title: "Tout est prêt",
        action:
          "Cliquez sur « Faire signer et envoyer » : votre cocontractant recevra un e-mail pour signer à son tour.",
        next: null,
        signer: null,
        pointsToDocument: false,
      };
  }
}
