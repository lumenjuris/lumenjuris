import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileText, MessagesSquare, PenTool } from "lucide-react";

import type { QueueGroup, QueueItem } from "./types";

/** Nombre de lignes affichées au maximum dans la file. */
const MAX_ROWS = 5;

const TABS: (QueueGroup | "Tout")[] = ["Tout", "Rédaction", "Signature", "Négociation"];

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
}

/**
 * File « À traiter aujourd'hui » : brouillons, signatures en attente et
 * négociations ouvertes, regroupés dans une seule liste filtrable.
 */
export function TodayQueue({ items, loading }: Props) {
  const [tab, setTab] = useState<QueueGroup | "Tout">("Tout");

  const filtered = tab === "Tout" ? items : items.filter((item) => item.group === tab);
  const visible = filtered.slice(0, MAX_ROWS);

  let subline = "Chargement…";
  if (!loading) {
    subline = items.length > 0
      ? `${filtered.length} élément${filtered.length > 1 ? "s" : ""}, triés par urgence`
      : "Rien en cours";
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e8eaf0] bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3.5 pt-4">
        <div className="flex items-baseline gap-2.5">
          <h2 className="font-serif text-[19px] font-normal text-ink">À traiter aujourd'hui</h2>
          <span className="text-xs text-ink-subtle">{subline}</span>
        </div>

        <div className="flex gap-0.5 rounded-[9px] bg-surface-subtle p-0.5">
          {TABS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setTab(label)}
              className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${
                label === tab
                  ? "bg-white text-blue-primary shadow-card"
                  : "text-ink-subtle hover:text-ink-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading && <QueueSkeleton />}

      {!loading && visible.length > 0 && (
        <div className="flex flex-col border-t border-line-subtle">
          {visible.map((item) => {
            const style = GROUP_STYLE[item.group];
            const Icon = style.icon;
            return (
              <Link
                key={item.key}
                to={item.to}
                className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line-subtle px-4 py-3.5 transition-shadow hover:bg-[#fafbfd] hover:shadow-[inset_2px_0_0_#213957]"
              >
                <span className={`flex h-[30px] w-[30px] items-center justify-center rounded-lg ${style.iconClassName}`}>
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
                  {item.action}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && visible.length === 0 && (
        <EmptyQueue hasItems={items.length > 0} />
      )}
    </section>
  );
}

/** Barres grises affichées pendant le chargement. */
function QueueSkeleton() {
  return (
    <div className="flex flex-col gap-3 border-t border-line-subtle px-4 py-5">
      {[0, 1, 2].map((row) => (
        <div key={row} className="h-9 animate-pulse rounded-lg bg-surface-subtle" />
      ))}
    </div>
  );
}

/**
 * Deux cas de file vide : aucun élément du tout (on invite à démarrer), ou
 * simplement aucun élément dans l'onglet sélectionné.
 */
function EmptyQueue({ hasItems }: { hasItems: boolean }) {
  if (hasItems) {
    return (
      <div className="border-t border-line-subtle px-6 py-10 text-center text-[13px] text-ink-subtle">
        Rien à traiter dans cette catégorie.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 border-t border-line-subtle px-6 pb-10 pt-9 text-center">
      <div className="flex w-full max-w-[330px] flex-col gap-1.5">
        <div className="h-2 w-full rounded-full bg-line-subtle" />
        <div className="h-2 w-[78%] rounded-full bg-surface-subtle" />
        <div className="h-2 w-[54%] rounded-full bg-[#f7f8fb]" />
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-serif text-[19px] text-blue-primary">Votre file de travail est vide</span>
        <span className="max-w-[390px] text-[13px] leading-relaxed text-ink-subtle">
          Générez un premier contrat ou importez un document existant : échéances,
          signatures et risques se suivent ensuite tout seuls.
        </span>
      </div>

      <div className="mt-0.5 flex gap-2">
        <Link
          to="/contrat-generation?section=scratch"
          className="flex h-9 items-center rounded-[9px] bg-blue-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          Générer un contrat
        </Link>
        <Link
          to="/contrat-generation?section=import"
          className="flex h-9 items-center rounded-[9px] border border-line bg-white px-4 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-surface-subtle"
        >
          Importer
        </Link>
      </div>
    </div>
  );
}
