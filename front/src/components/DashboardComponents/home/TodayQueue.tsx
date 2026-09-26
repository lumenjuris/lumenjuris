import { Link } from "react-router-dom";
import { ArrowRight, FileText, MessagesSquare, PenTool } from "lucide-react";

import { EmptyHint } from "./EmptyHint";
import { GuestPreview } from "./GuestPreview";
import { SectionCard, SectionSkeleton } from "./SectionCard";
import type { QueueGroup, QueueItem } from "./types";

/** Nombre de lignes affichées au maximum dans la file. */
const MAX_ROWS = 8;

/** Icône et couleurs de chaque famille de travail. */
const GROUP_STYLE: Record<QueueGroup, {
  icon: React.ElementType;
  iconClassName: string;
  tagClassName: string;
}> = {
  "Rédaction": {
    icon: FileText, iconClassName: "bg-brand-light text-blue-primary", tagClassName: "text-blue-primary",
  },
  "Signature": {
    icon: PenTool, iconClassName: "bg-info-light text-info", tagClassName: "text-info",
  },
  "Négociation": {
    icon: MessagesSquare, iconClassName: "bg-[#ede9fe] text-[#7c3aed]", tagClassName: "text-[#7c3aed]",
  },
};

interface Props {
  items: QueueItem[];
  loading: boolean;
  /** Vrai quand la page est consultée sans compte. */
  isGuest: boolean;
}

/**
 * File « À traiter » : brouillons, signatures en attente et négociations
 * ouvertes, dans une seule liste triée par urgence.
 */
export function TodayQueue({ items, loading, isGuest }: Props) {
  const visible = items.slice(0, MAX_ROWS);

  return (
    <SectionCard
      eyebrow="Vos actions en cours"
      title="À traiter"
      headerRight={
        !isGuest && !loading && items.length > MAX_ROWS ? (
          <span className="text-xs text-ink-subtle">
            {visible.length} sur {items.length}
          </span>
        ) : undefined
      }
    >
      {isGuest && (
        <GuestPreview
          description="Une fois connecté, vous retrouvez ici tout ce qui attend une action de votre part, sans avoir à ouvrir chaque module."
          examples={[
            "Les contrats encore en cours de rédaction",
            "Les signatures envoyées mais toujours en attente",
            "Les négociations où le cocontractant a proposé une modification",
          ]}
        />
      )}

      {!isGuest && loading && <SectionSkeleton />}

      {!isGuest && !loading && visible.length > 0 && (
        <div className="flex flex-col border-t border-line-subtle">
          {visible.map((item) => {
            const style = GROUP_STYLE[item.group];
            const Icon = style.icon;
            return (
              <Link
                key={item.key}
                to={item.to}
                className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line-subtle px-5 py-3.5 last:border-b-0 transition-all hover:bg-[#f8fafd] hover:shadow-[inset_3px_0_0_#213957]"
              >
                <span className={`flex h-[34px] w-[34px] items-center justify-center rounded-[11px] ${style.iconClassName}`}>
                  <Icon className="h-[15px] w-[15px]" />
                </span>

                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-[13.5px] font-semibold text-ink">{item.title}</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`shrink-0 text-2xs font-semibold uppercase tracking-[0.07em] ${style.tagClassName}`}>
                      {item.group}
                    </span>
                    <span className="h-2.5 w-px shrink-0 bg-line" />
                    <span className={`shrink-0 text-[11.5px] font-semibold ${item.isUrgent ? "text-red-primary" : "text-ink-muted"}`}>
                      {item.due}
                    </span>
                    <span className="min-w-0 truncate text-xs text-ink-subtle">{item.meta}</span>
                  </div>
                </div>

                <span className="flex items-center gap-1.5 justify-self-end whitespace-nowrap text-[12.5px] font-semibold text-blue-primary">
                  <span className="hidden sm:inline">{item.action}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {!isGuest && !loading && visible.length === 0 && (
        <EmptyHint>Aucun élément en cours.</EmptyHint>
      )}
    </SectionCard>
  );
}
