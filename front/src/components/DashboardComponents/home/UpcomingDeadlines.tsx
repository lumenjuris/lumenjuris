import { Link } from "react-router-dom";

import type { DeadlineCard } from "./types";

interface Props {
  items: DeadlineCard[];
  loading: boolean;
}

/**
 * Bloc « Échéances à venir » : les prochaines dates clés extraites des contrats
 * de la contrathèque (fin de contrat, préavis, information consommateur).
 */
export function UpcomingDeadlines({ items, loading }: Props) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e8eaf0] bg-white shadow-card">
      <div className="flex items-baseline justify-between px-4 pb-3.5 pt-4">
        <h2 className="font-serif text-[19px] font-normal text-ink">Échéances à venir</h2>
        <Link to="/contratheque?vue=echeances" className="text-[12.5px] font-semibold text-blue-primary hover:underline">
          Voir le calendrier
        </Link>
      </div>

      {loading && (
        <div className="flex flex-col gap-3 border-t border-line-subtle px-4 py-5">
          {[0, 1].map((row) => (
            <div key={row} className="h-9 animate-pulse rounded-lg bg-surface-subtle" />
          ))}
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="flex flex-col border-t border-line-subtle">
          {items.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-line-subtle px-4 py-3 transition-colors hover:bg-[#fafbfd]"
            >
              <div className="flex flex-col items-center gap-px border-r border-line-subtle py-1">
                <span className="font-serif text-[19px] font-normal leading-none tabular-nums text-blue-primary">
                  {item.day}
                </span>
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
                  {item.month}
                </span>
              </div>

              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-[13.5px] font-semibold text-ink">{item.title}</span>
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`shrink-0 text-2xs font-semibold uppercase tracking-[0.07em] ${item.tagClassName}`}>
                    {item.tag}
                  </span>
                  <span className="h-2.5 w-px shrink-0 bg-line" />
                  <span className="min-w-0 truncate text-xs text-ink-subtle">{item.party}</span>
                </div>
              </div>

              <span className="justify-self-end whitespace-nowrap text-[12.5px] font-semibold text-blue-primary">
                Ouvrir
              </span>
            </Link>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center gap-1.5 border-t border-line-subtle px-6 py-8 text-center">
          <span className="font-serif text-[17px] text-blue-primary">Aucune échéance suivie</span>
          <span className="max-w-[400px] text-[12.5px] leading-relaxed text-ink-subtle">
            Les dates clés sont extraites automatiquement de vos contrats :
            renouvellements, préavis, fins de période d'essai.
          </span>
        </div>
      )}
    </section>
  );
}
