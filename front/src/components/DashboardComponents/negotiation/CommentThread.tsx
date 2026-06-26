import { useState } from "react";
import { MessageSquare, Send, Loader2, Lock, Globe } from "lucide-react";
import { fmtDate } from "../contratheque/types";
import { negotiationApi } from "./api";
import type { NegotiationDetail, CommentVisibility } from "./types";

interface Props {
  data: NegotiationDetail;
  canEdit: boolean;
  onChanged: () => void;
}

/** Fil de commentaires ancrés, avec distinction interne / externe. */
export function CommentThread({ data, canEdit, onChanged }: Props) {
  const [body, setBody] = useState("");
  const [clauseRef, setClauseRef] = useState("");
  const [visibility, setVisibility] = useState<CommentVisibility>("INTERNAL");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await negotiationApi.addComment(data.id, { body: body.trim(), clauseRef: clauseRef.trim() || null, visibility });
      setBody(""); setClauseRef("");
      onChanged();
    } finally { setBusy(false); }
  }

  return (
    <div className="bg-white rounded-card border border-line shadow-card p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-ink-muted" />
        <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Commentaires</p>
        <span className="text-[10px] font-semibold text-ink-subtle bg-surface-muted px-1.5 py-0.5 rounded-chip">{data.comments.length}</span>
      </div>

      <div className="space-y-2.5 mb-4 max-h-72 overflow-y-auto">
        {data.comments.length === 0 && <p className="text-xs text-ink-muted italic py-4 text-center">Aucun commentaire.</p>}
        {data.comments.map((c) => (
          <div key={c.id} className={`rounded-panel border p-3 ${c.visibility === "EXTERNAL" ? "border-info/30 bg-info-light/30" : "border-line bg-white"}`}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: c.visibility === "EXTERNAL" ? "#1e40af" : "#6b7280" }}>
                {c.visibility === "EXTERNAL" ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {c.visibility === "EXTERNAL" ? "Externe" : "Interne"}
                {c.clauseRef && <span className="text-ink-subtle font-medium normal-case">· {c.clauseRef}</span>}
              </span>
              <span className="text-[10px] text-ink-subtle">{fmtDate(c.createdAt)}</span>
            </div>
            <p className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="mt-auto space-y-2">
          <div className="flex items-center gap-2">
            <input value={clauseRef} onChange={(e) => setClauseRef(e.target.value)} placeholder="Clause (optionnel)" className="flex-1 text-xs px-2.5 py-1.5 border border-line rounded-lg outline-none focus:border-brand/40 placeholder:text-ink-placeholder" />
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as CommentVisibility)} className="text-xs px-2.5 py-1.5 border border-line rounded-lg outline-none focus:border-brand/40 cursor-pointer">
              <option value="INTERNAL">Interne</option>
              <option value="EXTERNAL">Externe (visible contrepartie)</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Votre commentaire…" className="flex-1 text-sm px-3 py-2 border border-line rounded-lg outline-none focus:border-brand/40 resize-none placeholder:text-ink-placeholder" />
            <button onClick={() => void add()} disabled={busy || !body.trim()} className="inline-flex items-center px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-hover transition-all disabled:opacity-40 shrink-0">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
