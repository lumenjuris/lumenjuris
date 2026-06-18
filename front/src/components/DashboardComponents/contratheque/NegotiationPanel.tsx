import { useState } from "react";
import {
  MessageSquare, Send, Check, Trash2, Loader2, CheckCircle2, XCircle, Clock, FileText,
} from "lucide-react";
import { contractApi } from "./api";
import { fmtDate } from "./types";
import type { ContractDetail, ContractComment, ApprovalStatus } from "./types";
import { VersionCompare } from "./VersionCompare";
import { ClauseReformulator } from "./ClauseReformulator";

interface Props {
  data: ContractDetail;
  canEdit: boolean;
  onChanged: () => void;
}

const APPROVAL_STYLE: Record<ApprovalStatus, { label: string; bg: string; fg: string; icon: React.ElementType }> = {
  DRAFT:    { label: "Brouillon",          bg: "#f1f5f9", fg: "#64748b", icon: FileText },
  PENDING:  { label: "En attente",         bg: "#fef3c7", fg: "#92400e", icon: Clock },
  APPROVED: { label: "Approuvé",           bg: "#d1fae5", fg: "#065f46", icon: CheckCircle2 },
  REJECTED: { label: "Rejeté",             bg: "#fee2e2", fg: "#991b1b", icon: XCircle },
};

/** Panneau de négociation : workflow d'approbation + commentaires collaboratifs. */
export function NegotiationPanel({ data, canEdit, onChanged }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ApprovalCard data={data} canEdit={canEdit} onChanged={onChanged} />
        <CommentsCard contractId={data.id} comments={data.comments} canEdit={canEdit} onChanged={onChanged} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VersionCompare data={data} canEdit={canEdit} onChanged={onChanged} />
        <ClauseReformulator />
      </div>
    </div>
  );
}

