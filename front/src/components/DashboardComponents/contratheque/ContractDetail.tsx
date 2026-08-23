import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, Loader2, AlertCircle, FileText, Trash2, Download, Handshake, Pencil,
} from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { MetadataPanel } from "./MetadataPanel";
import { ContractEditor } from "./ContractEditor";
import { contractApi } from "./api";
import { negotiationApi } from "../negotiation/api";
import { fmtDate, daysUntil, RENEWAL_LABEL } from "./types";
import type { ContractDetail as Detail, ValidationStatus } from "./types";
import { ConfirmationModal } from "../../ui/ConfirmationModal";
import { VersionCompare } from "./VersionCompare";
import { AmendmentDTO } from "./types";
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
  const [editing, setEditing] = useState(false);
  const [contractDelete, setContractDelete] = useState(false);
  const [validateModalOpen, setValidateModalOpen] = useState(false);

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

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const d = await contractApi.get(contractId);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => { void load(); }, [load]);

  async function handleValidate(fieldKey: string, value: string | null, status: ValidationStatus) {
    await contractApi.validateField(contractId, fieldKey, value, status);
    await load();
  }

  async function handleAmendment( payload: Partial<AmendmentDTO>) {
    await contractApi.addAmendment(contractId, payload );
    await load();
  }

  async function handleDelete() {
    setContractDelete(true);
    setValidateModalOpen(true);
  }

  async function validateConfirmed() {
    if (!contractDelete) return;
    try {
      await contractApi.remove(contractId);
      onDeleted();
    } catch {}
    finally {
      setContractDelete(false);
      setValidateModalOpen(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }
  if (error || !data) {
    return (
      <div className="space-y-4">
        <BackBtn onBack={onBack} />
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4" /> {error || "Contrat introuvable."}
        </div>
      </div>
    );
  }

  const d = daysUntil(data.endDate);
  const urgent = d !== null && d >= 0 && d <= 90;

  return (
    <div className="space-y-4">
      <BackBtn onBack={onBack} />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-blue-primary py-6 px-8 rounded-2xl">
        {/* Titre & Badges */}
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
              {data.title.replace(/-/g, " ")}
            </h1>
            <StatusBadge status={data.status} />
            {data.isB2C && (
              <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 rounded-md">
                B2C · loi Chatel
              </span>
            )}
            {data.isArchived && (
              <span className="text-[10px] font-bold text-slate-300 bg-white/10 px-2 py-0.5 rounded-md">
                Archivé
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {data.hasDocument && (
            <a
              href={contractApi.documentUrl(contractId)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/15 rounded-xl transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Télécharger
            </a>
          )}

          <button
            onClick={() => void handleNegotiate()}
            disabled={openingNego}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-xl shadow-sm transition-all disabled:opacity-50"
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
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-500 bg-white hover:bg-white/80 border border-red-500 rounded-xl transition-all"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" /> Supprimer
            </button>
          )}
        </div>
      </div>

      {/* Aperçu texte (gauche) + informations clés (droite) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Colonne gauche : contenu du contrat — lecture ou édition */}
        <div
          className={`lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 ${editing ? "" : "overflow-y-auto"}`}
          style={editing ? undefined : { maxHeight: 620 }}
        >
          <div className="flex items-center justify-between gap-2 mb-3 bg-blue-primary -mx-5 -mt-5 px-6 py-4">
            <p className="text-[10px] font-bold text-white uppercase tracking-widest">Contenu du contrat</p>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold  bg-white border border-[#354F99]/20 rounded-lg hover:bg-[#354F99]/10 border border-white hover:text-white"
              >
                <Pencil className="w-3.5 h-3.5" /> Modifier le contrat
              </button>
            )}
          </div>

          {editing ? (
            <ContractEditor
              contractId={contractId}
              initialText={data.ocrText ?? ""}
              onSaved={() => { setEditing(false); void load(); }}
              onCancel={() => setEditing(false)}
            />
          ) : data.ocrText ? (
            <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
              {data.ocrText}
            </pre>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
              <FileText className="w-8 h-8 text-gray-200" />
              <p className="text-sm text-gray-400">Aucun texte disponible. Cliquez sur « Modifier le contrat » pour le saisir.</p>
            </div>
          )}
        </div>

        {/* Colonne droite : infos clés + métadonnées (validées en avant, manquantes en bas) */}
        <div className="space-y-4">
          <SummaryCard data={data} urgent={urgent} days={d} />
          <VersionCompare
            data={data}
            canEdit={!editing}
            onChanged={load}
          />
          <Amendments
            contractId={contractId}
            amendments={data.amendments ?? []}
            onAddAmendment={handleAmendment}
          />
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Métadonnées extraites</p>
            <MetadataPanel fields={data.metadataFields} onValidate={handleValidate} />
          </div>
        </div>
      </div>
      <ConfirmationModal
        open={validateModalOpen}
        title="Supprimer le contrat"
        description={`Souhaitez-vous supprimer le contrat : ${data?.title} ?`}
        confirmLabel="Valider"
        onConfirm={validateConfirmed}
        onCancel={() => { setValidateModalOpen(false); setContractDelete(false); }}
      />
    </div>
  );
}

function BackBtn({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#354F99] font-medium transition-colors">
      <ChevronLeft className="w-3.5 h-3.5" /> Retour à la contrathèque
    </button>
  );
}

function SummaryCard({ data, urgent, days }: { data: Detail; urgent: boolean; days: number | null }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2 text-sm h-fit">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Informations clés</p>
      <Row label="Cocontractant" value={data.counterpartyName} />
      <Row label="Responsable" value={data.responsibleName} />
      <Row label="Signature" value={fmtDate(data.signatureDate)} />
      <Row label="Échéance" value={
        <span className="inline-flex items-center gap-1.5">
          {fmtDate(data.endDate)}
          {urgent && <span className="text-[10px] font-bold text-amber-600">J-{days}</span>}
        </span>
      } />
      <Row label="Renouvellement" value={`${RENEWAL_LABEL[data.renewalType]}${data.noticePeriodDays ? ` · préavis ${data.noticePeriodDays}j` : ""}`} />
      <Row label="Montant" value={data.amount ? `${data.amount} ${data.currency ?? ""}` : "—"} />
      <Row label="Droit applicable" value={data.governingLaw} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-gray-400">{label}</span>
      <span className="text-xs font-medium text-gray-700 text-right truncate">{value || "—"}</span>
    </div>
  );
}
