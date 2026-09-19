import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, Loader2, AlertCircle, Trash2, Download, Handshake,
} from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { ContractFieldsPanel } from "./ContractFieldsPanel";
import { InlineContractEditor } from "./InlineContractEditor";
import { contractApi } from "./api";
import { negotiationApi } from "../negotiation/api";
import { daysUntil, STATUS_LABEL } from "./types";
import type { AmendmentDTO, ContractDetail as Detail, ContractStatus } from "./types";
import { ConfirmationModal } from "../../ui/ConfirmationModal";
import { PageBanner } from "../../common/PageBanner";
import { Amendments } from "./Amendments";

interface Props {
  contractId: string;
  canDelete: boolean;
  onBack: () => void;
  onDeleted: () => void;
}

/** Écran 2 — fiche détaillée d'un contrat. */
export function ContractDetail({ contractId, canDelete, onBack, onDeleted }: Props) {
  const navigate = useNavigate();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openingNego, setOpeningNego] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Point d'entrée du tunnel : ouvre (ou rejoint) la négociation isolée de ce contrat.
  async function handleNegotiate() {
    setOpeningNego(true);
    try {
      const r = await negotiationApi.enter(contractId, data?.title ? `Négociation — ${data.title}` : undefined);
      navigate(`/negociation/${r.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'ouvrir la négociation.");
      setOpeningNego(false);
    }
  }

  /**
   * Recharge la fiche. Après une modification, le rechargement est silencieux :
   * repasser toute la page en écran de chargement à chaque champ validé faisait
   * clignoter l'écran et perdre la position de lecture.
   */
  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    setError("");
    try {
      const detail = await contractApi.get(contractId);
      setData(detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [contractId]);

  useEffect(() => { void load(); }, [load]);

  const refreshInBackground = useCallback(() => { void load({ silent: true }); }, [load]);

  async function handleAmendment(payload: Partial<AmendmentDTO>) {
    await contractApi.addAmendment(contractId, payload);
    refreshInBackground();
  }

  async function confirmDelete() {
    setDeleteError("");
    try {
      await contractApi.remove(contractId);
      onDeleted();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "La suppression a échoué.");
    } finally {
      setDeleteModalOpen(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-ink-subtle" /></div>;
  }
  if (error || !data) {
    return (
      <div className="space-y-4">
        <BackBtn onBack={onBack} />
        <div role="alert" className="flex items-center gap-2 text-sm text-danger-dark bg-danger-light border border-danger/20 px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4" /> {error || "Contrat introuvable."}
        </div>
      </div>
    );
  }

  const remainingDays = daysUntil(data.endDate);
  const urgent = remainingDays !== null && remainingDays >= 0 && remainingDays <= 90;

  return (
    <div className="space-y-4">
      {/* En-tête : identité du contrat et actions */}
      <PageBanner
        backLink={{ label: "Contrathèque", onClick: onBack }}
        title={data.title}
        badges={
          <>
            <StatusBadge status={data.status} />
            {urgent && (
              <span className="text-[10px] font-bold text-amber-200 bg-amber-500/20 border border-amber-300/30 px-2 py-0.5 rounded-md">
                Échéance dans {remainingDays} j
              </span>
            )}
            {data.isB2C && (
              <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 rounded-md">
                B2C · loi Chatel
              </span>
            )}
            {data.isArchived && (
              <span className="text-[10px] font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded-md">Archivé</span>
            )}
          </>
        }
        actions={
          <>
            {data.hasDocument && (
              <a
                href={contractApi.documentUrl(contractId)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl transition-all duration-200 hover:-translate-y-0.5 will-change-transform"
              >
                <Download className="w-3.5 h-3.5" /> Télécharger
              </a>
            )}

            <button
              onClick={() => void handleNegotiate()}
              disabled={openingNego}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-900 bg-white rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 will-change-transform disabled:opacity-50"
            >
              {openingNego ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-700" />
              ) : (
                <Handshake className="w-3.5 h-3.5 text-blue-600" />
              )}
              Négocier
            </button>

            {canDelete && (
              <button
                onClick={() => setDeleteModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-danger bg-white border border-danger rounded-xl transition-all duration-200 hover:-translate-y-0.5 will-change-transform"
              >
                <Trash2 className="w-3.5 h-3.5" /> Supprimer
              </button>
            )}
          </>
        }
      />

      {deleteError && (
        <div role="alert" className="flex items-center gap-2 text-sm text-danger-dark bg-danger-light border border-danger/20 px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" /> {deleteError}
        </div>
      )}

      {/* Contenu du contrat (gauche) + informations et suivi (droite) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div
          className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col"
          style={{ maxHeight: 680 }}
        >
          <InlineContractEditor contractId={contractId} text={data.ocrText ?? ""} onSaved={refreshInBackground} />
        </div>

        {/* Colonne droite : ce qu'il reste à traiter d'abord, le reste ensuite */}
        <div className="space-y-4">
          <ContractFieldsPanel key={data.id} contract={data} onSaved={refreshInBackground} />
          <TrackingCard contract={data} onUpdated={refreshInBackground} />
          <Amendments
            contractId={contractId}
            amendments={data.amendments ?? []}
            onAddAmendment={handleAmendment}
          />
        </div>
      </div>

      <ConfirmationModal
        open={deleteModalOpen}
        title="Supprimer le contrat"
        description={`Le contrat « ${data.title} » sera définitivement supprimé, avec son document et son historique.`}
        confirmLabel="Supprimer"
        confirmClassName="bg-danger text-white hover:bg-danger-dark"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteModalOpen(false)}
      />
    </div>
  );
}

function BackBtn({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-brand font-medium transition-colors">
      <ChevronLeft className="w-3.5 h-3.5" /> Retour à la contrathèque
    </button>
  );
}

/**
 * Suivi interne du contrat : ce qui ne vient pas du document mais de
 * l'organisation (statut du cycle de vie, personne responsable).
 */
function TrackingCard({ contract, onUpdated }: { contract: Detail; onUpdated: () => void }) {
  const [status, setStatus] = useState<ContractStatus>(contract.status);
  const [responsible, setResponsible] = useState(contract.responsibleName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(patch: Record<string, unknown>) {
    setSaving(true);
    setError("");
    try {
      await contractApi.update(contract.id, patch);
      onUpdated();
    } catch {
      setError("Modification non enregistrée.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-card border border-line shadow-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Suivi</p>
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-subtle" />}
      </div>

      {error && (
        <p role="alert" className="text-xs text-danger-dark bg-danger-light border border-danger/20 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="suivi-statut" className="block text-xs text-ink-muted">Statut</label>
        <select
          id="suivi-statut"
          value={status}
          onChange={(event) => {
            const nouveauStatut = event.target.value as ContractStatus;
            setStatus(nouveauStatut);
            void save({ status: nouveauStatut });
          }}
          className="w-full bg-white border border-line px-2.5 py-1.5 rounded-lg text-sm text-ink-secondary outline-none focus:border-brand/40 cursor-pointer"
        >
          {(Object.keys(STATUS_LABEL) as ContractStatus[]).map((value) => (
            <option key={value} value={value}>{STATUS_LABEL[value]}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="suivi-responsable" className="block text-xs text-ink-muted">Responsable</label>
        <input
          id="suivi-responsable"
          value={responsible}
          onChange={(event) => setResponsible(event.target.value)}
          onBlur={() => {
            const valeur = responsible.trim();
            if (valeur === (contract.responsibleName ?? "")) return;
            void save({ responsibleName: valeur || null });
          }}
          placeholder="Personne en charge du contrat"
          className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-line text-ink outline-none focus:border-brand/40 placeholder:text-ink-placeholder"
        />
      </div>
    </div>
  );
}
