import { useState } from "react";
import { Users, Plus, Trash2, Loader2 } from "lucide-react";
import { negotiationApi } from "./api";
import { ROLE_LABEL } from "./types";
import type { NegotiationDetail, ParticipantRole, ParticipantSide } from "./types";

interface Props {
  data: NegotiationDetail;
  canEdit: boolean;
  onChanged: () => void;
}

/** Participants internes / externes et leurs rôles. */
export function ParticipantsPanel({ data, canEdit, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<ParticipantSide>("EXTERNAL");
  const [role, setRole] = useState<ParticipantRole>("COMMENTER");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      await negotiationApi.addParticipant(data.id, { side, role, name: name.trim() || undefined, email: email.trim() || undefined });
      setName(""); setEmail(""); setOpen(false);
      onChanged();
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm("Retirer ce participant ?")) return;
    await negotiationApi.removeParticipant(data.id, id);
    onChanged();
  }

  return (
    <div className="bg-white rounded-card border border-line shadow-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-ink-muted" />
          <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Participants</p>
          <span className="text-[10px] font-semibold text-ink-subtle bg-surface-muted px-1.5 py-0.5 rounded-chip">{data.participants.length}</span>
        </div>
        {canEdit && (
          <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand bg-brand-light rounded-lg hover:bg-brand-muted/40 transition-all">
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
        )}
      </div>

      {open && canEdit && (
        <div className="rounded-panel border border-line p-3 space-y-2">
          <div className="flex gap-2">
            <select value={side} onChange={(e) => setSide(e.target.value as ParticipantSide)} className="flex-1 text-xs px-2.5 py-1.5 border border-line rounded-lg outline-none focus:border-brand/40 cursor-pointer">
              <option value="INTERNAL">Interne</option>
              <option value="EXTERNAL">Externe</option>
            </select>
            <select value={role} onChange={(e) => setRole(e.target.value as ParticipantRole)} className="flex-1 text-xs px-2.5 py-1.5 border border-line rounded-lg outline-none focus:border-brand/40 cursor-pointer">
              {(Object.keys(ROLE_LABEL) as ParticipantRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" className="w-full text-sm px-3 py-1.5 border border-line rounded-lg outline-none focus:border-brand/40 placeholder:text-ink-placeholder" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full text-sm px-3 py-1.5 border border-line rounded-lg outline-none focus:border-brand/40 placeholder:text-ink-placeholder" />
          <button onClick={() => void add()} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-hover transition-all disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Ajouter le participant
          </button>
        </div>
      )}

      {data.participants.length === 0 ? (
        <p className="text-xs text-ink-muted italic py-3 text-center">Aucun participant.</p>
      ) : (
        <div className="space-y-1.5">
          {data.participants.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-surface-subtle group">
              <div className="min-w-0">
                <span className="text-sm font-medium text-ink truncate">{p.name || p.email || "Participant"}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-chip" style={{ backgroundColor: p.side === "EXTERNAL" ? "#dbeafe" : "#e5e7eb", color: p.side === "EXTERNAL" ? "#1e40af" : "#374151" }}>
                    {p.side === "EXTERNAL" ? "Externe" : "Interne"}
                  </span>
                  <span className="text-[10px] text-ink-muted">{ROLE_LABEL[p.role]}</span>
                </div>
              </div>
              {canEdit && (
                <button onClick={() => void remove(p.id)} className="p-1.5 rounded-lg text-ink-subtle hover:text-danger hover:bg-danger-light transition-all opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
