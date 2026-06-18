import { FileStack, CalendarClock } from "lucide-react";

export type ContrathequeTab = "contrats" | "echeances";

/** Bascule d'onglets entre la liste des contrats et la gestion des échéances. */
export function ViewTabs({ tab, onTab }: { tab: ContrathequeTab; onTab: (t: ContrathequeTab) => void }) {
  return (
    <div className="inline-flex items-center bg-surface-muted rounded-xl p-1 gap-0.5">
      <Pill active={tab === "contrats"} onClick={() => onTab("contrats")} icon={FileStack}>
        Contrats
      </Pill>
      <Pill active={tab === "echeances"} onClick={() => onTab("echeances")} icon={CalendarClock}>
        Échéances
      </Pill>
    </div>
  );
}

function Pill({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
        active
          ? "bg-white text-brand shadow-card"
          : "text-ink-muted hover:text-ink-secondary"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {children}
    </button>
  );
}
