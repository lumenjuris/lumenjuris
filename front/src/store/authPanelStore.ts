import { create } from "zustand";

import {
  memoriserDestination,
  oublierDestination,
} from "../utils/destinationApresConnexion";

/** Panneau d'authentification actuellement ouvert. */
type PanneauAuth = "aucun" | "connexion" | "inscription";

/**
 * Comment le panneau s'affiche :
 * - `"ancre"` : carte posée sous le bouton de l'en-tête, quand l'utilisateur a
 *   lui-même demandé à se connecter ;
 * - `"centre"` : fenêtre centrée sur un fond flouté, quand c'est l'application
 *   qui interrompt l'utilisateur au milieu de ce qu'il faisait.
 */
export type PresentationPanneau = "ancre" | "centre";

interface State {
  panneau: PanneauAuth;
  presentation: PresentationPanneau;
  /**
   * Page que l'utilisateur voulait ouvrir avant qu'on lui demande de se
   * connecter. Doublée dans le `localStorage` pour survivre au passage par
   * Google, qui recharge l'application.
   */
  destination: string | null;
  ouvrirConnexion: (destination?: string) => void;
  ouvrirInscription: (destination?: string) => void;
  /**
   * Passe d'un panneau à l'autre en gardant la destination et la présentation :
   * un visiteur qui clique sur un module puis choisit de créer un compte doit
   * tout de même arriver sur le module une fois inscrit et connecté.
   */
  basculerVers: (panneau: "connexion" | "inscription") => void;
  fermer: () => void;
}

/**
 * État partagé des panneaux de connexion et d'inscription.
 *
 * Ils sont rendus par l'en-tête, mais peuvent être ouverts depuis n'importe où
 * — l'accueil, le menu latéral et `RequireAuth` demandent la connexion au
 * moment où un visiteur ouvre une page réservée. Un seul panneau est visible à
 * la fois : ils se superposeraient au même endroit de l'écran.
 */
export const useAuthPanelStore = create<State>((set) => ({
  panneau: "aucun",
  presentation: "ancre",
  destination: null,

  ouvrirConnexion: (destination) =>
    set({
      panneau: "connexion",
      ...ouverture(destination),
    }),

  ouvrirInscription: (destination) =>
    set({
      panneau: "inscription",
      ...ouverture(destination),
    }),

  basculerVers: (panneau) => set({ panneau }),

  fermer: () => {
    // L'utilisateur a renoncé : la destination ne doit pas ressortir à sa
    // prochaine connexion. Partir vers Google ne passe pas par ici.
    oublierDestination();
    set({ panneau: "aucun", presentation: "ancre", destination: null });
  },
}));

/**
 * Une ouverture sans destination vient d'un clic sur « Se connecter » ou
 * « Inscrivez-vous » : l'utilisateur sait ce qu'il a demandé, la carte reste
 * sous le bouton. Avec une destination, c'est l'application qui l'interrompt,
 * et la fenêtre se met au centre pour qu'il comprenne pourquoi.
 */
function ouverture(destination?: string) {
  if (destination) memoriserDestination(destination);
  return {
    destination: destination ?? null,
    presentation: (destination ? "centre" : "ancre") as PresentationPanneau,
  };
}
