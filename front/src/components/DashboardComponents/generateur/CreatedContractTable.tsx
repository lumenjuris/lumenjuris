import { useMemo, useState } from "react";
import { FileText, FolderOpen, Trash2 } from "lucide-react";

import { DataTable, EmptyCell, type DataTableColumn } from "../../common/DataTable";
import { RowActionsMenu } from "../../common/RowActionsMenu";
import type { CreatedContract } from "./createdContracts";

type SortKey = "title" | "variableCount" | "createdAt";
type SortDirection = "asc" | "desc";

interface Props {
  items: CreatedContract[];
  /** Rouvre le contrat dans l'éditeur. */
  onOpen: (contract: CreatedContract) => void;
  /** Retire le contrat de l'historique local. */
  onDelete: (contract: CreatedContract) => void;
}

const STORAGE_KEY = "created_contract_table_visible_columns";
const DEFAULT_COLUMNS = ["title", "modelLabel", "variableCount", "createdAt", "action"];

/** Date + heure lisibles (plusieurs contrats peuvent être créés le même jour). */
function formatCreatedAt(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "—";
  }
}

/** Nombre de champs (variables) du contrat. */
function countVariables(contract: CreatedContract): number {
  return contract.model?.variables?.length ?? 0;
}

/** Trie les contrats sans modifier le tableau d'origine. */
function sortContracts(items: CreatedContract[], sortBy: SortKey, sortDirection: SortDirection): CreatedContract[] {
  return [...items].sort((a, b) => {
    let comparison: number;
    if (sortBy === "title") {
      comparison = a.title.localeCompare(b.title, "fr", { sensitivity: "base" });
    } else if (sortBy === "variableCount") {
      comparison = countVariables(a) - countVariables(b);
    } else {
      comparison = a.createdAt - b.createdAt;
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });
}

/** Tableau de l'historique des contrats créés. */
export function CreatedContractTable({ items, onOpen, onDelete }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedItems = useMemo(
    () => sortContracts(items, sortBy, sortDirection),
    [items, sortBy, sortDirection],
  );

  const handleSort = (key: SortKey) => {
    if (key === sortBy) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      // Nom : A → Z d'abord ; nombres et dates : les plus grands / récents d'abord.
      setSortDirection(key === "title" ? "asc" : "desc");
    }
  };

  const columns: DataTableColumn<CreatedContract, SortKey>[] = [
    {
      id: "title",
      label: "Nom",
      sortKey: "title",
      cell: (contract) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-xl bg-brand-light p-2 text-blue-primary transition-colors group-hover:bg-blue-primary group-hover:text-white">
            <FileText className="h-4 w-4" />
          </div>
          <span
            title={contract.title}
            className="max-w-[220px] truncate font-medium text-ink transition-colors group-hover:text-blue-primary"
          >
            {contract.title}
          </span>
        </div>
      ),
    },
    {
      id: "modelLabel",
      label: "Type",
      cellClassName: "text-xs font-medium text-ink-muted",
      cell: (contract) => contract.model?.label || <EmptyCell />,
    },
    {
      id: "variableCount",
      label: "Champs",
      sortKey: "variableCount",
      cellClassName: "whitespace-nowrap text-xs text-ink-secondary",
      cell: (contract) => countVariables(contract),
    },
    {
      id: "blockCount",
      label: "Clauses",
      cellClassName: "whitespace-nowrap text-xs text-ink-secondary",
      cell: (contract) => contract.model?.blocks?.length ?? 0,
    },
    {
      id: "createdAt",
      label: "Créé le",
      sortKey: "createdAt",
      cellClassName: "whitespace-nowrap text-xs text-ink-muted",
      cell: (contract) => formatCreatedAt(contract.createdAt),
    },
    {
      id: "action",
      label: "Action",
      alignRight: true,
      cell: (contract) => (
        <RowActionsMenu
          actions={[
            {
              label: "Ouvrir",
              icon: <FolderOpen className="h-3.5 w-3.5" />,
              onSelect: () => onOpen(contract),
            },
            {
              label: "Retirer de l'historique",
              icon: <Trash2 className="h-3.5 w-3.5" />,
              danger: true,
              onSelect: () => onDelete(contract),
            },
          ]}
        />
      ),
    },
  ];

  const countLabel = `${items.length} contrat${items.length > 1 ? "s" : ""}`;

  return (
    <DataTable
      items={sortedItems}
      rowKey={(contract) => contract.id}
      columns={columns}
      defaultColumns={DEFAULT_COLUMNS}
      storageKey={STORAGE_KEY}
      sortBy={sortBy}
      sortDir={sortDirection}
      onSort={handleSort}
      onRowClick={onOpen}
      empty={{
        title: "Aucun contrat créé",
        description: "Les contrats générés depuis un modèle apparaîtront ici.",
      }}
      summary={countLabel}
    />
  );
}
