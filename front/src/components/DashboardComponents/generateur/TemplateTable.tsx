import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  MoreVertical,
  Sparkles,
  Trash2,
} from "lucide-react";
import { fmtDate } from "../contratheque/types";

/** Modèle enregistré, tel que renvoyé par GET /api/template. */
export interface TemplateListItem {
  id: string;
  name: string;
  contractType: string | null;
  sourceFilename: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  /** Nombre de champs (variables) du modèle. */
  variableCount?: number;
}

type SortKey = "name" | "variableCount" | "createdAt" | "updatedAt";
type SortDirection = "asc" | "desc";

interface Props {
  items: TemplateListItem[];
  loading: boolean;
  /** Ouvre le modèle pour générer un contrat. */
  onOpen: (id: string) => void;
  onDelete: (item: TemplateListItem) => void;
}

interface ColumnConfig {
  id: string;
  label: string;
  sortKey?: SortKey;
}

const STORAGE_KEY = "template_table_visible_columns";
const DEFAULT_COLUMNS = ["name", "contractType", "variableCount", "updatedAt", "action"];

const COLUMN_LIST: ColumnConfig[] = [
  { id: "name", label: "Nom", sortKey: "name" },
  { id: "contractType", label: "Type" },
  { id: "origin", label: "Origine" },
  { id: "sourceFilename", label: "Fichier source" },
  { id: "variableCount", label: "Champs", sortKey: "variableCount" },
  { id: "version", label: "Version" },
  { id: "createdAt", label: "Créé le", sortKey: "createdAt" },
  { id: "updatedAt", label: "Modifié le", sortKey: "updatedAt" },
  { id: "action", label: "Action" },
];

