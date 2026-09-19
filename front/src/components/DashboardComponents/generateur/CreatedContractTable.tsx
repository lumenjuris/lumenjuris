import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  FolderOpen,
  MoreVertical,
  Trash2,
} from "lucide-react";
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

interface ColumnConfig {
  id: string;
  label: string;
  sortKey?: SortKey;
}

const STORAGE_KEY = "created_contract_table_visible_columns";
const DEFAULT_COLUMNS = ["title", "modelLabel", "variableCount", "createdAt", "action"];

const COLUMN_LIST: ColumnConfig[] = [
  { id: "title", label: "Nom", sortKey: "title" },
  { id: "modelLabel", label: "Type" },
  { id: "variableCount", label: "Champs", sortKey: "variableCount" },
  { id: "blockCount", label: "Clauses" },
  { id: "createdAt", label: "Créé le", sortKey: "createdAt" },
  { id: "action", label: "Action" },
];

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

/** Tableau de l'historique des contrats créés (même design que le tableau des modèles enregistrés). */
export function CreatedContractTable({ items, onOpen, onDelete }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
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

  const sortedItems = useMemo(() => sortContracts(items, sortBy, sortDirection), [items, sortBy, sortDirection]);

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
      setSortDirection(key === "title" ? "asc" : "desc");
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

  return (
    <div>
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

      <div className="bg-white rounded-b-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[720px] text-left border-collapse">
          <TableHeader sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} visibleColumns={visibleColumns} />
          <tbody className="divide-y divide-slate-100 text-sm">
            {sortedItems.map((contract) => (
              <tr
                key={contract.id}
                onClick={() => onOpen(contract)}
                className="hover:bg-slate-100 transition-colors duration-700 cursor-pointer group"
              >
                {/* Nom */}
                {visibleColumns.includes("title") && (
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-blue-50/80 rounded-xl text-blue-700 shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span
                        title={contract.title}
                        className="font-medium text-slate-900 truncate max-w-[220px] group-hover:text-blue-500 transition-colors"
                      >
                        {contract.title}
                      </span>
                    </div>
                  </td>
                )}

                {/* Type (libellé du modèle utilisé) */}
                {visibleColumns.includes("modelLabel") && (
                  <td className="px-4 py-3.5 text-xs text-slate-500 font-medium">
                    {contract.model?.label || <span className="text-slate-300 font-light">—</span>}
                  </td>
                )}

                {/* Champs */}
                {visibleColumns.includes("variableCount") && (
                  <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">{countVariables(contract)}</td>
                )}

                {/* Clauses */}
                {visibleColumns.includes("blockCount") && (
                  <td className="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">
                    {contract.model?.blocks?.length ?? 0}
                  </td>
                )}

                {/* Créé le */}
                {visibleColumns.includes("createdAt") && (
                  <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">{formatCreatedAt(contract.createdAt)}</td>
                )}

                {/* Action */}
                {visibleColumns.includes("action") && (
                  <td className="px-4 py-3.5 text-right">
                    <div className="relative inline-flex items-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => toggleMenu(contract.id, e.currentTarget)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100"
                        title="Options"
                        aria-haspopup="menu"
                        aria-expanded={openMenu?.id === contract.id}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Menu d'actions de la ligne ouverte */}
      {openMenu && menuItem && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{ top: openMenu.top, right: openMenu.right }}
          className="fixed w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-50 text-left overflow-hidden"
        >
          <button
            role="menuitem"
            onClick={() => { setOpenMenu(null); onOpen(menuItem); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ink-secondary hover:bg-slate-100 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Ouvrir
          </button>
          <button
            role="menuitem"
            onClick={() => { setOpenMenu(null); onDelete(menuItem); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-danger-light transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Retirer de l'historique
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
            // La colonne Action est alignée à droite, comme son bouton « ⋮ ».
            <th key={col.id} className={`px-4 py-3 ${col.id === "action" ? "text-right" : ""}`}>
              {col.label}
            </th>
          );
        })}
      </tr>
    </thead>
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
