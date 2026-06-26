import { useMemo, useRef, useState } from "react";
import { MessageSquarePlus, Loader2, Check, CornerDownRight, Lock, Globe, X } from "lucide-react";
import { fmtDate } from "../contratheque/types";
import type { NegoComment } from "./types";

export interface AddAnnotationPayload {
  body: string;
  anchorStart: number | null;
  anchorEnd: number | null;
  quote: string | null;
  proposedText: string | null;
  parentCommentId?: number | null;
  visibility?: "INTERNAL" | "EXTERNAL";
}

interface Props {
  text: string;
  comments: NegoComment[];
  canAnnotate: boolean;
  /** mode invité : visibilité forcée EXTERNAL, pas de résolution. */
  guest?: boolean;
  onAdd: (p: AddAnnotationPayload) => Promise<void>;
  onResolve?: (commentId: string, resolved: boolean) => Promise<void>;
}

type Segment = { text: string; ann?: NegoComment };

/** Construit les segments de texte avec les passages surlignés (annotations ancrées). */
function buildSegments(text: string, anns: NegoComment[]): Segment[] {
  const valid = anns
    .filter((a) => a.anchorStart != null && a.anchorEnd != null && a.anchorStart < (a.anchorEnd as number) && (a.anchorEnd as number) <= text.length)
    .sort((a, b) => (a.anchorStart as number) - (b.anchorStart as number));
  const segs: Segment[] = [];
  let pos = 0;
  for (const a of valid) {
    const s = a.anchorStart as number, e = a.anchorEnd as number;
    if (s < pos) continue; // chevauchement → ignoré (V1)
    if (s > pos) segs.push({ text: text.slice(pos, s) });
    segs.push({ text: text.slice(s, e), ann: a });
    pos = e;
  }
  if (pos < text.length) segs.push({ text: text.slice(pos) });
  return segs;
}

/** Calcule les offsets caractères de la sélection courante dans le conteneur. */
function selectionOffsets(container: HTMLElement): { start: number; end: number; text: string } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(container);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  const txt = sel.toString();
  if (!txt.trim()) return null;
  return { start, end: start + txt.length, text: txt };
}

