import { useEffect, useState, type ReactNode } from "react";
import { MoreVertical } from "lucide-react";

/** Une entrée du menu d'actions d'une ligne. */
export interface RowAction {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  /** Action destructive : affichée en rouge (suppression…). */
  danger?: boolean;
  disabled?: boolean;
}

/** Position à l'écran du menu ouvert (mesurée sur le bouton). */
interface MenuPosition {
  top: number;
  right: number;
}

/**
 * Menu « ⋮ » d'une ligne de tableau.
 *
 * Le panneau est en position fixe, calculée à partir du bouton : ainsi il n'est
 * jamais coupé par le défilement horizontal du tableau. En contrepartie il doit
 * se fermer au défilement et au redimensionnement, sans quoi il resterait à
 * flotter loin de sa ligne.
 */
export function RowActionsMenu({ actions }: { actions: RowAction[] }) {
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const isOpen = position !== null;

  useEffect(() => {
    if (!isOpen) return;

    const closeMenu = () => setPosition(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [isOpen]);

  const toggleMenu = (button: HTMLElement) => {
    if (isOpen) {
      setPosition(null);
      return;
    }
    const buttonBox = button.getBoundingClientRect();
    setPosition({ top: buttonBox.bottom + 4, right: window.innerWidth - buttonBox.right });
  };

  if (actions.length === 0) return null;

  return (
    // Le clic sur le menu ne doit pas déclencher l'ouverture de la ligne.
    <div className="relative inline-flex items-center" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => toggleMenu(e.currentTarget)}
        className="rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink-secondary"
        title="Options"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {position && (
        <div
          role="menu"
          style={{ top: position.top, right: position.right }}
          className="fixed z-50 w-48 overflow-hidden rounded-xl border border-line bg-white text-left shadow-[0_18px_40px_-20px_rgba(16,24,40,0.45)]"
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onClick={() => { setPosition(null); action.onSelect(); }}
              className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                action.danger
                  ? "text-danger hover:bg-danger-light"
                  : "text-ink-secondary hover:bg-surface-subtle"
              }`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
