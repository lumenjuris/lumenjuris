import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, Loader2, AlertCircle, FileText, Archive, Trash2, Download,
  GitBranch, History, ScrollText, Handshake,
} from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { MetadataPanel } from "./MetadataPanel";
import { NegotiationPanel } from "./NegotiationPanel";
import { contractApi } from "./api";
import { negotiationApi } from "../negotiation/api";
import { fmtDate, daysUntil, RENEWAL_LABEL } from "./types";
import type { ContractDetail as Detail, ValidationStatus } from "./types";

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

  async function handleArchive() {
    if (!data) return;
    await contractApi.archive(contractId, !data.isArchived);
    await load();
  }

  async function handleDelete() {
    if (!confirm("Supprimer définitivement ce contrat ?")) return;
    await contractApi.remove(contractId);
    onDeleted();
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
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <BackBtn onBack={onBack} />
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight truncate">{data.title}</h1>
            <StatusBadge status={data.status} />
            <ApprovalBadge status={data.approvalStatus} />
            {data.isB2C && <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">B2C · loi Chatel</span>}
            {data.isArchived && <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Archivé</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {data.hasDocument && (
            <a href={contractApi.documentUrl(contractId)} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              <Download className="w-3.5 h-3.5" /> Télécharger
            </a>
          )}
          <button onClick={() => void handleNegotiate()} disabled={openingNego} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#354F99] rounded-lg hover:bg-[#1a2d5a] transition-colors disabled:opacity-50">
            {openingNego ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Handshake className="w-3.5 h-3.5" />} Négocier
          </button>
          <button onClick={handleArchive} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <Archive className="w-3.5 h-3.5" /> {data.isArchived ? "Désarchiver" : "Archiver"}
          </button>
          {canDelete && (
            <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-500 bg-white border border-gray-200 rounded-lg hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" /> Supprimer
            </button>
          )}
        </div>
      </div>

      {/* Aperçu texte (gauche) + métadonnées (droite) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Colonne gauche : texte du contrat scrollable */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 overflow-y-auto" style={{ maxHeight: 620 }}>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Contenu du contrat</p>
          {data.ocrText ? (
            <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
              {data.ocrText}
            </pre>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
              <FileText className="w-8 h-8 text-gray-200" />
              <p className="text-sm text-gray-400">Aucun texte disponible pour ce contrat.</p>
            </div>
          )}
        </div>

        {/* Colonne droite : résumé + métadonnées IA */}
        <div className="space-y-4">
          <SummaryCard data={data} urgent={urgent} days={d} />
          <MetadataPanel fields={data.metadataFields} onValidate={handleValidate} />
        </div>
      </div>

      {/* Avenants + versions + audit */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Timeline icon={GitBranch} title="Avenants" count={data.amendments.length}>
          {data.amendments.length === 0 && <Empty>Aucun avenant</Empty>}
          {data.amendments.map((a) => (
            <li key={a.id} className="text-xs">
              <p className="font-semibold text-gray-700">{a.title}</p>
              {a.summary && <p className="text-gray-400 mt-0.5">{a.summary}</p>}
              <p className="text-gray-300 mt-0.5">{fmtDate(a.signatureDate)}</p>
            </li>
          ))}
        </Timeline>

        <Timeline icon={History} title="Versions" count={data.versions.length}>
          {data.versions.length === 0 && <Empty>Aucune version</Empty>}
          {data.versions.map((v) => (
            <li key={v.versionNumber} className="text-xs">
              <p className="font-semibold text-gray-700">Version {v.versionNumber}</p>
              {v.note && <p className="text-gray-400 mt-0.5">{v.note}</p>}
              <p className="text-gray-300 mt-0.5">{fmtDate(v.createdAt)}</p>
            </li>
          ))}
        </Timeline>

        <Timeline icon={ScrollText} title="Journal d'audit" count={data.auditLogs.length}>
          {data.auditLogs.length === 0 && <Empty>Aucune action</Empty>}
          {data.auditLogs.slice(0, 12).map((l, i) => (
            <li key={i} className="text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-600">{AUDIT_LABEL[l.action] ?? l.action}</span>
                <span className="text-gray-300 whitespace-nowrap">{fmtDate(l.createdAt)}</span>
              </div>
              {l.userName && <p className="text-gray-400 mt-0.5">par {l.userName}</p>}
            </li>
          ))}
        </Timeline>
      </div>

      {/* Négociation : approbation + commentaires collaboratifs */}
      <NegotiationPanel data={data} canEdit={canDelete} onChanged={() => void load()} />
    </div>
  );
}

function ApprovalBadge({ status }: { status: Detail["approvalStatus"] }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: "Brouillon", cls: "text-gray-500 bg-gray-100" },
    PENDING: { label: "En attente d'approbation", cls: "text-amber-700 bg-amber-50" },
    APPROVED: { label: "Approuvé", cls: "text-emerald-700 bg-emerald-50" },
    REJECTED: { label: "Rejeté", cls: "text-red-700 bg-red-50" },
  };
  const c = cfg[status] ?? cfg["DRAFT"]!;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.cls}`}>{c.label}</span>;
}

const AUDIT_LABEL: Record<string, string> = {
  IMPORT: "Import", AI_EXTRACTION: "Extraction IA", FIELD_VALIDATION: "Validation champ",
  METADATA_UPDATE: "Modif. métadonnées", AMENDMENT_ADDED: "Avenant ajouté", VERSION_ADDED: "Version ajoutée",
  DOCUMENT_ACCESS: "Accès document", EXPORT: "Export", ARCHIVE: "Archivage", DELETE: "Suppression",
};

function BackBtn({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#354F99] font-medium transition-colors">
      <ChevronLeft className="w-3.5 h-3.5" /> Retour à la contrathèque
    </button>
  );
}

function SummaryCard({ data, urgent, days }: { data: Detail; urgent: boolean; days: number | null }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2 text-sm">
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

function Timeline({ icon: Icon, title, count, children }: { icon: React.ElementType; title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-gray-400" />
        <p className="text-xs font-bold text-gray-600">{title}</p>
        <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">{count}</span>
      </div>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <li className="text-xs text-gray-300 italic">{children}</li>;
}