/** Vue document : contrat affiché, passages surlignés, sélection→annotation, fil par annotation. */
export function NegotiationDoc({ text, comments, canAnnotate, guest, onAdd, onResolve }: Props) {
  const docRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null); // id de l'annotation ouverte
  const [pending, setPending] = useState<{ start: number; end: number; text: string } | null>(null);

  // Annotations = commentaires racine avec ancrage. Commentaires généraux = sans ancrage et sans parent.
  const anchored = useMemo(() => comments.filter((c) => c.anchorStart != null && c.parentCommentId == null), [comments]);
  const general = useMemo(() => comments.filter((c) => c.anchorStart == null && c.parentCommentId == null), [comments]);
  const segments = useMemo(() => buildSegments(text, anchored), [text, anchored]);

  function onMouseUp() {
    if (!canAnnotate || !docRef.current) return;
    const off = selectionOffsets(docRef.current);
    if (off) { setPending(off); setSelected(null); }
  }

  const selectedAnn = anchored.find((a) => a.id === selected) || general.find((a) => a.id === selected) || null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Document */}
      <div className="lg:col-span-3 bg-white rounded-card border border-line shadow-card p-5">
        <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest mb-3">
          Document {canAnnotate && <span className="text-ink-placeholder normal-case font-normal">· sélectionnez un passage pour l'annoter</span>}
        </p>
        {text ? (
          <div
            ref={docRef}
            onMouseUp={onMouseUp}
            className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed font-sans selection:bg-brand/20"
          >
            {segments.map((seg, i) =>
              seg.ann ? (
                <mark
                  key={i}
                  onClick={() => { setSelected(seg.ann!.id); setPending(null); }}
                  className="rounded px-0.5 cursor-pointer transition-colors"
                  style={{
                    backgroundColor: seg.ann.resolved ? "#e5e7eb" : seg.ann.visibility === "EXTERNAL" ? "#dbeafe" : "#fef3c7",
                    color: "inherit",
                    boxShadow: selected === seg.ann.id ? "0 0 0 2px #354F99" : "none",
                  }}
                  title={`${seg.ann.authorName}${seg.ann.resolved ? " · résolu" : ""}`}
                >
                  {seg.text}
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-muted italic">Aucun texte de version. Créez une version pour démarrer la négociation.</p>
        )}
      </div>

      {/* Rail annotations */}
      <div className="lg:col-span-2 space-y-3">
        {/* Formulaire d'annotation sur sélection */}
        {pending && canAnnotate && (
          <AnnotationForm
            quote={pending.text}
            guest={guest}
            onCancel={() => setPending(null)}
            onSubmit={async (body, proposedText, visibility) => {
              await onAdd({ body, anchorStart: pending.start, anchorEnd: pending.end, quote: pending.text, proposedText, visibility });
              setPending(null);
            }}
          />
        )}

        {/* Annotation sélectionnée */}
        {selectedAnn && !pending && (
          <AnnotationThread
            annotation={selectedAnn}
            guest={guest}
            onClose={() => setSelected(null)}
            onResolve={onResolve}
          />
        )}

        {/* Liste des annotations */}
        {!pending && !selectedAnn && (
          <div className="bg-white rounded-card border border-line shadow-card p-4">
            <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest mb-3">
              Annotations <span className="text-ink-placeholder">({anchored.length + general.length})</span>
            </p>
            {anchored.length + general.length === 0 ? (
              <p className="text-xs text-ink-muted italic py-3 text-center">
                Aucune annotation. {canAnnotate ? "Surlignez un passage du contrat pour en créer une." : ""}
              </p>
            ) : (
              <div className="space-y-2">
                {[...anchored, ...general].map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a.id)}
                    className={`w-full text-left rounded-panel border p-2.5 transition-all hover:border-brand/40 ${a.resolved ? "bg-surface-subtle border-line-subtle opacity-70" : "bg-white border-line"}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: a.visibility === "EXTERNAL" ? "#1e40af" : "#92400e" }}>
                        {a.visibility === "EXTERNAL" ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {a.authorName}
                      </span>
                      {a.resolved && <span className="text-[9px] font-bold text-success uppercase">résolu</span>}
                    </div>
                    {a.quote && <p className="text-[11px] text-ink-subtle italic mb-1 line-clamp-1">« {a.quote} »</p>}
                    <p className="text-xs text-ink-secondary line-clamp-2">{a.body}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Formulaire d'ajout d'annotation (note + proposition optionnelle). */
function AnnotationForm({
  quote, guest, onCancel, onSubmit,
}: {
  quote: string;
  guest?: boolean;
  onCancel: () => void;
  onSubmit: (body: string, proposedText: string | null, visibility: "INTERNAL" | "EXTERNAL") => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [proposed, setProposed] = useState("");
  const [showProposed, setShowProposed] = useState(false);
  const [shareExternal, setShareExternal] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!body.trim()) return;
    setBusy(true);
    const visibility = guest || shareExternal ? "EXTERNAL" : "INTERNAL";
    try { await onSubmit(body.trim(), showProposed ? (proposed.trim() || null) : null, visibility); }
    finally { setBusy(false); }
  }

  return (
    <div className="bg-white rounded-card border border-brand/30 shadow-card p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-brand uppercase tracking-widest">Annoter ce passage</p>
        <button onClick={onCancel} className="p-1 rounded-md text-ink-subtle hover:bg-surface-subtle"><X className="w-3.5 h-3.5" /></button>
      </div>
      <p className="text-[11px] text-ink-subtle italic bg-warning-light/50 rounded px-2 py-1 line-clamp-2">« {quote} »</p>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} autoFocus placeholder="Votre remarque…" className="w-full text-sm px-3 py-2 border border-line rounded-lg outline-none focus:border-brand/40 resize-y placeholder:text-ink-placeholder" />

      {showProposed ? (
        <textarea value={proposed} onChange={(e) => setProposed(e.target.value)} rows={2} autoFocus placeholder="Texte de remplacement proposé…" className="w-full text-sm px-3 py-2 border border-line rounded-lg outline-none focus:border-brand/40 resize-y placeholder:text-ink-placeholder" />
      ) : (
        <button onClick={() => setShowProposed(true)} className="text-[11px] font-semibold text-brand hover:underline inline-flex items-center gap-1">
          <CornerDownRight className="w-3 h-3" /> Proposer une reformulation
        </button>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        {!guest ? (
          <label className="flex items-center gap-1.5 text-[11px] text-ink-secondary cursor-pointer select-none">
            <input type="checkbox" checked={shareExternal} onChange={(e) => setShareExternal(e.target.checked)} className="w-3.5 h-3.5 rounded accent-[#354F99] cursor-pointer" />
            Visible par la contrepartie
          </label>
        ) : <span />}
        <button onClick={() => void submit()} disabled={busy || !body.trim()} className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-hover transition-all disabled:opacity-50">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquarePlus className="w-3.5 h-3.5" />} Annoter
        </button>
      </div>
    </div>
  );
}

/** Détail d'une annotation (passage, note, reformulation proposée, résolution). */
function AnnotationThread({
  annotation, guest, onClose, onResolve,
}: {
  annotation: NegoComment;
  guest?: boolean;
  onClose: () => void;
  onResolve?: (commentId: string, resolved: boolean) => Promise<void>;
}) {
  return (
    <div className="bg-white rounded-card border border-line shadow-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: annotation.visibility === "EXTERNAL" ? "#1e40af" : "#92400e" }}>
          {annotation.visibility === "EXTERNAL" ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
          {annotation.authorName}
        </span>
        <button onClick={onClose} className="p-1 rounded-md text-ink-subtle hover:bg-surface-subtle"><X className="w-3.5 h-3.5" /></button>
      </div>
      {annotation.quote && <p className="text-[11px] text-ink-subtle italic border-l-2 border-warning pl-2">« {annotation.quote} »</p>}
      <p className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed">{annotation.body}</p>
      {annotation.proposedText && (
        <div className="rounded-panel bg-success-light/40 border border-success/20 p-2.5">
          <p className="text-[9px] font-bold text-success-dark uppercase tracking-wide mb-1 flex items-center gap-1"><CornerDownRight className="w-3 h-3" /> Reformulation proposée</p>
          <p className="text-sm text-ink-secondary whitespace-pre-wrap">{annotation.proposedText}</p>
        </div>
      )}
      <p className="text-[10px] text-ink-subtle">{fmtDate(annotation.createdAt)}</p>

      {!guest && onResolve && (
        <button onClick={() => void onResolve(annotation.id, !annotation.resolved)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border border-line hover:bg-surface-subtle">
          <Check className={`w-3.5 h-3.5 ${annotation.resolved ? "text-success" : "text-ink-subtle"}`} /> {annotation.resolved ? "Marquer non résolu" : "Marquer résolu"}
        </button>
      )}
    </div>
  );
}
