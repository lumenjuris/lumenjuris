// UI //
import { MouseEvent, useEffect, useState } from "react";
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

const TodayClock = () => {
  const [now, setNow] = useState<Date>(new Date())

  useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(intervalId)
  }, [])

  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  }
  const today = now.toLocaleDateString("fr-FR", options)
  const hours = String(now.getHours()).padStart(2, "0")
  const minutes = String(now.getMinutes()).padStart(2, "0")

  return (
    <div className="hidden md:flex items-center gap-2.5 rounded-full bg-surface-subtle py-1.5 pl-2 pr-3.5 text-sm">
      <span className="font-medium capitalize text-ink-secondary">{today}</span>
      <span className="h-4 w-px bg-line-emphasis" />
      <span className="font-semibold tabular-nums text-brand">
        {hours}h{minutes}
      </span>
    </div>
  )
}



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

      <TodayClock />
      <HeaderNavigationBar onNavClick={onNavClick} />



    </header>
  );
};

