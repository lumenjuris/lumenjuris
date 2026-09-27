import { useEffect } from "react";

/**
 * Marque la page courante via `data-lj-page` sur `<html>`, le temps qu'elle est
 * affichée. Sert à réserver l'habillage sombre complet aux écrans déjà prêts
 * (tableau de bord, paramètres) : leurs surfaces ne s'assombrissent que lorsque
 * leur nom est présent, sans risque pour les pages pas encore adaptées.
 *
 * @example usePageThemeScope("dashboard");
 */
export function usePageThemeScope(name: string): void {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute("data-lj-page");
    root.setAttribute("data-lj-page", name);
    return () => {
      // On restaure la valeur précédente (ou on nettoie) en quittant la page.
      if (previous) root.setAttribute("data-lj-page", previous);
      else root.removeAttribute("data-lj-page");
    };
  }, [name]);
}
