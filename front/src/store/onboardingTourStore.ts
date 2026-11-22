import { create } from "zustand";

interface OnboardingTourState {
  /** Étape en cours de la visite guidée du menu, `null` quand aucune visite n'est en cours. */
  stepIndex: number | null;
  startTour: () => void;
  nextStep: () => void;
  endTour: () => void;
}

/**
 * Visite guidée du menu latéral, lancée à la fin du formulaire d'onboarding.
 * La liste des étapes est déduite du menu (voir `MainLayout`) ; ce store ne
 * garde que l'avancement. Il vit hors des pages : la visite survit donc à la
 * navigation.
 */
export const useOnboardingTourStore = create<OnboardingTourState>((set) => ({
  stepIndex: null,
  startTour: () => set({ stepIndex: 0 }),
  nextStep: () => set((state) => ({ stepIndex: state.stepIndex === null ? null : state.stepIndex + 1 })),
  endTour: () => set({ stepIndex: null }),
}));
