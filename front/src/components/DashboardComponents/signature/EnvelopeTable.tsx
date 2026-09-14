import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  FileText,
  Loader2,
  MailPlus,
  MoreVertical,
  Trash2,
} from "lucide-react";

/** Statuts d'enveloppe (miroir de l'enum Prisma). */
export type EnvelopeStatus = "DRAFT" | "SENT" | "PARTIALLY_SIGNED" | "SIGNED" | "DECLINED" | "EXPIRED";

export interface EnvelopeDTO {
  id: string;
  documentName: string;
  numPages: number;
  status: EnvelopeStatus;
  selfName: string;
  selfEmail: string;
  counterpartyName: string;
  counterpartyEmail: string;
  sentAt: string | null;
  selfSignedAt: string | null;
  counterpartySignedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** État d'une relance déclenchée depuis le tableau. */
export type ResendState = "idle" | "sending" | "done" | "error";

type SortKey = "documentName" | "counterpartyName" | "status" | "sentAt" | "completedAt" | "createdAt";
type SortDirection = "asc" | "desc";

interface Props {
  items: EnvelopeDTO[];
  loading: boolean;
  onDelete: (id: string) => void;
  onResend: (envelope: EnvelopeDTO) => void;
  resendStates: Record<string, ResendState>;
}

interface ColumnConfig {
  id: string;
  label: string;
  sortKey?: SortKey;
}

const STORAGE_KEY = "signature_table_visible_columns";
const DEFAULT_COLUMNS = ["documentName", "counterpartyName", "status", "sentAt", "waiting", "action"];

const COLUMN_LIST: ColumnConfig[] = [
  { id: "documentName", label: "Document", sortKey: "documentName" },
  { id: "counterpartyName", label: "Cocontractant", sortKey: "counterpartyName" },
  { id: "counterpartyEmail", label: "E-mail" },
  { id: "status", label: "Statut", sortKey: "status" },
  { id: "sentAt", label: "Envoyé le", sortKey: "sentAt" },
  { id: "waiting", label: "Attente" },
  { id: "selfSignedAt", label: "Ma signature" },
  { id: "counterpartySignedAt", label: "Signature cocontractant" },
  { id: "completedAt", label: "Finalisé le", sortKey: "completedAt" },
  { id: "numPages", label: "Pages" },
  { id: "createdAt", label: "Créé le", sortKey: "createdAt" },
  { id: "action", label: "Action" },
];

/** Ordre logique des statuts pour le tri (du brouillon à la fin du cycle). */
const STATUS_ORDER: EnvelopeStatus[] = ["DRAFT", "SENT", "PARTIALLY_SIGNED", "SIGNED", "DECLINED", "EXPIRED"];

const STATUS_CONFIG: Record<EnvelopeStatus, { label: string; bg: string; fg: string }> = {
  DRAFT:             { label: "Brouillon",      bg: "#f1f5f9", fg: "#64748b" },
  SENT:              { label: "Envoyé",         bg: "#fef3c7", fg: "#92400e" },
  PARTIALLY_SIGNED:  { label: "Partiellement",  bg: "#dbeafe", fg: "#1e40af" },
  SIGNED:            { label: "Signé",          bg: "#d1fae5", fg: "#065f46" },
  DECLINED:          { label: "Refusé",         bg: "#fee2e2", fg: "#991b1b" },
  EXPIRED:           { label: "Expiré",         bg: "#f3f4f6", fg: "#6b7280" },
};

/** Vrai quand l'enveloppe attend encore la signature du cocontractant. */
function isPending(status: EnvelopeStatus): boolean {
  return status === "SENT" || status === "PARTIALLY_SIGNED" || status === "EXPIRED";
}

/** Nombre de jours entiers écoulés depuis une date ISO (null si absente). */
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const elapsedMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(elapsedMs) || elapsedMs < 0) return null;
  return Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
}

/** "JJ/MM/AAAA" à partir d'une date ISO (null si absente). */
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Date ISO → nombre pour le tri (les dates absentes sont placées en dernier). */
function dateToSortValue(iso: string | null, sortDirection: SortDirection): number {
  if (!iso) return sortDirection === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  return new Date(iso).getTime();
}

