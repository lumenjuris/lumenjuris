import { useEffect, useState } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  FileText,
  Trash2,
  RefreshCw,
  MoreVertical,
} from "lucide-react";
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
}

interface ColumnConfig {
  id: string;
  label: string;
  sortKey?: SortKey;
}

const STORAGE_KEY = "contract_table_visible_columns";
const DEFAULT_COLUMNS = ["title", "contractType","endDate", "status","action"];

const COLUMN_LIST: ColumnConfig[] = [
  { id: "title", label: "Intitulé", sortKey: "title" },
  { id: "contractType", label: "Type" },
  { id: "counterpartyName", label: "Cocontractant" },
  { id: "signatureDate", label: "Signature", sortKey: "signatureDate" },
  { id: "endDate", label: "Échéance", sortKey: "endDate" },
  { id: "status", label: "Statut", sortKey: "status" },
  { id: "responsibleName", label: "Responsable" },
  { id: "tags", label: "Tags" },
  { id: "action", label: "Action" },
];

/** Tableau principal de la liste des contrats. */
export function ContractTable({ items, loading, sortBy, sortDir, onSort, onOpen, canDelete, onDelete }: Props) {

   const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } 
    } catch (e) {
      console.error("Erreur de la lecture du localStorage", e);
    }
    return DEFAULT_COLUMNS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
    } catch (e) {
      console.error("Erreur de la sauvegarde dans le localStorage ", e);
    }
  }, [visibleColumns]);

  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuId(null);
    };
    window.addEventListener("click", handleClickOutside);
    return () => {
      window.removeEventListener("click", handleClickOutside);
    };
  }, []);

  const toggleColumn = (id: string) => {
    setVisibleColumns((prev) =>
      prev.includes(id) ? prev.filter((colId) => colId !== id) : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-card border border-line shadow-card overflow-hidden">
        <TableHeader
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
          visibleColumns={visibleColumns}
        />
        <div className="divide-y divide-line-subtle">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} visibleColumns={visibleColumns} />
          ))}
        </div>
      </div>
    );
  }

  {/* Rendu lorsque la liste d'items est vide */}
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-card border border-line shadow-card">
        <div className="w-14 h-14 rounded-card bg-surface-subtle border border-line flex items-center justify-center">
          <FileText className="w-6 h-6 text-ink-subtle stroke-[1.5]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-ink">Aucun contrat trouvé</p>
          <p className="text-xs text-ink-muted mt-1">
            Importez votre premier contrat pour commencer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Sélecteur de colonnes */}
      <div className="flex flex-wrap gap-4 rounded-xl mb-2">
        {COLUMN_LIST.map((col) => (
          <label key={col.id} className="inline-flex items-center gap-1.5 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={visibleColumns.includes(col.id)}
              onChange={() => toggleColumn(col.id)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            {col.label}
          </label>
        ))}
      </div>

      <div className="bg-white rounded-b-2xl border border-slate-200/80 shadow-sm">
        <div className="">
          <table className="w-full min-w-[720px] text-left border-collapse">
            <TableHeader
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
              visibleColumns={visibleColumns}
            />
            <tbody className="divide-y divide-slate-100 text-sm">
              {items.map((c) => {
                const d = daysUntil(c.endDate);
                const urgent = d !== null && d >= 0 && d <= 90;
                return (
                  <tr
                    key={c.id}
                    onClick={() => onOpen(c.id)}
                    className="hover:bg-slate-100 transition-colors cursor-pointer group"
                  >
                    {/* Intitulé */}
                    {visibleColumns.includes("title") && (
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 bg-blue-50/80 rounded-xl text-blue-700 shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium text-slate-900 truncate max-w-[220px] group-hover:text-blue-500 transition-colors">
                              {c.title}
                            </span>
                            {c.isB2C && (
                              <span
                                className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200/60 px-1.5 py-0.5 rounded-md shrink-0"
                                title="Contrat avec un consommateur (loi Châtel)"
                              >
                                B2C
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    )}

                    {/* Type */}
                    {visibleColumns.includes("contractType") && (
                      <td className="px-4 py-3.5 text-xs text-slate-500 font-medium">
                        {c.contractType ?? <span className="text-slate-300 font-light">—</span>}
                      </td>
                    )}

                    {/* Cocontractant */}
                    {visibleColumns.includes("counterpartyName") && (
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        {c.counterpartyName ?? <span className="text-slate-300 font-light">—</span>}
                      </td>
                    )}

                    {/* Signature */}
                    {visibleColumns.includes("signatureDate") && (
                      <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {fmtDate(c.signatureDate) ?? <span className="text-slate-300 font-light">—</span>}
                      </td>
                    )}

                    {/* Échéance */}
                    {visibleColumns.includes("endDate") && (
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600">
                            {fmtDate(c.endDate) ?? <span className="text-slate-300 font-light">—</span>}
                          </span>
                          {urgent && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md"
                              title={`Échéance dans ${d} jours`}
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-600" /> J‑{d}
                            </span>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Statut */}
                    {visibleColumns.includes("status") && (
                      <td className="px-4 py-3.5">
                        <StatusBadge status={c.status} />
                      </td>
                    )}

                    {/* Responsable */}
                    {visibleColumns.includes("responsibleName") && (
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        {c.responsibleName ?? <span className="text-slate-300 font-light">—</span>}
                      </td>
                    )}

                    {/* Tags & Reconduction */}
                    {visibleColumns.includes("tags") && (
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap max-w-[160px]">
                          {c.tags.slice(0, 2).map((t) => (
                            <span
                              key={t.id}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-md border border-slate-100"
                              style={{
                                backgroundColor: t.color + "15",
                                color: t.color,
                                borderColor: t.color + "30",
                              }}
                            >
                              {t.label}
                            </span>
                          ))}
                          {c.renewalType === "TACIT" && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md font-medium"
                              title="Tacite reconduction"
                            >
                              <RefreshCw className="w-2.5 h-2.5" /> Tacite
                            </span>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Action */}
                    {visibleColumns.includes("action") && (
                      <td className="px-4 py-3.5 text-right">
                        <div
                          className="relative inline-flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Bouton pour ouvrir/fermer le menu */}
                          <button
                            onClick={() =>
                              setOpenMenuId(openMenuId === c.id ? null : c.id)
                            }
                            className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100"
                            title="Options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Popover / Menu déroulant */}
                          {openMenuId === c.id && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-20 text-left">
                              {canDelete && (
                                <button
                                  onClick={() => {setOpenMenuId(null); onDelete?.(c.id, c.title)}}
                                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-danger-light hover:rounded-b-panel transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Supprimer
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TableHeader({
  sortBy,
  sortDir,
  onSort,
  visibleColumns,
}: {
  sortBy?: SortKey;
  sortDir?: "asc" | "desc";
  onSort: (k: SortKey) => void;
  visibleColumns: string[];
}) {
  return (
    <thead className="bg-blue-primary border-b border-line text-white text-[10px] uppercase tracking-widest font-semibold">
      <tr>
        {COLUMN_LIST.filter((col) => visibleColumns.includes(col.id)).map((col) => {
          if (col.sortKey) {
            return (
              <Th
                key={col.id}
                label={col.label}
                k={col.sortKey}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={onSort}
              />
            );
          }
          return (
            <th key={col.id} className="px-4 py-3">
              {col.label}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

function SkeletonRow({ visibleColumns }: { visibleColumns: string[] }) {
  return (
    <tr className="animate-pulse">
      {COLUMN_LIST.filter((col) => visibleColumns.includes(col.id)).map((col) => (
        <td key={col.id} className="px-4 py-3">
          <div className="h-3.5 w-20 rounded bg-surface-muted" />
        </td>
      ))}
    </tr>
  );
}

function Th({
  label,
  k,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string;
  k: SortKey;
  sortBy?: SortKey;
  sortDir?: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  const active = sortBy === k;
  return (
    <th className="px-4 py-3">
      <button
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 transition-colors uppercase tracking-widest text-[10px] font-semibold ${
          active ? "text-white" : "hover:text-gray-primary"
        }`}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-70" />
        )}
      </button>
    </th>
  );
}
