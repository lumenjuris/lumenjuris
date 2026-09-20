import { useMemo, useState } from "react";
import { Check, ExternalLink, FileText, FolderPlus, Loader2, Trash2 } from "lucide-react";

import { DataTable, type DataTableColumn } from "../../common/DataTable";
import { RowActionsMenu, type RowAction } from "../../common/RowActionsMenu";
import type { ContractHistoryItem } from "../../../utils/contractHistory";
import { formatDate, getRiskLevel, getRiskStyles } from "./riskLevel";

/** État de l'ajout d'un document à la contrathèque, par identifiant d'analyse. */
export type AddState = Record<string, "saving" | "done">;

type SortKey = "fileName" | "clausesCount" | "risk" | "createdAt";
type SortDirection = "asc" | "desc";

interface Props {
  items: ContractHistoryItem[];
  /** Rouvre l'analyse dans l'analyzer. */
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onAddToContratheque: (item: ContractHistoryItem) => void;
  addState: AddState;
}

const STORAGE_KEY = "analysis_history_table_visible_columns";
const DEFAULT_COLUMNS = ["fileName", "clausesCount", "risk", "createdAt", "action"];

/** Trie l'historique sans modifier le tableau d'origine. */
function sortAnalyses(
  items: ContractHistoryItem[],
  sortBy: SortKey,
  sortDirection: SortDirection,
): ContractHistoryItem[] {
  return [...items].sort((a, b) => {
    let comparison: number;
    if (sortBy === "fileName") {
      comparison = (a.fileName ?? "").localeCompare(b.fileName ?? "", "fr", { sensitivity: "base" });
    } else if (sortBy === "clausesCount") {
      comparison = (a.clausesCount ?? 0) - (b.clausesCount ?? 0);
    } else if (sortBy === "risk") {
      comparison = (a.overallRiskScore ?? 0) - (b.overallRiskScore ?? 0);
    } else {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });
}

/** Tableau de l'historique des analyses de conformité. */
export function AnalysisHistoryTable({ items, onOpen, onDelete, onAddToContratheque, addState }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedItems = useMemo(
    () => sortAnalyses(items, sortBy, sortDirection),
    [items, sortBy, sortDirection],
  );

  const handleSort = (key: SortKey) => {
    if (key === sortBy) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      // Nom : A → Z d'abord ; scores et dates : les plus élevés / récents d'abord.
      setSortDirection(key === "fileName" ? "asc" : "desc");
    }
  };

  /** Actions du menu « ⋮ » : l'entrée contrathèque suit l'état de l'ajout. */
  const buildActions = (item: ContractHistoryItem): RowAction[] => {
    const state = addState[item.id];

    let addLabel = "Ajouter à la contrathèque";
    let addIcon = <FolderPlus className="h-3.5 w-3.5" />;
    if (state === "saving") {
      addLabel = "Ajout en cours…";
      addIcon = <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    }
    if (state === "done") {
      addLabel = "Ajouté à la contrathèque";
      addIcon = <Check className="h-3.5 w-3.5 text-success" />;
    }

    return [
      {
        label: "Ouvrir",
        icon: <ExternalLink className="h-3.5 w-3.5" />,
        onSelect: () => onOpen(item.id),
      },
      {
        label: addLabel,
        icon: addIcon,
        disabled: state === "saving" || state === "done",
        onSelect: () => onAddToContratheque(item),
      },
      {
        label: "Supprimer",
        icon: <Trash2 className="h-3.5 w-3.5" />,
        danger: true,
        onSelect: () => onDelete(item.id),
      },
    ];
  };

  const columns: DataTableColumn<ContractHistoryItem, SortKey>[] = [
    {
      id: "fileName",
      label: "Document",
      sortKey: "fileName",
      cell: (item) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-panel border border-line bg-surface-subtle text-blue-primary transition-colors group-hover:bg-blue-primary group-hover:text-white">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="max-w-xs truncate text-sm font-medium text-ink transition-colors group-hover:text-blue-primary">
              {item.fileName}
            </p>
            <p className="mt-0.5 text-xs text-ink-subtle">
              {item.status === "analyzed" ? "Analysé" : "En cours"}
              {item.activePatchCount > 0 ? ` · ${item.activePatchCount} modif.` : ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "clausesCount",
      label: "Clauses",
      sortKey: "clausesCount",
      cellClassName: "text-sm text-ink-muted",
      cell: (item) => item.clausesCount ?? "—",
    },
    {
      id: "risk",
      label: "Priorité",
      sortKey: "risk",
      cell: (item) => {
        const level = getRiskLevel(item.overallRiskScore);
        if (level === "—") return <span className="text-xs text-ink-placeholder">—</span>;
        return (
          <span
            className={`inline-flex items-center rounded-chip border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${getRiskStyles(level)}`}
          >
            {level}
          </span>
        );
      },
    },
    {
      id: "createdAt",
      label: "Date",
      sortKey: "createdAt",
      cellClassName: "whitespace-nowrap text-xs text-ink-subtle",
      cell: (item) => formatDate(item.createdAt),
    },
    {
      id: "action",
      label: "Action",
      alignRight: true,
      cell: (item) => <RowActionsMenu actions={buildActions(item)} />,
    },
  ];

  const countLabel = `${items.length} document${items.length > 1 ? "s" : ""}`;

  return (
    <DataTable
      items={sortedItems}
      rowKey={(item) => item.id}
      columns={columns}
      defaultColumns={DEFAULT_COLUMNS}
      storageKey={STORAGE_KEY}
      sortBy={sortBy}
      sortDir={sortDirection}
      onSort={handleSort}
      onRowClick={(item) => onOpen(item.id)}
      empty={{
        title: "Aucun document analysé",
        description: "Lancez une analyse pour retrouver ici vos documents et leur niveau de risque.",
      }}
      summary={countLabel}
    />
  );
}
