import { useState } from "react";
import { Plus, Loader2, Check, X, RefreshCw } from "lucide-react";
import { negotiationApi } from "./api";
import { PROPOSAL_STATUS_LABEL, PROPOSAL_STATUS_STYLE } from "./types";
import type { NegotiationDetail, NegoProposal, ProposalStatus } from "./types";

interface Props {
  data: NegotiationDetail;
  canEdit: boolean;
  onChanged: () => void;
}

/** Propositions / contre-propositions au niveau de la clause (redlines). */
export function ClauseRedlines({ data, canEdit, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [clauseRef, setClauseRef] = useState("");
  const [proposedText, setProposedText] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!clauseRef.trim() || !proposedText.trim()) return;
    setBusy(true);
    try {
      await negotiationApi.addProposal(data.id, { clauseRef: clauseRef.trim(), proposedText: proposedText.trim(), originalText: originalText.trim() || undefined });
      setClauseRef(""); setProposedText(""); setOriginalText(""); setOpen(false);
      onChanged();
    } finally { setBusy(false); }
  }

  async function setStatus(p: NegoProposal, status: ProposalStatus) {
    await negotiationApi.setProposalStatus(data.id, p.id, status);
    onChanged();
  }

  return (
    <div className="bg-white rounded-card border border-line shadow-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-ink-muted" />
          <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Propositions (redlines)</p>
          <span className="text-[10px] font-semibold text-ink-subtle bg-surface-muted px-1.5 py-0.5 rounded-chip">{data.proposals.length}</span>
        </div>
        {canEdit && (
          <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand bg-brand-light rounded-lg hover:bg-brand-muted/40 transition-all">
            <Plus className="w-3.5 h-3.5" /> Proposer
          </button>
        )}
      </div>

      {open && canEdit && (
        <div className="rounded-panel border border-line p-3 space-y-2">
          <input value={clauseRef} onChange={(e) => setClauseRef(e.target.value)} placeholder="Clause visée (ex. Article 5)" className="w-full text-sm px-3 py-1.5 border border-line rounded-lg outline-none focus:border-brand/40 placeholder:text-ink-placeholder" />
          <textarea value={originalText} onChange={(e) => setOriginalText(e.target.value)} rows={2} placeholder="Texte actuel (optionnel)" className="w-full text-sm px-3 py-2 border border-line rounded-lg outline-none focus:border-brand/40 resize-y placeholder:text-ink-placeholder" />
          <textarea value={proposedText} onChange={(e) => setProposedText(e.target.value)} rows={3} placeholder="Rédaction proposée" className="w-full text-sm px-3 py-2 border border-line rounded-lg outline-none focus:border-brand/40 resize-y placeholder:text-ink-placeholder" />
          <button onClick={() => void add()} disabled={busy || !clauseRef.trim() || !proposedText.trim()} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-hover transition-all disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Ajouter la proposition
          </button>
        </div>
      )}

      {data.proposals.length === 0 ? (
        <p className="text-xs text-ink-muted italic py-3 text-center">Aucune proposition pour le moment.</p>
      ) : (
        <div className="space-y-2.5">
          {data.proposals.map((p) => {
            const st = PROPOSAL_STATUS_STYLE[p.status];
            return (
              <div key={p.id} className="rounded-panel border border-line p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-ink">{p.clauseRef}</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-chip" style={{ backgroundColor: st.bg, color: st.fg }}>{PROPOSAL_STATUS_LABEL[p.status]}</span>
                </div>
                {p.originalText && <p className="text-xs text-danger-dark/80 line-through decoration-danger/30 mb-1 whitespace-pre-wrap">{p.originalText}</p>}
                <p className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed">{p.proposedText}</p>
                {canEdit && p.status === "PROPOSED" && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <button onClick={() => void setStatus(p, "ACCEPTED")} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-success-dark bg-success-light rounded-md hover:bg-success/20"><Check className="w-3 h-3" /> Accepter</button>
                    <button onClick={() => void setStatus(p, "REJECTED")} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-danger-dark bg-danger-light rounded-md hover:bg-danger/20"><X className="w-3 h-3" /> Rejeter</button>
                    <button onClick={() => void setStatus(p, "COUNTERED")} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-warning-dark bg-warning-light rounded-md hover:bg-warning/20"><RefreshCw className="w-3 h-3" /> Contre-proposer</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
