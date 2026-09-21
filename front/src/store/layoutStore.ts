import { create } from "zustand";

interface State {
  /**
   * Vrai tant qu'un éditeur de contrat est ouvert : le menu latéral se replie
   * pour laisser toute la largeur au document, puis revient à son état
   * précédent quand on quitte l'éditeur.
   */
  editeurPleinEcran: boolean;
  setEditeurPleinEcran: (actif: boolean) => void;
}

export const useLayoutStore = create<State>((set) => ({
  editeurPleinEcran: false,
  setEditeurPleinEcran: (actif) => set({ editeurPleinEcran: actif }),
}));