/** Trie les modèles sans modifier le tableau d'origine. */
function sortTemplates(items: TemplateListItem[], sortBy: SortKey, sortDirection: SortDirection): TemplateListItem[] {
  return [...items].sort((a, b) => {
    let comparison: number;
    if (sortBy === "name") {
      comparison = a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
    } else if (sortBy === "variableCount") {
      comparison = (a.variableCount ?? 0) - (b.variableCount ?? 0);
    } else {
      comparison = new Date(a[sortBy]).getTime() - new Date(b[sortBy]).getTime();
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });
}

/** Tableau des modèles enregistrés (même design que le tableau de la contrathèque). */
export function TemplateTable({ items, loading, onOpen, onDelete }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Menu d'actions en position fixe : il n'est pas coupé par le défilement horizontal du tableau.
  const [openMenu, setOpenMenu] = useState<{ id: string; top: number; right: number } | null>(null);

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

  // Le menu se ferme au clic ailleurs, au défilement et au redimensionnement
  // (sinon, étant en position fixe, il resterait flotter loin de sa ligne).
  useEffect(() => {
    const closeMenu = () => setOpenMenu(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, []);

  const sortedItems = useMemo(() => sortTemplates(items, sortBy, sortDirection), [items, sortBy, sortDirection]);

  const toggleColumn = (id: string) => {
    setVisibleColumns((prev) =>
      prev.includes(id) ? prev.filter((colId) => colId !== id) : [...prev, id]
    );
  };

  const handleSort = (key: SortKey) => {
    if (key === sortBy) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      // Nom : A → Z d'abord ; nombres et dates : les plus grands / récents d'abord.
      setSortDirection(key === "name" ? "asc" : "desc");
    }
  };

  const toggleMenu = (id: string, button: HTMLElement) => {
    if (openMenu?.id === id) {
      setOpenMenu(null);
      return;
    }
    const buttonBox = button.getBoundingClientRect();
    setOpenMenu({ id, top: buttonBox.bottom + 4, right: window.innerWidth - buttonBox.right });
  };

  const menuItem = openMenu ? items.find((item) => item.id === openMenu.id) : undefined;

  const columnSelector = (
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
  );

  if (loading) {
    return (
      <div>
        {columnSelector}
        <div className="bg-white rounded-b-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
          <table className="w-full min-w-[720px] text-left border-collapse">
            <TableHeader sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} visibleColumns={visibleColumns} />
            <tbody className="divide-y divide-line-subtle">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonRow key={i} visibleColumns={visibleColumns} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 bg-white rounded-card border border-line shadow-card">
        <div className="w-14 h-14 rounded-card bg-surface-subtle border border-line flex items-center justify-center">
          <FileText className="w-6 h-6 text-ink-subtle stroke-[1.5]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-ink">Aucun modèle enregistré</p>
          <p className="text-xs text-ink-muted mt-1">Importez un contrat pour en faire un modèle réutilisable.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {columnSelector}

      <div className="bg-white rounded-b-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[720px] text-left border-collapse">
          <TableHeader sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} visibleColumns={visibleColumns} />
          <tbody className="divide-y divide-slate-100 text-sm">
            {sortedItems.map((template) => {
              const isImported = Boolean(template.sourceFilename);
              return (
                <tr
                  key={template.id}
                  onClick={() => onOpen(template.id)}
                  className="hover:bg-slate-100 transition-colors duration-700 cursor-pointer group"
                >
                  {/* Nom */}
                  {visibleColumns.includes("name") && (
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-blue-50/80 rounded-xl text-blue-700 shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span
                          title={template.name}
                          className="font-medium text-slate-900 truncate max-w-[220px] group-hover:text-blue-500 transition-colors"
                        >
                          {template.name}
                        </span>
                      </div>
                    </td>
                  )}

                  {/* Type */}
                  {visibleColumns.includes("contractType") && (
                    <td className="px-4 py-3.5 text-xs text-slate-500 font-medium">
                      {template.contractType ?? <span className="text-slate-300 font-light">—</span>}
                    </td>
                  )}

                  {/* Origine : importé depuis un document ou généré « de zéro » */}
                  {visibleColumns.includes("origin") && (
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                          isImported
                            ? "text-emerald-700 bg-emerald-50 border-emerald-200/60"
                            : "text-purple-700 bg-purple-50 border-purple-200/60"
                        }`}
                      >
                        {isImported ? "Importé" : "Généré"}
                      </span>
                    </td>
                  )}

                  {/* Fichier source */}
                  {visibleColumns.includes("sourceFilename") && (
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {template.sourceFilename ? (
                        <span title={template.sourceFilename} className="block truncate max-w-[180px]">
                          {template.sourceFilename}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-light">—</span>
                      )}
                    </td>
                  )}

                  {/* Champs */}
                  {visibleColumns.includes("variableCount") && (
                    <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                      {template.variableCount ?? <span className="text-slate-300 font-light">—</span>}
                    </td>
                  )}

                  {/* Version */}
                  {visibleColumns.includes("version") && (
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">v{template.version}</td>
                  )}

                  {/* Créé le */}
                  {visibleColumns.includes("createdAt") && (
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">{fmtDate(template.createdAt)}</td>
                  )}

                  {/* Modifié le */}
                  {visibleColumns.includes("updatedAt") && (
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">{fmtDate(template.updatedAt)}</td>
                  )}

                  {/* Action */}
                  {visibleColumns.includes("action") && (
                    <td className="px-4 py-3.5 text-right">
                      <div className="relative inline-flex items-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => toggleMenu(template.id, e.currentTarget)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100"
                          title="Options"
                          aria-haspopup="menu"
                          aria-expanded={openMenu?.id === template.id}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Menu d'actions de la ligne ouverte */}
      {openMenu && menuItem && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{ top: openMenu.top, right: openMenu.right }}
          className="fixed w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-50 text-left overflow-hidden"
        >
          <button
            role="menuitem"
            onClick={() => { setOpenMenu(null); onOpen(menuItem.id); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ink-secondary hover:bg-slate-100 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Utiliser
          </button>
          <button
            role="menuitem"
            onClick={() => { setOpenMenu(null); onDelete(menuItem); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-danger-light transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Supprimer
          </button>
        </div>
      )}
    </div>
  );
}

function TableHeader({
  sortBy,
  sortDirection,
  onSort,
  visibleColumns,
}: {
  sortBy: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
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
                sortKey={col.sortKey}
                sortBy={sortBy}
                sortDirection={sortDirection}
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
  sortKey,
  sortBy,
  sortDirection,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sortBy: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
}) {
  const active = sortBy === sortKey;
  return (
    <th className="px-4 py-3">
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 transition-colors uppercase tracking-widest text-[10px] font-semibold ${
          active ? "text-white" : "hover:text-gray-primary"
        }`}
      >
        {label}
        {active ? (
          sortDirection === "asc" ? (
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
