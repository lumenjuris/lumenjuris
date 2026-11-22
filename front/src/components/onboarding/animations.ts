/**
 * Onboarding — réglages d'animation et classes partagés par les étapes.
 * (Fichier sans composant : requis par le rechargement à chaud de Vite.)
 */
import { EASE_OUT } from "./constants";

/** Apparition en cascade des réponses d'une étape (chaque enfant utilise `revealItem`). */
export const revealList = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.035, delayChildren: 0.06 } },
};

export const revealItem = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
};

export const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
