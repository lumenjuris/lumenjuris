// Page « Mes négociations » : toutes les sessions (négociation et complétion
// guidée) de l'utilisateur, avec statut, progression et accès direct.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, FileText, MessagesSquare, Sparkles, Users } from "lucide-react";

import { DataTable, EmptyCell, type DataTableColumn } from "../../common/DataTable";
import { PageBanner } from "../../common/PageBanner";
import { negotiationApi } from "./api";
import { STATUS_LABEL, STATUS_STYLE, MODE_LABEL, MODE_STYLE } from "./types";
import type { NegotiationListItem } from "./types";

type SortKey = "title" | "status" | "completion" | "updatedAt";
type SortDirection = "asc" | "desc";

const STORAGE_KEY = "negotiation_table_visible_columns";
const DEFAULT_COLUMNS = ["title", "mode", "status", "completion", "updatedAt", "action"];

function fmtRelative(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l’instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 30) return `il y a ${j} j`;
  return new Date(d).toLocaleDateString("fr-FR");
}

/** Part des champs déjà remplis, de 0 à 100 (0 si la session n'en a pas). */
function completionPercent(item: NegotiationListItem): number {
  if (!item.completion || item.completion.total === 0) return 0;
  return Math.round((item.completion.filled / item.completion.total) * 100);
}

