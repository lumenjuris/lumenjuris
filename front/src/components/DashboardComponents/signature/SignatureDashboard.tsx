import { useEffect, useState, useCallback } from "react";
import { Plus, FileText, Send, Clock, CheckCircle2, Loader2, Trash2, AlertCircle, Filter } from "lucide-react";
import { fetchProxy } from "../../../utils/fetchProxy";
import { ConfirmationModal } from "../../ui/ConfirmationModal";

/** Statuts d'enveloppe (miroir de l'enum Prisma). */
type EnvelopeStatus = "DRAFT" | "SENT" | "PARTIALLY_SIGNED" | "SIGNED" | "DECLINED" | "EXPIRED";

interface EnvelopeDTO {
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

interface Stats {
  total: number;
  draft: number;
  sent: number;
  partiallySigned: number;
  signed: number;
  other: number;
  recent: EnvelopeDTO[];
}

interface Props {
  /** Appelé quand l'utilisateur clique sur "Nouveau contrat". */
  onNewContract: () => void;
  /** Clé de refresh — incrémenter pour forcer un re-fetch des données. */
  refreshKey?: number;
}

/**
 * Vue tableau de bord du module Signature électronique :
 *   - 4 cartes KPI (total / signés / en cours / brouillons)
 *   - filtre par statut
 *   - liste des enveloppes
 *   - bouton "Nouveau contrat" en haut à droite
 *
 * Charge les données via 2 endpoints proxy :
 *   GET /api/signature-envelope/stats  → KPIs + 5 récents
 *   GET /api/signature-envelope?status=XXX → liste filtrée
 */
export function SignatureDashboard({ onNewContract, refreshKey }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [list, setList] = useState<EnvelopeDTO[]>([]);
  const [filter, setFilter] = useState<EnvelopeStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [validateModalOpen, setValidateModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statsRes, listRes] = await Promise.all([
        fetchProxy("/api/signature-envelope/stats", { credentials: "include" }),
        fetchProxy(`/api/signature-envelope${filter !== "ALL" ? `?status=${filter}` : ""}`, { credentials: "include" }),
      ]);
      const statsData = await statsRes.json() as { success: boolean; data?: Stats };
      const listData = await listRes.json() as { success: boolean; data?: EnvelopeDTO[] };
      if (statsData.success && statsData.data) setStats(statsData.data);
      if (listData.success && listData.data) setList(listData.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void fetchAll(); }, [fetchAll, refreshKey]);

  
  async function handleDelete(externalId: string) {
    setPendingDeleteId(externalId);
    setValidateModalOpen(true);
  }

  async function validateConfirmed() {
     if (!pendingDeleteId) return;
    try {
      await fetchProxy(`/api/signature-envelope/${pendingDeleteId}`, {
        method: "DELETE",
        credentials: "include",
      });
      await fetchAll();
    } catch { /* silent */ }
      finally {
      setValidateModalOpen(false);
      setPendingDeleteId(null);
    }
  } 