/** Trie les enveloppes sans modifier le tableau d'origine. */
function sortEnvelopes(items: EnvelopeDTO[], sortBy: SortKey, sortDirection: SortDirection): EnvelopeDTO[] {
  return [...items].sort((a, b) => {
    let comparison: number;
    if (sortBy === "documentName" || sortBy === "counterpartyName") {
      comparison = a[sortBy].localeCompare(b[sortBy], "fr", { sensitivity: "base" });
    } else if (sortBy === "status") {
      comparison = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    } else if (sortBy === "createdAt") {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else {
      comparison = dateToSortValue(a[sortBy], sortDirection) - dateToSortValue(b[sortBy], sortDirection);
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });
}

/** Tableau des enveloppes de signature (même design que le tableau de la contrathèque). */
export function EnvelopeTable({ items, loading, onDelete, onResend, resendStates }: Props) {
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

  const sortedItems = useMemo(() => sortEnvelopes(items, sortBy, sortDirection), [items, sortBy, sortDirection]);

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
      // Textes et statut : ordre croissant d'abord ; dates : les plus récentes d'abord.
      setSortDirection(key === "documentName" || key === "counterpartyName" || key === "status" ? "asc" : "desc");
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

  const menuEnvelope = openMenu ? items.find((envelope) => envelope.id === openMenu.id) : undefined;

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

  const emptyCell = <span className="text-slate-300 font-light">—</span>;

  if (loading) {
    return (
      <div>
        {columnSelector}
        <div className="bg-white rounded-b-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
          <table className="w-full min-w-[720px] text-left border-collapse">
            <TableHeader sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} visibleColumns={visibleColumns} />
            <tbody className="divide-y divide-line-subtle">
              {Array.from({ length: 6 }).map((_, i) => (
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
      <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-card border border-line shadow-card">
        <div className="w-14 h-14 rounded-card bg-surface-subtle border border-line flex items-center justify-center">
          <FileText className="w-6 h-6 text-ink-subtle stroke-[1.5]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-ink">Aucune enveloppe</p>
          <p className="text-xs text-ink-muted mt-1">
            Créez votre premier contrat à signer depuis le bouton « Envoyer pour signature ».
          </p>
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
            {sortedItems.map((envelope) => {
              const waitingDays = isPending(envelope.status) ? daysSince(envelope.sentAt ?? envelope.createdAt) : null;
              return (
                <tr key={envelope.id} className="hover:bg-slate-100 transition-colors duration-700 group">
                  {/* Document */}
                  {visibleColumns.includes("documentName") && (
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-blue-50/80 rounded-xl text-blue-700 shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span
                          title={envelope.documentName}
                          className="font-medium text-slate-900 truncate max-w-[220px] group-hover:text-blue-500 transition-colors"
                        >
                          {envelope.documentName}
                        </span>
                      </div>
                    </td>
                  )}

                  {/* Cocontractant */}
                  {visibleColumns.includes("counterpartyName") && (
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {envelope.counterpartyName || emptyCell}
                    </td>
                  )}

                  {/* E-mail du cocontractant */}
                  {visibleColumns.includes("counterpartyEmail") && (
                    <td className="px-4 py-3.5 text-xs text-slate-500">
                      {envelope.counterpartyEmail ? (
                        <span title={envelope.counterpartyEmail} className="block truncate max-w-[200px]">
                          {envelope.counterpartyEmail}
                        </span>
                      ) : emptyCell}
                    </td>
                  )}

                  {/* Statut */}
                  {visibleColumns.includes("status") && (
                    <td className="px-4 py-3.5">
                      <StatusBadge status={envelope.status} />
                    </td>
                  )}

                  {/* Envoyé le */}
                  {visibleColumns.includes("sentAt") && (
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(envelope.sentAt) ?? emptyCell}
                    </td>
                  )}

                  {/* Attente : une attente qui s'allonge est le signal qui justifie une relance */}
                  {visibleColumns.includes("waiting") && (
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {waitingDays === null ? emptyCell : (
                        <span
                          title={`En attente de signature depuis ${waitingDays} jour${waitingDays > 1 ? "s" : ""}`}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                            waitingDays >= 7
                              ? "text-amber-700 bg-amber-50 border-amber-200/80"
                              : "text-slate-600 bg-slate-50 border-slate-200/80"
                          }`}
                        >
                          {waitingDays} j
                        </span>
                      )}
                    </td>
                  )}

                  {/* Ma signature */}
                  {visibleColumns.includes("selfSignedAt") && (
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(envelope.selfSignedAt) ?? emptyCell}
                    </td>
                  )}

                  {/* Signature du cocontractant */}
                  {visibleColumns.includes("counterpartySignedAt") && (
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(envelope.counterpartySignedAt) ?? emptyCell}
                    </td>
                  )}

                  {/* Finalisé le */}
                  {visibleColumns.includes("completedAt") && (
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(envelope.completedAt) ?? emptyCell}
                    </td>
                  )}

                  {/* Pages */}
                  {visibleColumns.includes("numPages") && (
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">{envelope.numPages}</td>
                  )}

                  {/* Créé le */}
                  {visibleColumns.includes("createdAt") && (
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(envelope.createdAt) ?? emptyCell}
                    </td>
                  )}

                  {/* Action : menu (Relancer, Supprimer) + indicateur discret de la relance en cours / envoyée */}
                  {visibleColumns.includes("action") && (
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <ResendIndicator state={resendStates[envelope.id] ?? "idle"} />
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleMenu(envelope.id, e.currentTarget); }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100"
                          title="Options"
                          aria-haspopup="menu"
                          aria-expanded={openMenu?.id === envelope.id}
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
      {openMenu && menuEnvelope && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{ top: openMenu.top, right: openMenu.right }}
          className="fixed w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 text-left overflow-hidden"
        >
          {/* Relance : uniquement pour les enveloppes qui attendent encore la signature du cocontractant */}
          {isPending(menuEnvelope.status) && (
            <ResendMenuItem
              state={resendStates[menuEnvelope.id] ?? "idle"}
              onClick={() => { setOpenMenu(null); onResend(menuEnvelope); }}
            />
          )}
          <button
            role="menuitem"
            onClick={() => { setOpenMenu(null); onDelete(menuEnvelope.id); }}
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

// ─── Sous-composants ──────────────────────────────────────────────────────────

/** Badge coloré selon le statut de l'enveloppe. */
function StatusBadge({ status }: { status: EnvelopeStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-chip text-[10px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.fg }}
    >
      {cfg.label}
    </span>
  );
}

/**
 * Entrée « Relancer » du menu d'actions : renvoie l'e-mail d'invitation à signer
 * au cocontractant. Désactivée pendant l'envoi et une fois la relance partie.
 */
function ResendMenuItem({ state, onClick }: { state: ResendState; onClick: () => void }) {
  const isDisabled = state === "sending" || state === "done";
  let label = "Relancer";
  if (state === "sending") label = "Relance en cours…";
  if (state === "done") label = "Relance envoyée";

  return (
    <button
      role="menuitem"
      onClick={onClick}
      disabled={isDisabled}
      title="Renvoyer l'e-mail d'invitation à signer"
      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-ink-secondary hover:bg-slate-200 disabled:opacity-60 disabled:hover:bg-transparent disabled:cursor-default transition-colors"
    >
      {state === "sending" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {state === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-success-dark" />}
      {(state === "idle" || state === "error") && <MailPlus className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}

/** Petit indicateur à côté du menu : relance en cours (chargement) ou envoyée (coche). */
function ResendIndicator({ state }: { state: ResendState }) {
  if (state === "sending") {
    return <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-subtle" aria-label="Relance en cours" />;
  }
  if (state === "done") {
    return (
      <span title="Relance envoyée" className="inline-flex">
        <CheckCircle2 className="w-3.5 h-3.5 text-success-dark" aria-label="Relance envoyée" />
      </span>
    );
  }
  return null;
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
            <th key={col.id} className={`px-4 py-3 ${col.id === "action" ? "text-right" : ""}`}>
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
        className={`inline-flex items-center gap-1 transition-colors uppercase tracking-widest text-[10px] font-semibold whitespace-nowrap ${
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