/** Trie les sessions sans modifier le tableau d'origine. */
function sortNegotiations(
  items: NegotiationListItem[],
  sortBy: SortKey,
  sortDirection: SortDirection,
): NegotiationListItem[] {
  return [...items].sort((a, b) => {
    let comparison: number;
    if (sortBy === "title") {
      comparison = a.title.localeCompare(b.title, "fr", { sensitivity: "base" });
    } else if (sortBy === "status") {
      comparison = a.status.localeCompare(b.status);
    } else if (sortBy === "completion") {
      comparison = completionPercent(a) - completionPercent(b);
    } else {
      comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });
}

export function NegotiationsList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NegotiationListItem[] | null>(null);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    negotiationApi.list()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur réseau"));
  }, []);

  const sortedItems = useMemo(
    () => sortNegotiations(items ?? [], sortBy, sortDirection),
    [items, sortBy, sortDirection],
  );

  const handleSort = (key: SortKey) => {
    if (key === sortBy) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      // Intitulé et statut : A → Z d'abord ; progression et dates : le plus haut d'abord.
      setSortDirection(key === "title" || key === "status" ? "asc" : "desc");
    }
  };

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger-light px-4 py-3 text-sm text-danger-dark">
        <AlertCircle className="h-4 w-4" /> {error}
      </div>
    );
  }

  const columns: DataTableColumn<NegotiationListItem, SortKey>[] = [
    {
      id: "title",
      label: "Intitulé",
      sortKey: "title",
      cell: (negotiation) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-xl bg-brand-light p-2 text-blue-primary transition-colors group-hover:bg-blue-primary group-hover:text-white">
            <MessagesSquare className="h-4 w-4" />
          </div>
          <span
            title={negotiation.title}
            className="max-w-[240px] truncate font-medium text-ink transition-colors group-hover:text-blue-primary"
          >
            {negotiation.title}
          </span>
        </div>
      ),
    },
    {
      id: "mode",
      label: "Mode",
      cell: (negotiation) => {
        const style = MODE_STYLE[negotiation.mode];
        return (
          <span
            className="whitespace-nowrap rounded-chip px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: style.bg, color: style.fg }}
          >
            {MODE_LABEL[negotiation.mode]}
          </span>
        );
      },
    },
    {
      id: "status",
      label: "Statut",
      sortKey: "status",
      cell: (negotiation) => {
        const style = STATUS_STYLE[negotiation.status];
        return (
          <span
            className="whitespace-nowrap rounded-chip px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: style.bg, color: style.fg }}
          >
            {negotiation.status === "VALIDATED" ? "Prêt à signer" : STATUS_LABEL[negotiation.status]}
          </span>
        );
      },
    },
    {
      id: "completion",
      label: "Complétion",
      sortKey: "completion",
      // Seules les sessions de complétion guidée ont des champs à remplir.
      cell: (negotiation) =>
        negotiation.completion ? (
          <span className="inline-flex items-center gap-2 whitespace-nowrap text-[11px] font-medium text-ink-muted">
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-muted">
              <span
                className="block h-full rounded-full bg-brand transition-all"
                style={{ width: `${completionPercent(negotiation)}%` }}
              />
            </span>
            {negotiation.completion.filled}/{negotiation.completion.total}
          </span>
        ) : (
          <EmptyCell />
        ),
    },
    {
      id: "counts",
      label: "Échanges",
      cellClassName: "whitespace-nowrap text-xs text-ink-secondary",
      cell: (negotiation) =>
        negotiation.mode === "NEGOTIATION" ? (
          <>
            {negotiation.counts.versions} version{negotiation.counts.versions > 1 ? "s" : ""}
            {" · "}
            {negotiation.counts.comments} commentaire{negotiation.counts.comments > 1 ? "s" : ""}
          </>
        ) : (
          <EmptyCell />
        ),
    },
    {
      id: "guests",
      label: "Invités",
      cellClassName: "text-xs text-ink-secondary",
      cell: (negotiation) => {
        const activeGuests = negotiation.guests.filter((guest) => guest.active);
        if (activeGuests.length === 0) return <EmptyCell />;

        const names = activeGuests.map((guest) => guest.name || guest.email || "invité").join(", ");
        return (
          <span title={names} className="inline-flex max-w-[200px] items-center gap-1 truncate">
            <Users className="h-3 w-3 shrink-0" />
            {names}
          </span>
        );
      },
    },
    {
      id: "updatedAt",
      label: "Dernière activité",
      sortKey: "updatedAt",
      cellClassName: "whitespace-nowrap text-xs text-ink-muted",
      cell: (negotiation) => fmtRelative(negotiation.updatedAt),
    },
    {
      id: "action",
      label: "Action",
      alignRight: true,
      cell: () => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold text-blue-primary">
          Ouvrir
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      ),
    },
  ];

  const countLabel = `${sortedItems.length} négociation${sortedItems.length > 1 ? "s" : ""}`;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageBanner
        title="Négociation"
        subtitle="Suivez les contrats partagés à l’autre partie : relecture, propositions de modification ou complétion des champs avant signature."
      />

      <DataTable
        items={sortedItems}
        loading={items === null}
        rowKey={(negotiation) => negotiation.id}
        columns={columns}
        defaultColumns={DEFAULT_COLUMNS}
        storageKey={STORAGE_KEY}
        sortBy={sortBy}
        sortDir={sortDirection}
        onSort={handleSort}
        onRowClick={(negotiation) => navigate(`/negociation/${negotiation.id}`)}
        empty={{
          icon: <MessagesSquare className="h-6 w-6 stroke-[1.5] text-ink-subtle" />,
          title: "Aucune négociation en cours",
          description:
            "Depuis l’éditeur de contrat, choisissez « Partager à l’autre partie » pour faire compléter ou relire un document. Vous pouvez aussi ouvrir une négociation depuis la fiche d’un contrat de la contrathèque.",
          action: (
            <div className="flex items-center gap-2">
              <Link
                to="/contrat-generation?section=scratch"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-brand-hover"
              >
                <Sparkles className="h-3.5 w-3.5" /> Créer un contrat
              </Link>
              <Link
                to="/contratheque"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3.5 py-2 text-xs font-semibold text-ink-secondary transition-all hover:bg-surface-subtle"
              >
                <FileText className="h-3.5 w-3.5" /> Ouvrir la contrathèque
              </Link>
            </div>
          ),
        }}
        summary={items === null ? null : countLabel}
      />
    </div>
  );
}