  return (
    <div className="space-y-5">
      <Header onNewContract={onNewContract} />

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger-dark bg-danger-light border border-danger/20 px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Total"
          value={stats?.total ?? 0}
          icon={FileText}
          accent="#354F99"
          loading={loading}
        />
        <KpiCard
          label="En attente"
          value={(stats?.sent ?? 0) + (stats?.partiallySigned ?? 0)}
          icon={Clock}
          accent="#d97706"
          loading={loading}
        />
        <KpiCard
          label="Signés"
          value={stats?.signed ?? 0}
          icon={CheckCircle2}
          accent="#059669"
          loading={loading}
        />
        <KpiCard
          label="Brouillons"
          value={stats?.draft ?? 0}
          icon={Send}
          accent="#64748b"
          loading={loading}
        />
      </div>

      {/* Filtres */}
      <StatusFilters current={filter} onChange={setFilter} />

      {/* Liste */}
      <EnvelopeList list={list} loading={loading} onDelete={handleDelete} />
        <ConfirmationModal
          open={validateModalOpen}
          title="Supprimer l'enveloppe"
          description={`Souhaitez-vous supprimer l'enveloppe ?`}
          confirmLabel="Valider"
          onConfirm={validateConfirmed}
          onCancel={() => { setValidateModalOpen(false); setPendingDeleteId(null); }}
        />
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

/** Titre de la page + bouton "Nouveau contrat". */
function Header({ onNewContract }: { onNewContract: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 bg-blue-primary px-4 py-8 rounded-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Signature électronique</h1>
        <p className="text-sm text-gray-primary mt-1">
          Suivez l'avancement de vos contrats à signer.
        </p>
      </div>
      <button
        onClick={onNewContract}
        className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-white text-blue-primary text-sm font-semibold rounded-xl hover:bg-gray-300 transition-all shadow-card"
      >
        <Plus className="w-4 h-4" /> Nouveau contrat
      </button>
    </div>
  );
}

/** Une carte KPI — même gabarit que la bibliothèque de clauses (icône à gauche). */
function KpiCard({
  label, value, icon: Icon, accent, loading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-card border border-line shadow-card p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-panel flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "18" }}>
        <Icon className="w-5 h-5 stroke-[1.5]" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        {loading ? (
          <div className="h-7 w-8 rounded-md bg-surface-muted animate-pulse mb-1" />
        ) : (
          <p className="text-2xl font-bold tracking-tight text-ink">{value}</p>
        )}
        <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest leading-tight mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/** Boutons de filtre par statut. */
function StatusFilters({
  current, onChange,
}: {
  current: EnvelopeStatus | "ALL";
  onChange: (s: EnvelopeStatus | "ALL") => void;
}) {
  const options: Array<{ id: EnvelopeStatus | "ALL"; label: string }> = [
    { id: "ALL", label: "Tous" },
    { id: "SENT", label: "Envoyés" },
    { id: "PARTIALLY_SIGNED", label: "Partiellement signés" },
    { id: "SIGNED", label: "Signés" },
    { id: "DRAFT", label: "Brouillons" },
  ];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Filter className="w-3.5 h-3.5 text-ink-subtle" />
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all shadow-card ${
            current === o.id
              ? "bg-brand text-white border-brand"
              : "text-ink-secondary bg-white border-line hover:bg-surface-subtle"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Liste des enveloppes. */
function EnvelopeList({
  list, loading, onDelete,
}: {
  list: EnvelopeDTO[];
  loading: boolean;
  onDelete: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-ink-subtle" />
      </div>
    );
  }
  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center bg-white rounded-card border border-line shadow-card">
        <div className="w-14 h-14 rounded-card bg-surface-subtle border border-line flex items-center justify-center">
          <FileText className="w-6 h-6 text-ink-subtle stroke-[1.5]" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-ink">Aucune enveloppe</p>
          <p className="text-xs text-ink-muted max-w-sm">
            Créez votre premier contrat à signer depuis le bouton « Nouveau contrat ».
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-card border border-line shadow-card divide-y divide-line-subtle overflow-hidden">
      {list.map((env) => (
        <EnvelopeRow key={env.id} env={env} onDelete={() => onDelete(env.id)} />
      ))}
    </div>
  );
}

/** Une ligne d'enveloppe dans la liste. */
function EnvelopeRow({ env, onDelete }: { env: EnvelopeDTO; onDelete: () => void }) {
  return (
    <div className="group flex items-center gap-4 px-5 py-3 hover:bg-surface-subtle/60 transition-colors">
      <div className="w-9 h-9 rounded-panel bg-surface-subtle border border-line flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-ink-subtle" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink truncate">{env.documentName}</p>
        <p className="text-[11px] text-ink-subtle truncate">
          {env.counterpartyName} · {env.counterpartyEmail}
        </p>
      </div>
      <div className="hidden md:block text-[11px] text-ink-subtle shrink-0 min-w-[120px] text-right">
        {formatDate(env.sentAt ?? env.createdAt)}
      </div>
      <StatusBadge status={env.status} />
      <button
        onClick={onDelete}
        className="p-1.5 rounded-lg text-ink-subtle hover:text-danger hover:bg-danger-light transition-all opacity-0 group-hover:opacity-100"
        title="Supprimer"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

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

const STATUS_CONFIG: Record<EnvelopeStatus, { label: string; bg: string; fg: string }> = {
  DRAFT:             { label: "Brouillon",      bg: "#f1f5f9", fg: "#64748b" },
  SENT:              { label: "Envoyé",         bg: "#fef3c7", fg: "#92400e" },
  PARTIALLY_SIGNED:  { label: "Partiellement",  bg: "#dbeafe", fg: "#1e40af" },
  SIGNED:            { label: "Signé",          bg: "#d1fae5", fg: "#065f46" },
  DECLINED:          { label: "Refusé",         bg: "#fee2e2", fg: "#991b1b" },
  EXPIRED:           { label: "Expiré",         bg: "#f3f4f6", fg: "#6b7280" },
};

/** "JJ/MM/AAAA" à partir d'un ISO ou d'un timestamp. */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
