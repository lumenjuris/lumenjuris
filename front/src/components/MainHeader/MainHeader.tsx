// UI //
import { MouseEvent } from "react";
import HeaderNavigationBar from "./HeaderNavigationBar";
import { PanelLeft } from "lucide-react";


type NavigationClickHandler = (
  event?: MouseEvent<HTMLElement>,
) => boolean | void;

interface MainHeaderProps {
  onNavClick?: NavigationClickHandler;
  setIsConnected?: React.Dispatch<React.SetStateAction<boolean>>;
  onToggleSidebar?: () => void;
  rotatePannelLeft:boolean
}

// La date et l'heure ne sont plus affichées dans l'en-tête : elles occupaient
// le centre de la barre sans rien apporter au travail sur les contrats.
export const MainHeader = ({ onNavClick, onToggleSidebar, rotatePannelLeft }: MainHeaderProps) => {
  return (
    <header className="h-12 border-b border-line bg-white sticky top-0 z-10 flex items-center justify-between px-4 pl-0">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={() => {
              onToggleSidebar();
            }}
            aria-label="Afficher / masquer le menu"
            className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-subtle hover:text-brand"
          >
            <PanelLeft className={`h-5 w-5 rotate-${rotatePannelLeft? "-180" : "180"}` } />
          </button>
        )}
      </div>

      <HeaderNavigationBar onNavClick={onNavClick} />
    </header>
  );
};
