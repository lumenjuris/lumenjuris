import { ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, FileText, Trash2 } from "lucide-react";
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
  if (loading) {
    return (
      <div className="bg-white rounded-card border border-line shadow-card overflow-hidden">
        <TableHeader sortBy={sortBy} sortDir={sortDir} onSort={onSort} canDelete={canDelete} />
        <div className="divide-y divide-line-subtle">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} canDelete={canDelete} />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-card border border-line shadow-card">
        <div className="w-14 h-14 rounded-card bg-surface-subtle border border-line flex items-center justify-center">
          <FileText className="w-6 h-6 text-ink-subtle stroke-[1.5]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-ink">Aucun contrat trouvé</p>
          <p className="text-xs text-ink-muted mt-1">Importez votre premier contrat pour commencer.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-card border border-line shadow-card overflow-hidden">
      <table className="w-full text-left border-collapse">
        <TableHeader sortBy={sortBy} sortDir={sortDir} onSort={onSort} canDelete={canDelete} />
        <tbody className="divide-y divide-line-subtle">
          {items.map((c) => {
            const d = daysUntil(c.endDate);
            const urgent = d !== null && d >= 0 && d <= 90;
            return (
              <tr
                key={c.id}
                onClick={() => onOpen(c.id)}
                className="hover:bg-surface-subtle/60 transition-colors cursor-pointer group"
              >
                {/* Intitulé */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 bg-brand-light rounded-lg text-brand shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-medium text-ink truncate max-w-[200px] group-hover:text-brand transition-colors">
                      {c.title}
                    </span>
                    {c.isB2C && (
                      <span
                        className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-chip shrink-0"
                        title="Contrat avec un consommateur (loi Chatel)"
                      >
                        B2C
                      </span>
                    )}
                  </div>
                </td>

                {/* Type */}
                <td className="px-4 py-3 text-xs text-ink-muted">{c.contractType ?? "—"}</td>

                {/* Cocontractant */}
                <td className="px-4 py-3 text-xs text-ink-secondary">{c.counterpartyName ?? "—"}</td>

                {/* Signature */}
                <td className="px-4 py-3 text-xs text-ink-muted whitespace-nowrap">{fmtDate(c.signatureDate)}</td>

                {/* Échéance */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-ink-muted">{fmtDate(c.endDate)}</span>
                    {urgent && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[9px] font-bold text-warning-dark"
                        title={`Échéance dans ${d} jours`}
                      >
                        <AlertTriangle className="w-3 h-3" /> J‑{d}
                      </span>
                    )}
                  </div>
                </td>

                {/* Statut */}
                <td className="px-4 py-3">
                  <StatusBadge status={c.status} />
                </td>

                {/* Responsable */}
                <td className="px-4 py-3 text-xs text-ink-muted">{c.responsibleName ?? "—"}</td>

                {/* Tags */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 flex-wrap max-w-[140px]">
                    {c.tags.slice(0, 3).map((t) => (
                      <span
                        key={t.id}
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded-chip"
                        style={{ backgroundColor: t.color + "22", color: t.color }}
                      >
                        {t.label}
                      </span>
                    ))}
                    {c.renewalType === "TACIT" && (
                      <span className="text-[9px] text-info" title="Tacite reconduction">
                        ↻ {RENEWAL_LABEL[c.renewalType]}
                      </span>
                    )}
                  </div>
                </td>

                {/* Suppression */}
                {canDelete && (
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete?.(c.id, c.title); }}
                      className="p-1.5 rounded-lg text-ink-subtle hover:text-danger hover:bg-danger-light transition-all opacity-0 group-hover:opacity-100"
                      title="Supprimer ce contrat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** En-tête de tableau partagé (liste + skeleton). */
function TableHeader({
  sortBy, sortDir, onSort, canDelete,
}: {
  sortBy?: SortKey;
  sortDir?: "asc" | "desc";
  onSort: (k: SortKey) => void;
  canDelete?: boolean;
}) {
  return (
    <thead className="bg-surface-subtle border-b border-line text-ink-subtle text-[10px] uppercase tracking-widest font-semibold">
      <tr>
        <Th label="Intitulé"      k="title"         sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
        <th className="px-4 py-3">Type</th>
        <th className="px-4 py-3">Cocontractant</th>
        <Th label="Signature"     k="signatureDate" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
        <Th label="Échéance"      k="endDate"       sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
        <Th label="Statut"        k="status"        sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
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
      <td className="px-4 py-3"><div className="h-3 w-16 rounded bg-surface-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-24 rounded bg-surface-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-16 rounded bg-surface-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-16 rounded bg-surface-muted" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 rounded-chip bg-surface-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-20 rounded bg-surface-muted" /></td>
      <td className="px-4 py-3"><div className="h-3 w-12 rounded bg-surface-muted" /></td>
      {canDelete && <td className="px-4 py-3" />}
    </tr>
  );
}

/** Cellule d'en-tête triable. */
function Th({
  label, k, sortBy, sortDir, onSort,
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
          active ? "text-brand" : "hover:text-ink-secondary"
        }`}
      >
        {label}
        {active ? (
          sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    </th>
  );
}
