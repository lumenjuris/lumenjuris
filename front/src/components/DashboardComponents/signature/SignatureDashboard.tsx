import { useEffect, useState, useCallback } from "react";
import { Plus, FileText, Send, Clock, CheckCircle2, Loader2, Trash2, AlertCircle, Filter, MailPlus } from "lucide-react";
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
  // Relance : enveloppe en attente de confirmation + état par enveloppe.
  // Une relance envoie un e-mail : elle passe toujours par une confirmation.
  const [pendingResend, setPendingResend] = useState<EnvelopeDTO | null>(null);
  const [resendStates, setResendStates] = useState<Record<string, ResendState>>({});

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

  /** Ouvre la confirmation de relance pour une enveloppe. */
  function handleResend(envelope: EnvelopeDTO) {
    setPendingResend(envelope);
  }

  /** Renvoie l'e-mail d'invitation à signer, après confirmation. */
  async function resendConfirmed() {
    const envelope = pendingResend;
    setPendingResend(null);
    if (!envelope) return;
    setResendStates((prev) => ({ ...prev, [envelope.id]: "sending" }));
    try {
      const res = await fetchProxy("/api/signature-envelope/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ externalId: envelope.id }),
      });
      const data = await res.json() as { success?: boolean; message?: string };
      if (!res.ok || !data.success) throw new Error(data.message ?? "Échec de la relance.");
      setResendStates((prev) => ({ ...prev, [envelope.id]: "done" }));
    } catch (e: unknown) {
      setResendStates((prev) => ({ ...prev, [envelope.id]: "error" }));
      setError(e instanceof Error ? e.message : "Échec de la relance.");
    }
  }

  return (
    <div className="space-y-5 mx-auto w-full max-w-7xl">
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
      <EnvelopeList
        list={list}
        loading={loading}
        onDelete={handleDelete}
        onResend={handleResend}
        resendStates={resendStates}
      />
        <ConfirmationModal
          open={validateModalOpen}
          title="Supprimer l'enveloppe"
          description={`Souhaitez-vous supprimer l'enveloppe ?`}
          confirmLabel="Valider"
          onConfirm={validateConfirmed}
          onCancel={() => { setValidateModalOpen(false); setPendingDeleteId(null); }}
        />
        <ConfirmationModal
          open={!!pendingResend}
          title="Relancer la signature"
          description={pendingResend
            ? `Un nouvel e-mail d'invitation à signer va être envoyé à ${pendingResend.counterpartyName} (${pendingResend.counterpartyEmail}). Le lien de signature reste le même.`
            : ""}
          confirmLabel="Envoyer la relance"
          onConfirm={() => void resendConfirmed()}
          onCancel={() => setPendingResend(null)}
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
        className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-white text-blue-primary text-sm font-semibold rounded-xl transition-all durantion-200 hover:-translate-y-0.5 will-change-transform shadow-card"
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
  list, loading, onDelete, onResend, resendStates,
}: {
  list: EnvelopeDTO[];
  loading: boolean;
  onDelete: (id: string) => void;
  onResend: (envelope: EnvelopeDTO) => void;
  resendStates: Record<string, ResendState>;
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
        <EnvelopeRow
          key={env.id}
          env={env}
          onDelete={() => onDelete(env.id)}
          onResend={() => onResend(env)}
          resendState={resendStates[env.id] ?? "idle"}
        />
      ))}
    </div>
  );
}

/** Une ligne d'enveloppe dans la liste. */
function EnvelopeRow({
  env, onDelete, onResend, resendState,
}: {
  env: EnvelopeDTO;
  onDelete: () => void;
  onResend: () => void;
  resendState: ResendState;
}) {
  const waitingDays = daysSince(env.sentAt ?? env.createdAt);
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
        {/* Une attente qui s'allonge est le signal qui justifie une relance. */}
        {isPending(env.status) && waitingDays !== null && (
          <span className={`block ${waitingDays >= 7 ? "text-warning-dark font-semibold" : ""}`}>
            en attente depuis {waitingDays} j
          </span>
        )}
      </div>
      <StatusBadge status={env.status} />
      {isPending(env.status) && (
        <ResendButton state={resendState} onClick={onResend} />
      )}
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

/** État d'une relance déclenchée depuis la liste. */
type ResendState = "idle" | "sending" | "done" | "error";

/**
 * Bouton de relance manuelle : renvoie l'e-mail d'invitation à signer au
 * cocontractant. Affiché uniquement sur les enveloppes encore en attente, et
 * toujours visible (contrairement à la corbeille qui n'apparaît qu'au survol) :
 * c'est l'action attendue quand une signature tarde.
 */
function ResendButton({ state, onClick }: { state: ResendState; onClick: () => void }) {
  if (state === "done") {
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-success-dark shrink-0 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5" /> Relance envoyée
      </span>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={state === "sending"}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-brand border border-line hover:bg-surface-subtle disabled:opacity-50 transition-colors shrink-0 whitespace-nowrap"
      title="Renvoyer l'e-mail d'invitation à signer"
    >
      {state === "sending"
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <MailPlus className="w-3.5 h-3.5" />}
      Relancer
    </button>
  );
}

/** Vrai quand l'enveloppe attend encore la signature du cocontractant. */
function isPending(status: EnvelopeStatus): boolean {
  return status === "SENT" || status === "PARTIALLY_SIGNED" || status === "EXPIRED";
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

/** Nombre de jours entiers écoulés depuis une date ISO (null si absente). */
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const elapsedMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(elapsedMs) || elapsedMs < 0) return null;
  return Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
}

/** "JJ/MM/AAAA" à partir d'un ISO ou d'un timestamp. */
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
