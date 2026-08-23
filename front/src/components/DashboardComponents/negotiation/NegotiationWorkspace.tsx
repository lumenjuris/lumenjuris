import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronDown, Loader2, AlertCircle, Ban, PenTool, FilePlus2, CheckCircle2, Users, GitCompare,
} from "lucide-react";
import { useUserStore } from "../../../store/userStore";
import { negotiationApi } from "./api";
import { NegotiationDoc } from "./NegotiationDoc";
import type { AddAnnotationPayload } from "./NegotiationDoc";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { ShareDialog } from "./ShareDialog";
import { VersionDiff } from "./VersionDiff";
import { CompletionOwnerPanel } from "./CompletionOwnerPanel";
import { buildPdfFromText } from "./buildPdfFromText";
import { STATUS_LABEL, STATUS_STYLE, MODE_LABEL, MODE_STYLE } from "./types";
import type { NegotiationDetail } from "./types";
import { AlertBanner } from "../../common/AlertBanner";
import { ConfirmationModal } from "../../ui/ConfirmationModal";

/** Espace de négociation — vue document collaborative (surlignements + annotations). */
export function NegotiationWorkspace() {
  const { negotiationId } = useParams<{ negotiationId: string }>();
  const navigate = useNavigate();
  const role = useUserStore((s) => s.userData?.profile?.role);
  const canEdit = role === "ADMIN" || role === "JURISTE" || role === "USER";

  const [data, setData] = useState<NegotiationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [versionId, setVersionId] = useState<string>("");
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versionSuccess, setVersionSuccess] = useState(false);
  const [versionError, setVersionError] = useState(false);
  const [abortModalOpen, setAbortModalOpen] = useState(false);
  const [validateModalOpen, setValidateModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!negotiationId) return;
    setLoading(true); setError("");
    try {
      const d = await negotiationApi.get(negotiationId);
      setData(d);
      // Sélectionne la version finale si elle existe, sinon la plus récente.
      if (!versionId && d.versions.length) {
        const last = d.versions[d.versions.length - 1]!;
        setVersionId(last.id);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur réseau"); }
    finally { setLoading(false); }
  }, [negotiationId, versionId]);

  useEffect(() => { void load(); }, [negotiationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedVersion = data?.versions.find((v) => v.id === versionId) ?? data?.versions[data.versions.length - 1] ?? null;

  async function addAnnotation(p: AddAnnotationPayload) {
    if (!data) return;
    await negotiationApi.addComment(data.id, {
      body: p.body, anchorStart: p.anchorStart, anchorEnd: p.anchorEnd, quote: p.quote,
      proposedText: p.proposedText, visibility: p.visibility, clauseRef: null,
    });
    await load();
  }
  async function resolveAnnotation(commentId: string, resolved: boolean) {
    if (!data) return;
    await negotiationApi.resolveComment(data.id, commentId, resolved);
    await load();
  }
  async function abort() {
    if (!data ) return;
    setAbortModalOpen(true);
  }

  async function abortConfirmed() {
    setAbortModalOpen(false);
    await negotiationApi.abort(data!.id);
    await load();
  }

  async function exitToSignature() {
    if (!data) return;
    try {
      await negotiationApi.exit(data.id);
      // Enchaîne concrètement : PDF de la version finale → assistant signature.
      const final = data.versions.find((v) => v.isFinal) ?? data.versions[data.versions.length - 1];
      if (final) {
        const pdf = buildPdfFromText(data.title, final.contentText);
        navigate("/signature", {
          state: { incomingPdf: pdf.output("datauristring"), incomingName: `${data.title}.pdf` },
        });
        return;
      }
      setVersionSuccess(true);
    }
    catch (e) { setVersionError(true); }
  }
  async function validateDisplayed() {
    if (!data || !selectedVersion) return;
    setValidateModalOpen(true);
  }

  async function validateConfirmed() {
    setValidateModalOpen(false);
    await negotiationApi.validateVersion(data!.id, selectedVersion!.id);
    await load();
  }

  if (loading && !data) return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-ink-subtle" /></div>;
  if (error || !data) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-xs text-ink-subtle hover:text-brand font-medium"><ChevronLeft className="w-3.5 h-3.5" /> Retour</button>
        <div className="flex items-center gap-2 text-sm text-danger-dark bg-danger-light border border-danger/20 px-4 py-3 rounded-xl"><AlertCircle className="w-4 h-4" /> {error || "Négociation introuvable."}</div>
      </div>
    );
  }

  const st = STATUS_STYLE[data.status];

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        {versionSuccess && (
            <AlertBanner
              title="Erreur de l'envoi de l'e-mail !"
              variant="success"
              detail="Version finale transmise à la signature."
              duration={8000}
              onClose={() => setVersionSuccess(false)}
            />
          )}

          {versionError && (
            <AlertBanner
              title="Erreur de l'envoi de l'e-mail !"
              variant="success"
              detail="Aucune version validée à transmettre."
              duration={8000}
              onClose={() => setVersionError(false)}
            />
          )}

        <div className="w-full">
          <button onClick={() => navigate(`/contratheque/${data.contractExternalId}`)} className="inline-flex items-center gap-1 text-xs text-ink-subtle hover:text-brand font-medium"><ChevronLeft className="w-3.5 h-3.5" /> Retour au contrat</button>
          <div className="bg-blue-primary rounded-2xl px-8 py-6 shadow-sm w-full max-w-8xl">
          {/* Titre et statut */}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-normal text-white tracking-tight">
              Négociation - {data.title}
            </h1>
            <span
              className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: st.bg, color: st.fg }}
            >
              {data.status === "VALIDATED" ? "Prêt à signer" : STATUS_LABEL[data.status]}
            </span>
          </div>

          {/* Barre d'actions sous forme de boutons harmonisés */}
          <div className="flex items-center gap-2.5 mt-5 flex-wrap">
            {canEdit && data.status !== "CLOSED" && (
              <>
                {/* Action Principale : Transmettre à la signature */}
                <button
                  onClick={() => void exitToSignature()}
                  disabled={!data.finalVersionId}
                  className="px-4 py-2 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-xl shadow-sm transition-all disabled:opacity-50"
                  title={data.finalVersionId ? "Transmettre à la signature" : "Validez d'abord une version"}
                >
                  Vers la signature
                </button>

                {canEdit && selectedVersion && !selectedVersion.isFinal && (
                  <button
                    onClick={() => void validateDisplayed()}
                    className="px-3.5 py-2 text-xs font-medium text-blue-primary bg-white hover:bg-white/90 border border-white/10 rounded-xl backdrop-blur-sm transition-all"
                  >
                    Valider la signature
                  </button>
                )}
                
                {canEdit && (
                  <button
                    onClick={() => setNewVersionOpen((v) => !v)}
                    className="px-3.5 py-2 text-xs font-medium text-slate-200 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl backdrop-blur-sm transition-all"
                  >
                    {data.versions.length === 0 ? "Ajouter le texte" : "Nouveau round"}
                  </button>
                )}

                <button
                  onClick={() => void abort()}
                  className="px-3.5 py-2 text-xs font-semibold text-red-500 bg-white hover:text-red-700 border border-red-500 rounded-xl transition-all"
                >
                  Abandonner
                </button>
              </>
            )}

            {/* Sélecteur de version si plus d'une version */}
            {data.versions.length > 1 && (
              <select
                value={selectedVersion?.id ?? ""}
                onChange={(e) => setVersionId(e.target.value)}
                className="px-3 py-2.5 bg-white text-ink text-xs font-medium rounded-xl outline-none cursor-pointer shadow-sm"
              >
                {data.versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber}{v.label ? ` · ${v.label}` : ""}{v.isFinal ? " (finale)" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        </div>
        
      </div>

      
      {newVersionOpen && canEdit && <NewVersionForm negotiationId={data.id} nextNumber={data.versions.length + 1} onDone={() => { setNewVersionOpen(false); void load(); }} />}

      {/* Complétion guidée : suivi des champs, relances et passage en signature */}
      {data.mode === "COMPLETION" && (
        <CompletionOwnerPanel data={data} canEdit={canEdit} onChanged={() => void load()} />
      )}

      {/* Vue document collaborative */}
      <NegotiationDoc
        text={selectedVersion?.contentText ?? ""}
        comments={data.comments}
        canAnnotate={canEdit && data.status !== "CLOSED"}
        onAdd={addAnnotation}
        onResolve={resolveAnnotation}
      />

      {/* Section secondaire : participants & partage (repliable) */}
      <Collapsible icon={Users} title="Participants & partage du lien" open={showParticipants} onToggle={() => setShowParticipants((v) => !v)} badge={data.participants.length}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ParticipantsPanel data={data} canEdit={canEdit} onChanged={load} />
          <ShareDialog data={data} canEdit={canEdit} onChanged={load} />
        </div>
      </Collapsible>

      {/* Section secondaire : versions & comparaison (repliable) */}
      <Collapsible icon={GitCompare} title="Versions & comparaison" open={showVersions} onToggle={() => setShowVersions((v) => !v)} badge={data.versions.length}>
        <VersionDiff data={data} canEdit={canEdit} onChanged={load} />
      </Collapsible>

      <ConfirmationModal
        open={abortModalOpen}
        title="Abandonner la négociation"
        description="Elle passera en statut « Clos ». Cette action est irréversible."
        confirmLabel="Abandonner"
        confirmClassName="bg-red-600 text-white hover:bg-red-700"
        onConfirm={abortConfirmed}
        onCancel={() => setAbortModalOpen(false)}
      />

      <ConfirmationModal
        open={validateModalOpen}
        title="Valider comme version finale"
        description={`Valider la version ${selectedVersion?.versionNumber} comme version finale (prête pour signature) ?`}
        confirmLabel="Valider"
        onConfirm={validateConfirmed}
        onCancel={() => setValidateModalOpen(false)}
      />
    </div>
  );
}

function Collapsible({ icon: Icon, title, open, onToggle, badge, children }: { icon: React.ElementType; title: string; open: boolean; onToggle: () => void; badge?: number; children: React.ReactNode }) {
  return (
    <div>
      <button onClick={onToggle} className="flex items-center gap-2 w-full text-left px-1 py-2 group">
        <Icon className="w-4 h-4 text-ink-muted" />
        <span className="text-sm font-semibold text-ink-secondary group-hover:text-ink">{title}</span>
        {badge != null && <span className="text-[10px] font-semibold text-ink-subtle bg-surface-muted px-1.5 py-0.5 rounded-chip">{badge}</span>}
        <ChevronDown className={`w-4 h-4 text-ink-subtle ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

function NewVersionForm({ negotiationId, nextNumber, onDone }: { negotiationId: string; nextNumber: number; onDone: () => void }) {
  const [text, setText] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  async function create() {
    if (!text.trim()) return;
    setBusy(true);
    try { await negotiationApi.createVersion(negotiationId, text, label.trim() || undefined); onDone(); }
    finally { setBusy(false); }
  }
  return (
    <div className="bg-white rounded-card border border-brand/30 shadow-card p-4 space-y-2">
      <p className="text-[10px] font-bold text-brand uppercase tracking-widest">Nouvelle version (round de négociation)</p>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Libellé (ex. « Retour contrepartie »)" className="w-full text-sm px-3 py-1.5 border border-line rounded-lg outline-none focus:border-brand/40 placeholder:text-ink-placeholder" />
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Collez le texte du contrat pour cette version…" className="w-full text-sm px-3 py-2 border border-line rounded-lg outline-none focus:border-brand/40 resize-y placeholder:text-ink-placeholder font-mono leading-relaxed" />
      <button onClick={() => void create()} disabled={busy || !text.trim()} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-hover transition-all disabled:opacity-50">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FilePlus2 className="w-3.5 h-3.5" />} Enregistrer la version {nextNumber}
      </button>
    </div>
  );
}
