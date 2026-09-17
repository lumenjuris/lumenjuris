import { useEffect, useState, useCallback } from "react";
import { Plus, FileText, Send, Clock, CheckCircle2, AlertCircle, Filter } from "lucide-react";
import { fetchProxy } from "../../../utils/fetchProxy";
import { ConfirmationModal } from "../../ui/ConfirmationModal";
import { EnvelopeTable } from "./EnvelopeTable";
import type { EnvelopeDTO, EnvelopeStatus, ResendState } from "./EnvelopeTable";

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
 *   - tableau des enveloppes (colonnes au choix, tri)
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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

      {/* Tableau des enveloppes */}
      <EnvelopeTable
        items={list}
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
    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 bg-blue-primary px-5 py-6 sm:px-8 sm:py-8 rounded-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Signature électronique</h1>
        <p className="text-sm text-gray-primary mt-1">
          Suivez l'avancement de vos contrats à signer.
        </p>
      </div>
      <button
        onClick={onNewContract}
        className="shrink-0 flex w-full lg:w-auto items-center justify-center gap-2 px-5 py-2.5 bg-white text-blue-primary text-sm font-semibold rounded-xl transition-all durantion-200 hover:-translate-y-0.5 will-change-transform shadow-card"
      >
        <Plus className="w-4 h-4" /> Envoyer pour signature
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
    <div className="bg-white rounded-card border border-line shadow-card p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
      <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-panel flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "18" }}>
        <Icon className="w-5 h-5 stroke-[1.5]" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        {loading ? (
          <div className="h-7 w-8 rounded-md bg-surface-muted animate-pulse mb-1" />
        ) : (
          <p className="text-xl sm:text-2xl font-bold tracking-tight text-ink">{value}</p>
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
