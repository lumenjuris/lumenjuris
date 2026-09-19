// UI //
import { MouseEvent, useEffect, useState } from "react";
import HeaderNavigationBar from "./HeaderNavigationBar";
import { PanelLeft } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";




type NavigationClickHandler = (
  event?: MouseEvent<HTMLElement>,
) => boolean | void;

interface MainHeaderProps {
  onNavClick?: NavigationClickHandler;
  setIsConnected?: React.Dispatch<React.SetStateAction<boolean>>;
  onToggleSidebar?: () => void;
  rotatePannelLeft:boolean
}

// Un chiffre qui "roule" vers le haut quand sa valeur change (comme un compteur mécanique)
const RollingDigit = ({ digit }: { digit: string }) => {
  return (
    <span className="relative inline-block h-5 w-[0.62em] overflow-hidden align-middle">
      <AnimatePresence initial={false}>
        <motion.span
          key={digit}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

// Petit cadran : un anneau se remplit au fil des 60 secondes, un point en suit la pointe,
// et un halo pulse à chaque nouvelle minute
const SecondsDial = ({ seconds }: { seconds: number }) => {
  const radius = 7
  const circumference = 2 * Math.PI * radius
  const progress = seconds / 60
  const dotAngle = progress * 360

  // Au passage de 59 à 0, on coupe la transition pour que l'anneau ne "rembobine" pas à l'envers
  const isNewMinute = seconds === 0
  const sweepTransition = isNewMinute ? "none" : "all 1s linear"

  return (
    <span className="relative flex h-5 w-5 items-center justify-center">
      {/* Halo qui s'élargit à chaque nouvelle minute */}
      <AnimatePresence>
        {isNewMinute && (
          <motion.span
            key="minute-pulse"
            initial={{ scale: 0.6, opacity: 0.5 }}
            animate={{ scale: 1.8, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute inset-0 rounded-full bg-brand"
          />
        )}
      </AnimatePresence>

      <svg viewBox="0 0 20 20" className="h-5 w-5 -rotate-90">
        {/* Piste grise */}
        <circle cx="10" cy="10" r={radius} fill="none" strokeWidth="2" className="stroke-line-emphasis" />
        {/* Progression des secondes */}
        <circle
          cx="10"
          cy="10"
          r={radius}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          className="stroke-brand"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: sweepTransition }}
        />
        {/* Point lumineux à la pointe de l'anneau */}
        <g style={{ transform: `rotate(${dotAngle}deg)`, transformOrigin: "10px 10px", transition: sweepTransition }}>
          <circle cx={10 + radius} cy="10" r="1.8" className="fill-white stroke-brand" strokeWidth="1" />
        </g>
      </svg>

    </span>
  )
}

const TodayClock = () => {
  const [now, setNow] = useState<Date>(new Date())

  useEffect(() => {
    const intervalId = setInterval(() => setNow(new Date()), 1000)
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
      <span className="flex items-center font-semibold tabular-nums text-brand">
        <RollingDigit digit={hours[0]} />
        <RollingDigit digit={hours[1]} />
        <span className="px-px">h</span>
        <RollingDigit digit={minutes[0]} />
        <RollingDigit digit={minutes[1]} />
      <SecondsDial seconds={now.getSeconds()} />
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

