import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, FileText } from "lucide-react";

import { ColumnPicker } from "./ColumnPicker";
import { useVisibleColumns } from "./useVisibleColumns";

/**
 * Une colonne du tableau.
 *
 * `T` est le type d'une ligne, `K` l'ensemble des clés de tri acceptées par la
 * page (le tableau ne trie pas lui-même : il prévient via `onSort`).
 */
export interface DataTableColumn<T, K extends string = string> {
  id: string;
  label: string;
  /** Renseignée si la colonne est triable : l'en-tête devient un bouton. */
  sortKey?: K;
  /** En-tête et cellules alignés à droite (colonne d'actions, montants…). */
  alignRight?: boolean;
  /** Colonne toujours affichée : non décochable dans le sélecteur. */
  locked?: boolean;
  /** Contenu de la cellule pour une ligne donnée. */
  cell: (item: T) => ReactNode;
  /** Classes ajoutées à la cellule (taille de texte, troncature…). */
  cellClassName?: string;
}

interface Props<T, K extends string> {
  items: T[];
  /** Identifiant unique d'une ligne (clé React). */
  rowKey: (item: T) => string;
  columns: DataTableColumn<T, K>[];
  /** Colonnes affichées tant que l'utilisateur n'a rien choisi. */
  defaultColumns: string[];
  /** Clé de stockage de la préférence de colonnes, propre à chaque tableau. */
  storageKey: string;
  loading?: boolean;
  /** Nombre de lignes grises affichées pendant le chargement. */
  skeletonRows?: number;
  sortBy?: K;
  sortDir?: "asc" | "desc";
  onSort?: (key: K) => void;
  onRowClick?: (item: T) => void;
  /** Classes ajoutées à une ligne (surlignage d'un import récent, par ex.). */
  rowClassName?: (item: T) => string;
  /** Message affiché quand il n'y a aucune ligne. */
  empty: { title: string; description?: string; icon?: ReactNode; action?: ReactNode };
  /** Résumé affiché à côté du sélecteur de colonnes (« 12 contrats »). */
  summary?: ReactNode;
}

/**
 * Tableau de données commun à l'application : barre d'outils avec sélecteur de
 * colonnes, en-tête triable, lignes cliquables, chargement et état vide.
 *
 * Chaque page décrit seulement ses colonnes (`cell`) et son tri ; toute la mise
 * en forme vit ici, pour que les tableaux restent identiques d'un module à
 * l'autre.
 */
export function DataTable<T, K extends string = string>({
  items,
  rowKey,
  columns,
  defaultColumns,
  storageKey,
  loading = false,
  skeletonRows = 5,
  sortBy,
  sortDir,
  onSort,
  onRowClick,
  rowClassName,
  empty,
  summary,
}: Props<T, K>) {
  const [visibleColumns, setVisibleColumns] = useVisibleColumns(
    storageKey,
    defaultColumns,
    columns.map((column) => column.id),
  );

  // Une colonne verrouillée reste affichée même si la préférence ne la cite pas.
  const shownColumns = columns.filter(
    (column) => column.locked || visibleColumns.includes(column.id),
  );

  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-card border border-line bg-white py-16 shadow-card">
        <div className="flex h-14 w-14 items-center justify-center rounded-card border border-line bg-surface-subtle">
          {empty.icon ?? <FileText className="h-6 w-6 stroke-[1.5] text-ink-subtle" />}
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-ink">{empty.title}</p>
          {empty.description && (
            <p className="mt-1 max-w-md text-xs text-ink-muted">{empty.description}</p>
          )}
        </div>
        {empty.action}
      </div>
    );
  }

  return (
    <div>
      {/* Sélecteur de colonnes d'abord, puis le résumé juste à sa droite. */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <ColumnPicker
          columns={columns}
          visibleColumns={shownColumns.map((column) => column.id)}
          onChange={setVisibleColumns}
          defaultColumns={defaultColumns}
        />
        {summary && <span className="min-w-0 text-xs text-ink-muted">{summary}</span>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead className="border-b border-line bg-blue-primary text-[10px] font-semibold uppercase tracking-widest text-white">
              <tr>
                {shownColumns.map((column) => (
                  <th
                    key={column.id}
                    className={`px-4 py-3 ${column.alignRight ? "text-right" : ""}`}
                  >
                    {column.sortKey && onSort ? (
                      <SortButton
                        label={column.label}
                        sortKey={column.sortKey}
                        active={sortBy === column.sortKey}
                        sortDir={sortDir}
                        onSort={onSort}
                      />
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-line-subtle text-sm">
              {loading
                ? Array.from({ length: skeletonRows }).map((_, row) => (
                    <tr key={row} className="animate-pulse">
                      {shownColumns.map((column) => (
                        <td key={column.id} className="px-4 py-3">
                          <div className="h-4 rounded bg-surface-muted" />
                        </td>
                      ))}
                    </tr>
                  ))
                : items.map((item) => (
                    <tr
                      key={rowKey(item)}
                      onClick={onRowClick ? () => onRowClick(item) : undefined}
                      className={`group transition-colors duration-300 hover:bg-surface-subtle ${
                        onRowClick ? "cursor-pointer" : ""
                      } ${rowClassName?.(item) ?? ""}`}
                    >
                      {shownColumns.map((column) => (
                        <td
                          key={column.id}
                          className={`px-4 py-3.5 ${column.alignRight ? "text-right" : ""} ${
                            column.cellClassName ?? ""
                          }`}
                        >
                          {column.cell(item)}
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** En-tête d'une colonne triable : flèche pleine quand le tri est actif. */
function SortButton<K extends string>({
  label,
  sortKey,
  active,
  sortDir,
  onSort,
}: {
  label: string;
  sortKey: K;
  active: boolean;
  sortDir?: "asc" | "desc";
  onSort: (key: K) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
        active ? "text-white" : "hover:text-gray-primary"
      }`}
    >
      {label}
      {active ? (
        sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}

/** Cellule vide, identique dans tous les tableaux. */
export function EmptyCell() {
  return <span className="font-light text-ink-placeholder">—</span>;
}
