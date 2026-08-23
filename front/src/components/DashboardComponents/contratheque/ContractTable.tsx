import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  FileText,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { fmtDate, daysUntil, RENEWAL_LABEL } from "./types";
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



/** Tableau principal de la liste des contrats. */
export function ContractTable({ items, loading, sortBy, sortDir, onSort, onOpen, canDelete, onDelete }: Props) {
  console.log(items)
  {/* Rendu du composant en instance de traitement */}
  if (loading) {
    return (
      <div className="bg-white rounded-card border border-line shadow-card overflow-hidden">
        <TableHeader
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
          canDelete={canDelete}
        />
        <div className="divide-y divide-line-subtle">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} canDelete={canDelete} />
          ))}
        </div>
      </div>
    );
  }


  { /* Rendu du composant lorseque la liste d'items est vide */}
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
<div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full min-w-[720px] text-left border-collapse">
      <TableHeader
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={onSort}
        canDelete={canDelete}
      />
      <tbody className="divide-y divide-slate-100 text-sm">
        {items.map((c) => {
          const d = daysUntil(c.endDate);
          const urgent = d !== null && d >= 0 && d <= 90;
          return (
            <tr
              key={c.id}
              onClick={() => onOpen(c.id)}
              className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
            >
              {/* Intitulé */}
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-blue-50/80 rounded-xl text-blue-700 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-slate-900 truncate max-w-[220px] group-hover:text-blue-600 transition-colors">
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

              {/* Type */}
              <td className="px-4 py-3.5 text-xs text-slate-500 font-medium">
                {c.contractType ?? <span className="text-slate-300 font-light">—</span>}
              </td>

              {/* Cocontractant */}
              <td className="px-4 py-3.5 text-xs text-slate-600">
                {c.counterpartyName ?? <span className="text-slate-300 font-light">—</span>}
              </td>

              {/* Signature */}
              <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                {fmtDate(c.signatureDate) ?? <span className="text-slate-300 font-light">—</span>}
              </td>

              {/* Échéance */}
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

              {/* Statut */}
              <td className="px-4 py-3.5">
                <StatusBadge status={c.status} />
              </td>

              {/* Responsable */}
              <td className="px-4 py-3.5 text-xs text-slate-600">
                {c.responsibleName ?? <span className="text-slate-300 font-light">—</span>}
              </td>

              {/* Tags & Reconduction */}
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

              {/* Suppression */}
              {canDelete && (
                <td className="px-4 py-3.5 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(c.id, c.title);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                    title="Supprimer ce contrat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
</div>
  );
}




/** En-tête de tableau partagé (liste + skeleton). */
function TableHeader({
  sortBy,
  sortDir,
  onSort,
  canDelete,
}: {
  sortBy?: SortKey;
  sortDir?: "asc" | "desc";
  onSort: (k: SortKey) => void;
  canDelete?: boolean;
}) {
  return (
    <thead className="bg-blue-primary border-b border-line text-white text-[10px] uppercase tracking-widest font-semibold">
      <tr>
        <Th
          label="Intitulé"
          k="title"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
        />
        <th className="px-4 py-3">Type</th>
        <th className="px-4 py-3">Cocontractant</th>
        <Th
          label="Signature"
          k="signatureDate"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
        />
        <Th
          label="Échéance"
          k="endDate"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
        />
        <Th
          label="Statut"
          k="status"
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={onSort}
        />
        <th className="px-4 py-3">Responsable</th>
        <th className="px-4 py-3">Tags</th>
        {canDelete && <th className="px-4 py-3 w-10" />}
      </tr>
    </thead>
  );
}

/** Ligne de chargement (skeleton). */
function SkeletonRow({ canDelete }: { canDelete?: boolean }) {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-surface-muted" />
          <div className="h-3.5 w-36 rounded bg-surface-muted" />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-16 rounded bg-surface-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-24 rounded bg-surface-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-16 rounded bg-surface-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-16 rounded bg-surface-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-20 rounded-chip bg-surface-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-20 rounded bg-surface-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-3 w-12 rounded bg-surface-muted" />
      </td>
      {canDelete && <td className="px-4 py-3" />}
    </tr>
  );
}

/** Cellule d'en-tête triable. */
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