/** Carte du workflow d'approbation. */
function ApprovalCard({ data, canEdit, onChanged }: { data: ContractDetail; canEdit: boolean; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const cfg = APPROVAL_STYLE[data.approvalStatus];

  async function setStatus(status: ApprovalStatus) {
    setBusy(true);
    try {
      await contractApi.setApproval(data.id, status, note.trim() || null);
      setNote("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-card border border-line shadow-card p-5">
      <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest mb-3">Workflow d'approbation</p>

      <div className="flex items-center gap-2 mb-4">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-chip"
          style={{ backgroundColor: cfg.bg, color: cfg.fg }}
        >
          <cfg.icon className="w-3.5 h-3.5" /> {cfg.label}
        </span>
        {data.approvedAt && (
          <span className="text-[11px] text-ink-muted">le {fmtDate(data.approvedAt)}</span>
        )}
      </div>

      {data.approvalNote && (
        <p className="text-xs text-ink-secondary bg-surface-subtle rounded-panel p-2.5 mb-3 italic">
          « {data.approvalNote} »
        </p>
      )}

      {canEdit ? (
        <>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Motif / commentaire de décision (optionnel)…"
            className="w-full text-sm px-3 py-2 border border-line rounded-lg outline-none focus:border-brand/40 transition-all resize-none placeholder:text-ink-placeholder mb-2.5"
          />
          <div className="flex flex-wrap gap-2">
            {data.approvalStatus === "DRAFT" && (
              <ActionBtn onClick={() => void setStatus("PENDING")} busy={busy} icon={Clock} variant="brand">
                Soumettre pour approbation
              </ActionBtn>
            )}
            {data.approvalStatus !== "APPROVED" && (
              <ActionBtn onClick={() => void setStatus("APPROVED")} busy={busy} icon={CheckCircle2} variant="success">
                Approuver
              </ActionBtn>
            )}
            {data.approvalStatus !== "REJECTED" && (
              <ActionBtn onClick={() => void setStatus("REJECTED")} busy={busy} icon={XCircle} variant="danger">
                Rejeter
              </ActionBtn>
            )}
            {data.approvalStatus !== "DRAFT" && (
              <ActionBtn onClick={() => void setStatus("DRAFT")} busy={busy} icon={FileText} variant="ghost">
                Repasser en brouillon
              </ActionBtn>
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-ink-muted">Vous n'avez pas les droits pour modifier l'approbation.</p>
      )}
    </div>
  );
}

function ActionBtn({
  onClick, busy, icon: Icon, variant, children,
}: {
  onClick: () => void;
  busy: boolean;
  icon: React.ElementType;
  variant: "brand" | "success" | "danger" | "ghost";
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    brand: "bg-brand text-white hover:bg-brand-hover",
    success: "bg-success-light text-success-dark hover:bg-success/20 border border-success/20",
    danger: "bg-danger-light text-danger-dark hover:bg-danger/20 border border-danger/20",
    ghost: "bg-white text-ink-secondary border border-line hover:bg-surface-subtle",
  };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all disabled:opacity-50 ${styles[variant]}`}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}

/** Carte du fil de commentaires collaboratifs. */
function CommentsCard({
  contractId, comments, canEdit, onChanged,
}: {
  contractId: string;
  comments: ContractComment[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!draft.trim()) return;
    setBusy(true);
    try { await contractApi.addComment(contractId, draft.trim()); setDraft(""); onChanged(); }
    finally { setBusy(false); }
  }

  async function toggleResolve(c: ContractComment) {
    await contractApi.resolveComment(c.id, !c.resolved);
    onChanged();
  }

  async function remove(c: ContractComment) {
    if (!confirm("Supprimer ce commentaire ?")) return;
    await contractApi.deleteComment(c.id);
    onChanged();
  }

  return (
    <div className="lg:col-span-2 bg-white rounded-card border border-line shadow-card p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-ink-muted" />
        <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Fil de négociation</p>
        <span className="text-[10px] font-semibold text-ink-subtle bg-surface-muted px-1.5 py-0.5 rounded-chip">{comments.length}</span>
      </div>

      {/* Liste des commentaires */}
      <div className="space-y-2.5 mb-4 max-h-72 overflow-y-auto">
        {comments.length === 0 && (
          <p className="text-xs text-ink-muted italic py-4 text-center">Aucun échange pour le moment.</p>
        )}
        {comments.map((c) => (
          <div
            key={c.id}
            className={`rounded-panel border p-3 group ${c.resolved ? "bg-surface-subtle border-line-subtle opacity-70" : "bg-white border-line"}`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-semibold text-ink">{c.userName ?? "Utilisateur"}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-ink-subtle">{fmtDate(c.createdAt)}</span>
                {canEdit && (
                  <>
                    <button
                      onClick={() => void toggleResolve(c)}
                      className={`p-1 rounded-md transition-all ${c.resolved ? "text-success" : "text-ink-subtle hover:text-success hover:bg-success-light"}`}
                      title={c.resolved ? "Marquer non traité" : "Marquer traité"}
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => void remove(c)}
                      className="p-1 rounded-md text-ink-subtle hover:text-danger hover:bg-danger-light transition-all opacity-0 group-hover:opacity-100"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed">{c.body}</p>
            {c.resolved && <span className="text-[9px] font-bold text-success uppercase tracking-wide mt-1.5 inline-block">Traité</span>}
          </div>
        ))}
      </div>

      {/* Saisie */}
      {canEdit && (
        <div className="flex items-end gap-2 mt-auto">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void add(); }}
            rows={2}
            placeholder="Ajouter un commentaire (Ctrl+Entrée pour envoyer)…"
            className="flex-1 text-sm px-3 py-2 border border-line rounded-lg outline-none focus:border-brand/40 transition-all resize-none placeholder:text-ink-placeholder"
          />
          <button
            onClick={() => void add()}
            disabled={busy || !draft.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-hover transition-all disabled:opacity-40 shrink-0"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
