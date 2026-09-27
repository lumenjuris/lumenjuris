import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import type { PresentationPanneau } from "../../store/authPanelStore";

interface Props {
  titre: string;
  presentation: PresentationPanneau;
  onClose: () => void;
  largeur: number;
  id: string;
  children: React.ReactNode;
}

/**
 * Coquille commune aux panneaux de connexion et d'inscription : portail,
 * fond cliquable, carte, en-tête avec titre et croix, fermeture au clavier.
 *
 * Elle est montée en dehors de l'en-tête : la barre ne fait que 48 px de haut,
 * un formulaire posé dans son flux la déformerait.
 *
 * Deux présentations, décidées par le store selon la raison de l'ouverture :
 *
 * - `"ancre"` — l'utilisateur a cliqué sur « Se connecter » : la carte se pose
 *   sous le bouton, le reste de la page reste lisible et cliquable.
 * - `"centre"` — l'application interrompt l'utilisateur (ouverture d'un module
 *   réservé) : la fenêtre se met au centre sur un fond assombri et flouté,
 *   pour que la demande soit comprise comme une étape à franchir.
 */
export function AuthPanelShell({
  titre,
  presentation,
  onClose,
  largeur,
  id,
  children,
}: Props) {
  
  // Échap referme, comme la croix.
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const estCentre = presentation === "centre";

  return createPortal(
    <>
      {/* Fond cliquable. Ancré il reste invisible pour ne pas éteindre la page
          derrière ; centré il l'assombrit et la floute. */}
      <div
        className={
          estCentre
            ? "fixed inset-0 z-40 bg-ink/25 backdrop-blur-[3px]"
            : "fixed inset-0 z-40"
        }
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        style={{ width: largeur }}
        className={`fixed z-50 flex max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-xl ${
          estCentre
            ? "left-1/2 top-1/2 max-h-[calc(100vh-2rem)] -translate-x-1/2 -translate-y-1/2"
            : "right-3 top-14 max-h-[calc(100vh-4.5rem)]"
        }`}
      >
        <header className="flex shrink-0 items-center justify-between border-b-2  px-5 py-2">
          <h2 id={id} className="text-[15px] font-semibold text-ink">
            {titre}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* La carte est bornée à la hauteur de l'écran (en-tête compris) : sur
            un petit écran, avec une bannière d'erreur, c'est ce bloc qui défile. */}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </>,
    document.body,
  );
}
