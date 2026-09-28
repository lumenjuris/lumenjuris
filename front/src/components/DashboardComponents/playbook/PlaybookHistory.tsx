import { useMemo, useState } from "react";
import { BarChart3, ChevronDown, ExternalLink, FileCheck, FileText, Search, ShieldAlert, Trash2 } from "lucide-react";
import { DataTable, type DataTableColumn } from "../../common/DataTable";
import { RowActionsMenu, type RowAction } from "../../common/RowActionsMenu";
import type { PlaybookAnalysisSummary } from "./types";

type SortKey = "fileName" | "rules" | "ecarts" | "updatedAt";
type Filtre = "Tous" | "Écarts" | "À vérifier" | "Conformes";

const STORAGE_KEY = "playbook_history_table_visible_columns";
const DEFAULT_COLUMNS = ["fileName", "rules", "ecarts", "updatedAt", "action"];

const total = (a: PlaybookAnalysisSummary) => a.compliant + a.nonCompliant + a.toCheck;

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

/** Pastille de résultat : même gabarit que la « Priorité » de l'analyse des risques. */
function Resultat({ a }: { a: PlaybookAnalysisSummary }) {
  if (a.nonCompliant > 0) {
    return (
      <span className="inline-flex items-center rounded-chip border px-2.5 py-1 text-[11px] font-semibold tracking-wide text-danger-dark border-danger/20 bg-danger-light">
        {a.nonCompliant} écart{a.nonCompliant > 1 ? "s" : ""}
      </span>
    );
  }
  if (a.toCheck > 0) {
    return (
      <span className="inline-flex items-center rounded-chip border px-2.5 py-1 text-[11px] font-semibold tracking-wide text-warning-dark border-warning/20 bg-warning-light">
        {a.toCheck} à vérifier
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-chip border px-2.5 py-1 text-[11px] font-semibold tracking-wide text-success-dark border-success/20 bg-success-light">
      Conforme
    </span>
  );
}

/**
 * Historique des analyses playbook : même mise en forme que la page
 * « Analyse de conformité » (chiffres clés, recherche, filtre, tableau).
 */
export function PlaybookHistory({
  analyses, onOpen, onDelete,
}: {
  analyses: PlaybookAnalysisSummary[] | null;
  onOpen: (a: PlaybookAnalysisSummary) => void;
  onDelete: (a: PlaybookAnalysisSummary) => void;
}) {
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("Tous");
  const [sortBy, setSortBy] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const liste = analyses ?? [];

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return liste.filter((a) => {
      if (q && !a.fileName.toLowerCase().includes(q)) return false;
      if (filtre === "Écarts") return a.nonCompliant > 0;
      if (filtre === "À vérifier") return a.nonCompliant === 0 && a.toCheck > 0;
      if (filtre === "Conformes") return a.nonCompliant === 0 && a.toCheck === 0;
      return true;
    });
  }, [liste, recherche, filtre]);

  const triees = useMemo(() => {
    return [...filtrees].sort((a, b) => {
      let c: number;
      if (sortBy === "fileName") c = a.fileName.localeCompare(b.fileName, "fr", { sensitivity: "base" });
      else if (sortBy === "rules") c = total(a) - total(b);
      else if (sortBy === "ecarts") c = a.nonCompliant * 100 + a.toCheck - (b.nonCompliant * 100 + b.toCheck);
      else c = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sortDir === "asc" ? c : -c;
    });
  }, [filtrees, sortBy, sortDir]);

  function trier(key: SortKey) {
    if (key === sortBy) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(key); setSortDir(key === "fileName" ? "asc" : "desc"); }
  }

  const avecEcarts = liste.filter((a) => a.nonCompliant > 0).length;
  const regles = liste.reduce((n, a) => n + total(a), 0);
  const conformite = regles ? Math.round((liste.reduce((n, a) => n + a.compliant, 0) / regles) * 100) : null;

  const actions = (a: PlaybookAnalysisSummary): RowAction[] => [
    { label: "Ouvrir", icon: <ExternalLink className="h-3.5 w-3.5" />, onSelect: () => onOpen(a) },
    { label: "Supprimer", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, onSelect: () => onDelete(a) },
  ];

  const columns: DataTableColumn<PlaybookAnalysisSummary, SortKey>[] = [
    {
      id: "fileName",
      label: "Document",
      sortKey: "fileName",
      cell: (a) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-panel border border-line bg-surface-subtle text-blue-primary transition-colors group-hover:bg-blue-primary group-hover:text-white">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="max-w-xs truncate text-sm font-medium text-ink transition-colors group-hover:text-blue-primary">{a.fileName}</p>
            <p className="mt-0.5 text-xs text-ink-subtle">Analysé{a.playbookName ? ` · ${a.playbookName}` : ""}</p>
          </div>
        </div>
      ),
    },
    { id: "rules", label: "Règles", sortKey: "rules", cellClassName: "text-sm text-ink-muted", cell: (a) => total(a) },
    { id: "ecarts", label: "Résultat", sortKey: "ecarts", cell: (a) => <Resultat a={a} /> },
    { id: "updatedAt", label: "Date", sortKey: "updatedAt", cellClassName: "whitespace-nowrap text-xs text-ink-subtle", cell: (a) => formatDate(a.updatedAt) },
    { id: "action", label: "Action", alignRight: true, cell: (a) => <RowActionsMenu actions={actions(a)} /> },
  ];

  const vide = liste.length === 0 ? "Aucun contrat analysé pour le moment." : "Aucun résultat pour cette recherche.";

  return (
    <div className="space-y-6">
      {/* Chiffres clés */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard label="Total documents" value={liste.length} icon={BarChart3} accent="#2C3A5E" />
        <KpiCard label="Avec écarts" value={avecEcarts} icon={ShieldAlert} accent="#dc2626" />
        <KpiCard label="Conformité moy." value={conformite === null ? "—" : `${conformite}%`} icon={FileCheck} accent="#059669" />
      </div>

      {/* Recherche + filtre */}
      <div className="flex flex-col md:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle stroke-[1.5]" />
          <input
            type="text"
            placeholder="Rechercher un document…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-line rounded-xl text-sm text-ink outline-none focus:border-brand/40 focus:shadow-ring-brand transition-all placeholder:text-ink-placeholder shadow-card"
          />
        </div>
        <div className="relative w-full md:w-48">
          <select
            value={filtre}
            onChange={(e) => setFiltre(e.target.value as Filtre)}
            className="appearance-none w-full bg-white border border-line px-4 py-2.5 pr-9 rounded-xl text-sm text-ink-secondary outline-none focus:border-brand/40 cursor-pointer transition-all shadow-card"
          >
            <option value="Tous">Filtrer par résultat</option>
            <option value="Écarts">Avec écarts</option>
            <option value="À vérifier">À vérifier</option>
            <option value="Conformes">Conformes</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle pointer-events-none stroke-[1.5]" />
        </div>
      </div>

      {/* Mobile : cartes */}
      <div className="md:hidden bg-white border border-line rounded-card shadow-card divide-y divide-line-subtle">
        {triees.length > 0 ? triees.map((a) => (
          <div key={a.id} className="p-4 flex items-center gap-3 hover:bg-surface-subtle/60 cursor-pointer" onClick={() => onOpen(a)}>
            <div className="w-9 h-9 rounded-panel bg-surface-subtle border border-line flex items-center justify-center text-ink-subtle shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink truncate">{a.fileName}</p>
              <p className="text-xs text-ink-subtle mt-0.5">{formatDate(a.updatedAt)}{a.playbookName ? ` · ${a.playbookName}` : ""}</p>
            </div>
            <Resultat a={a} />
            <div onClick={(e) => e.stopPropagation()}><RowActionsMenu actions={actions(a)} /></div>
          </div>
        )) : (
          <div className="px-6 py-12 text-center text-ink-subtle italic text-sm">{vide}</div>
        )}
      </div>

      {/* Desktop : tableau */}
      <div className="hidden md:block">
        <DataTable
          items={triees}
          rowKey={(a) => a.id}
          columns={columns}
          defaultColumns={DEFAULT_COLUMNS}
          storageKey={STORAGE_KEY}
          loading={analyses === null}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={trier}
          onRowClick={onOpen}
          empty={{
            title: liste.length === 0 ? "Aucun contrat analysé" : "Aucun résultat",
            description: liste.length === 0
              ? "Lancez une analyse pour retrouver ici vos contrats et leurs écarts avec vos règles."
              : "Modifiez la recherche ou le filtre.",
          }}
          summary={`${filtrees.length} document${filtrees.length > 1 ? "s" : ""}`}
        />
      </div>
    </div>
  );
}

/** Petite carte de chiffre clé — même gabarit que l'analyse de conformité. */
function KpiCard({ label, value, icon: Icon, accent }: { label: string; value: number | string; icon: React.ElementType; accent: string }) {
  return (
    <div className="bg-white rounded-card border border-line shadow-card p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-panel flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "18" }}>
        <Icon className="w-5 h-5 stroke-[1.5]" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tracking-tight text-ink">{value}</p>
        <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest leading-tight mt-0.5">{label}</p>
      </div>
    </div>
  );
}
