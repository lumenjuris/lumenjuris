import { Moon, Sun } from "lucide-react";

import { useThemeStore } from "../../../../store/themeStore";

/**
 * Interrupteur clair / sombre posé en haut à droite du hero. Il agit sur le
 * thème global de l'application (le même que celui des Paramètres).
 * Le libellé annonce la bascule à venir (« Sombre » quand on est en clair).
 */
export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const goingDark = theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      className="theme-toggle"
      aria-label={goingDark ? "Passer en thème sombre" : "Passer en thème clair"}
    >
      {goingDark ? <Moon className="ic" style={{ width: 15, height: 15 }} /> : <Sun className="ic" style={{ width: 15, height: 15 }} />}
      {goingDark ? "Sombre" : "Clair"}
    </button>
  );
}
