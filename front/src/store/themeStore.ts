import { create } from "zustand";

/**
 * Thème de l'application : clair (défaut) ou sombre.
 *
 * Choix **global** et persistant (mémorisé dans le navigateur). Il est reflété
 * par l'attribut `data-theme` sur `<html>`, posé dès le chargement du module
 * (avant le premier rendu React, pour éviter tout clignotement).
 *
 * Aujourd'hui, seuls le tableau de bord et la page Paramètres sont entièrement
 * habillés en sombre ; les autres écrans s'assombriront progressivement. Le
 * switch, lui, agit déjà partout et sa préférence est conservée.
 */
export type AppTheme = "light" | "dark";

const STORAGE_KEY = "lj-theme";

function readStored(): AppTheme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Reflète le thème sur `<html>` (et mémorise le choix). */
function applyTheme(theme: AppTheme): void {
  try {
    document.documentElement.setAttribute("data-theme", theme);
  } catch {
    /* environnement sans DOM : rien à faire. */
  }
}

// Applique le thème stocké immédiatement, avant le premier rendu.
applyTheme(readStored());

interface ThemeState {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readStored(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* stockage indisponible (navigation privée) : le choix reste en mémoire. */
    }
    applyTheme(theme);
    set({ theme });
  },
  toggle: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));
