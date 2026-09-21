import { useEffect, useState } from "react";
import { AlertTriangle, FileText, MoreVertical, RefreshCw, Trash2 } from "lucide-react";

import { DataTable, EmptyCell, type DataTableColumn } from "../../common/DataTable";
import { StatusBadge } from "./StatusBadge";
import { fmtDate, daysUntil } from "./types";
import type { ContractListItem, ListFilters } from "./types";

type SortKey = NonNullable<ListFilters["sortBy"]>;

interface Props {
  items: ContractListItem[];
  loading: boolean;
  sortBy?: SortKey;
  sortDir?: "asc" | "desc";
  onSort: (key: SortKey) => void;
  onOpen: (id: string) => void;
  canDelete?: boolean;
  onDelete?: (id: string, title: string) => void;
  /** Lignes à surligner (ex. contrats tout juste importés). */
  highlightedIds?: string[];
}

const STORAGE_KEY = "contract_table_visible_columns";
const DEFAULT_COLUMNS = ["title", "contractType", "endDate", "status", "action"];

/** En deçà de ce délai, l'échéance est signalée par un badge orange. */
const URGENT_WITHIN_DAYS = 90;

/** Tableau principal de la liste des contrats. */
export function ContractTable({
  items, loading, sortBy, sortDir, onSort, onOpen, canDelete, onDelete, highlightedIds = [],
}: Props) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const columns: DataTableColumn<ContractListItem, SortKey>[] = [
    {
      id: "title",
      label: "Intitulé",
      sortKey: "title",
      cell: (contract) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-xl bg-brand-light p-2 text-blue-primary transition-colors group-hover:bg-blue-primary group-hover:text-white">
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="max-w-[220px] truncate font-medium text-ink transition-colors group-hover:text-blue-primary">
              {contract.title}
            </span>
            {contract.isB2C && (
              <span
                className="shrink-0 rounded-md border border-purple-200/60 bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700"
                title="Contrat avec un consommateur (loi Châtel)"
              >
                B2C
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "contractType",
      label: "Type",
      cellClassName: "text-xs font-medium text-ink-muted",
      cell: (contract) => contract.contractType ?? <EmptyCell />,
    },
    {
      id: "counterpartyName",
      label: "Cocontractant",
      cellClassName: "text-xs text-ink-secondary",
      cell: (contract) => contract.counterpartyName ?? <EmptyCell />,
    },
    {
      id: "signatureDate",
      label: "Signature",
      sortKey: "signatureDate",
      cellClassName: "whitespace-nowrap text-xs text-ink-muted",
      cell: (contract) => fmtDate(contract.signatureDate) ?? <EmptyCell />,
    },
    {
      id: "endDate",
      label: "Échéance",
      sortKey: "endDate",
      cellClassName: "whitespace-nowrap",
      cell: (contract) => {
        const remainingDays = daysUntil(contract.endDate);
        const isUrgent =
          remainingDays !== null && remainingDays >= 0 && remainingDays <= URGENT_WITHIN_DAYS;

        return (
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-secondary">
              {fmtDate(contract.endDate) ?? <EmptyCell />}
            </span>
            {isUrgent && (
              <span
                className="inline-flex items-center gap-1 rounded-md border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                title={`Échéance dans ${remainingDays} jours`}
              >
                <AlertTriangle className="h-3 w-3 text-amber-600" /> J‑{remainingDays}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "status",
      label: "Statut",
      sortKey: "status",
      cell: (contract) => <StatusBadge status={contract.status} />,
    },
    {
      id: "responsibleName",
      label: "Responsable",
      cellClassName: "text-xs text-ink-secondary",
      cell: (contract) => contract.responsibleName ?? <EmptyCell />,
    },
    {
      id: "tags",
      label: "Tags",
      cell: (contract) => (
        <div className="flex max-w-[160px] flex-wrap items-center gap-1.5">
          {contract.tags.slice(0, 2).map((tag) => (
            <span
              key={tag.id}
              className="rounded-md border px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: tag.color + "15",
                color: tag.color,
                borderColor: tag.color + "30",
              }}
            >
              {tag.label}
            </span>
          ))}
          {contract.renewalType === "TACIT" && (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600"
              title="Tacite reconduction"
            >
              <RefreshCw className="h-2.5 w-2.5" /> Tacite
            </span>
          )}
        </div>
      ),
    },
    {
      id: "action",
      label: "Action",
      alignRight: true,
      cell: (contract) => (
        // Le clic sur le menu ne doit pas ouvrir la fiche du contrat.
        <div className="relative inline-flex items-center" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setOpenMenuId(openMenuId === contract.id ? null : contract.id)}
            className="rounded-lg p-1.5 text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink-secondary"
            title="Options"
            aria-haspopup="menu"
            aria-expanded={openMenuId === contract.id}
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {openMenuId === contract.id && (
            <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-line bg-white text-left shadow-lg">
              {canDelete && (
                <button
                  type="button"
                  onClick={() => { setOpenMenuId(null); onDelete?.(contract.id, contract.title); }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-danger transition-colors hover:rounded-xl hover:bg-danger-light"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </button>
              )}
            </div>
          )}
        </div>
      ),
    },
  ];

  const countLabel = `${items.length} contrat${items.length > 1 ? "s" : ""}`;

  return (
    <DataTable
      items={items}
      loading={loading}
      skeletonRows={6}
      rowKey={(contract) => contract.id}
      columns={columns}
      defaultColumns={DEFAULT_COLUMNS}
      storageKey={STORAGE_KEY}
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={onSort}
      onRowClick={(contract) => onOpen(contract.id)}
      rowClassName={(contract) => (highlightedIds.includes(contract.id) ? "bg-success-light" : "")}
      empty={{
        title: "Aucun contrat trouvé",
        description: "Importez votre premier contrat pour commencer.",
      }}
      summary={loading ? null : countLabel}
    />
  );
}
