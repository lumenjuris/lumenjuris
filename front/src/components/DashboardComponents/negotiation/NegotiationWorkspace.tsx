import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronDown, Loader2, AlertCircle,   Users, GitCompare,
} from "lucide-react";
import { useUserStore } from "../../../store/userStore";
import { negotiationApi } from "./api";
import { NegotiationDoc } from "./NegotiationDoc";
import type { AddAnnotationPayload } from "./NegotiationDoc";
import { ShareDialog } from "./ShareDialog";
import { VersionDiff } from "./VersionDiff";
import { CompletionOwnerPanel } from "./CompletionOwnerPanel";
import { buildPdfFromText } from "./buildPdfFromText";
import { STATUS_LABEL, STATUS_STYLE } from "./types";
import type { NegotiationDetail } from "./types";
import { AlertBanner } from "../../common/AlertBanner";
import { BANNER_ACTION_CLASS, PageBanner } from "../../common/PageBanner";
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
    <div className="space-y-4 max-w-7xl w-full mx-auto">
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
          

        <PageBanner
          className="w-full"
          backLink={{ label: "Fiche du contrat", onClick: () => navigate(`/contratheque/${data.contractExternalId}`) }}
          title={`Négociation - ${data.title}`}
          badges={
            <span
              className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
              style={{ backgroundColor: st.bg, color: st.fg }}
            >
              {data.status === "VALIDATED" ? "Prêt à signer" : STATUS_LABEL[data.status]}
            </span>
          }
          actions={
            <>
            {data.versions.length > 1 && (
              <select
                value={selectedVersion?.id ?? ""}
                onChange={(e) => setVersionId(e.target.value)}
                className="h-10 cursor-pointer rounded-xl bg-white px-3 text-sm font-semibold text-blue-primary shadow-card outline-none"
              >
                {data.versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    Version {v.versionNumber}{v.label ? ` · ${v.label}` : ""}{v.isFinal ? " (validée)" : ""}
                  </option>
                ))}
              </select>
            )}
            {canEdit && data.status !== "CLOSED" && (
              <>
                {selectedVersion && !selectedVersion.isFinal && (
                  <button
                    onClick={() => void validateDisplayed()}
                    className={BANNER_ACTION_CLASS}
                    title="Marquer la version affichée comme version définitive"
                  >
                    Valider cette version
                  </button>
                )}
                {/* En complétion guidée, le panneau ci-dessous porte déjà ce bouton. */}
                {data.mode !== "COMPLETION" && (
                <button
                  onClick={() => void exitToSignature()}
                  disabled={!data.finalVersionId}
                  className={BANNER_ACTION_CLASS}
                  title={data.finalVersionId ? "Envoyer la version validée en signature" : "Validez d'abord une version"}
                >
                  Envoyer en signature
                </button>
                )}
                <button
                  onClick={() => void abort()}
                  className={BANNER_ACTION_CLASS}
                >
                  Abandonner
                </button>
              </>
            )}
            </>
          }
        />
      </div>

      <div className="">
      {/* Section secondaire : participants & partage (repliable) */}
      <Collapsible icon={Users} title="Personnes invitées" open={showParticipants} onToggle={() => setShowParticipants((v) => !v)} badge={data.guestAccesses.length || data.participants.length}>
        <ShareDialog data={data} canEdit={canEdit} onChanged={load} />
      </Collapsible>

      {/* Section secondaire : versions & comparaison (repliable) */}
      <Collapsible icon={GitCompare} title="Versions & comparaison" open={showVersions} onToggle={() => setShowVersions((v) => !v)} badge={data.versions.length}>
        <VersionDiff data={data} canEdit={canEdit} onChanged={load} />
      </Collapsible>
      </div>

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
        onSaveText={canEdit && data.status !== "CLOSED" ? async (t) => {
          await negotiationApi.createVersion(data.id, t);
          const d = await negotiationApi.get(negotiationId!); setData(d);
          const last = d.versions[d.versions.length - 1]; if (last) setVersionId(last.id);
        } : undefined}
      />

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

