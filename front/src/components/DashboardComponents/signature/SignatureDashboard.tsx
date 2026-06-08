import { useEffect, useState, useCallback } from "react";
import { Plus, FileText, Send, Clock, CheckCircle2, Loader2, Trash2, AlertCircle, Filter } from "lucide-react";
import { fetchProxy } from "../../../utils/fetchProxy";

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
    if (!confirm("Supprimer définitivement cette enveloppe ?")) return;
    try {
      await fetchProxy(`/api/signature-envelope/${externalId}`, {
        method: "DELETE",
        credentials: "include",
      });
      await fetchAll();
    } catch { /* silent */ }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <Header onNewContract={onNewContract} />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Total"
          value={stats?.total ?? 0}
          icon={FileText}
          color="#354F99"
          loading={loading}
        />
        <KpiCard
          label="En attente"
          value={(stats?.sent ?? 0) + (stats?.partiallySigned ?? 0)}
          icon={Clock}
          color="#f59e0b"
          loading={loading}
        />
        <KpiCard
          label="Signés"
          value={stats?.signed ?? 0}
          icon={CheckCircle2}
          color="#10b981"
          loading={loading}
        />
        <KpiCard
          label="Brouillons"
          value={stats?.draft ?? 0}
          icon={Send}
          color="#94a3b8"
          loading={loading}
        />
      </div>

      {/* Filtres */}
      <StatusFilters current={filter} onChange={setFilter} />

      {/* Liste */}
      <EnvelopeList list={list} loading={loading} onDelete={handleDelete} />
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

/** Titre de la page + bouton "Nouveau contrat". */
function Header({ onNewContract }: { onNewContract: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Signature électronique</h1>
        <p className="text-sm text-gray-500 mt-1">
          Suivez l'avancement de vos contrats à signer.
        </p>
      </div>
      <button
        onClick={onNewContract}
        className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-[#354F99] text-white text-sm font-semibold rounded-xl hover:bg-[#1a2d5a] transition-all shadow-sm"
      >
        <Plus className="w-4 h-4" /> Nouveau contrat
      </button>
    </div>
  );
}

/** Une carte KPI (valeur + label + petite icône colorée). */
function KpiCard({
  label, value, icon: Icon, color, loading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center justify-between">
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">
          {loading ? <span className="text-gray-300">—</span> : value}
        </p>
      </div>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + "1A" }}>
        <Icon className="w-5 h-5" style={{ color }} />
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
      <Filter className="w-3.5 h-3.5 text-gray-400" />
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            current === o.id
              ? "bg-gray-900 text-white shadow-sm"
              : "text-gray-500 bg-white border border-gray-200 hover:bg-gray-50"
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
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }
  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center bg-white rounded-2xl border border-gray-200">
        <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
          <FileText className="w-6 h-6 text-gray-300 stroke-[1.5]" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-700">Aucune enveloppe</p>
          <p className="text-xs text-gray-400 max-w-sm">
            Créez votre premier contrat à signer depuis le bouton "Nouveau contrat".
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100 overflow-hidden">
      {list.map((env) => (
        <EnvelopeRow key={env.id} env={env} onDelete={() => onDelete(env.id)} />
      ))}
    </div>
  );
}

/** Une ligne d'enveloppe dans la liste. */
function EnvelopeRow({ env, onDelete }: { env: EnvelopeDTO; onDelete: () => void }) {
  return (
    <div className="group flex items-center gap-4 px-5 py-3 hover:bg-gray-50/60 transition-colors">
      <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{env.documentName}</p>
        <p className="text-[11px] text-gray-400 truncate">
          {env.counterpartyName} · {env.counterpartyEmail}
        </p>
      </div>
      <div className="hidden md:block text-[11px] text-gray-400 shrink-0 min-w-[120px] text-right">
        {formatDate(env.sentAt ?? env.createdAt)}
      </div>
      <StatusBadge status={env.status} />
      <button
        onClick={onDelete}
        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
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
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
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
