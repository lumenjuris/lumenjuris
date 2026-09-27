import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { EmptyHint } from "./EmptyHint";
import { GuestPreview } from "./GuestPreview";
import { SectionCard, SectionSkeleton } from "./SectionCard";
import type { DeadlineCard } from "./types";

interface Props {
  items: DeadlineCard[];
  loading: boolean;
  /** Vrai quand la page est consultée sans compte. */
  isGuest: boolean;
}

/**
 * Bloc « Échéances à venir » : les prochaines dates clés extraites des contrats
 * de la contrathèque (fin de contrat, préavis, information consommateur).
 *
 * Il vit dans la colonne de droite : la mise en page reste étroite (pastille de
 * date + titre), le lien de fin de ligne se réduit à un chevron.
 */
export function UpcomingDeadlines({ items, loading, isGuest }: Props) {
  return (
    <SectionCard
      eyebrow="Agenda"
      title="Échéances à venir"
      headerRight={
        isGuest ? undefined : (
        <Link
          to="/contratheque?vue=echeances"
          className="text-[12.5px] font-semibold text-blue-primary hover:underline"
        >
          Calendrier
        </Link>
        )
      }
    >
      {isGuest && (
        <GuestPreview
          description="Les dates clés sont extraites automatiquement de vos contrats : vous n'avez pas à tenir d'agenda à part."
          examples={[
            "Fins de contrat et reconductions tacites",
            "Délais de préavis à respecter",
            "Obligations d'information à date fixe",
          ]}
        />
      )}

      {!isGuest && loading && <SectionSkeleton rows={2} />}

      {!isGuest && !loading && items.length > 0 && (
        <div className="flex flex-col border-t border-line-subtle">
          {items.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className="group grid grid-cols-[42px_minmax(0,1fr)_14px] items-center gap-3 border-b border-line-subtle px-5 py-3 last:border-b-0 transition-colors hover:bg-[#f8fafd]"
            >
              <div className="flex flex-col items-center gap-px rounded-[11px] bg-brand-light py-1.5">
                <span className="font-serif text-[18px] font-normal leading-none tabular-nums text-blue-primary">
                  {item.day}
                </span>
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-blue-primary/70">
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

              <ChevronRight className="h-3.5 w-3.5 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-blue-primary" />
            </Link>
          ))}
        </div>
      )}

      {!isGuest && !loading && items.length === 0 && (
        <EmptyHint>Aucune échéance à venir.</EmptyHint>
      )}
    </SectionCard>
  );
}
