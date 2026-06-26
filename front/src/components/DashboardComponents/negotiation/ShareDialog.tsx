import { useState } from "react";
import { Link2, Loader2, Copy, Check, Ban } from "lucide-react";
import { fmtDate } from "../contratheque/types";
import { negotiationApi } from "./api";
import type { NegotiationDetail } from "./types";

interface Props {
  data: NegotiationDetail;
  canEdit: boolean;
  onChanged: () => void;
}

function guestUrl(token: string): string {
  return `${window.location.origin}/negociation-invite/${token}`;
}

/** Partage externe sécurisé : liens invités à durée limitée. */
export function ShareDialog({ data, canEdit, onChanged }: Props) {
  const [ttl, setTtl] = useState(168);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");

  async function create() {
    setBusy(true);
    try { await negotiationApi.inviteGuest(data.id, ttl); onChanged(); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) {
    if (!confirm("Révoquer ce lien d'accès ?")) return;
    await negotiationApi.revokeGuest(data.id, id);
    onChanged();
  }
  function copy(token: string) {
    void navigator.clipboard.writeText(guestUrl(token));
    setCopied(token);
    setTimeout(() => setCopied(""), 1500);
  }

  return (
    <div className="bg-white rounded-card border border-line shadow-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4 text-ink-muted" />
        <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Partage externe (liens invité)</p>
      </div>

      {canEdit && (
        <div className="flex items-center gap-2">
          <select value={ttl} onChange={(e) => setTtl(Number(e.target.value))} className="text-xs px-2.5 py-1.5 border border-line rounded-lg outline-none focus:border-brand/40 cursor-pointer">
            <option value={24}>Valable 24 h</option>
            <option value={72}>Valable 3 jours</option>
            <option value={168}>Valable 7 jours</option>
            <option value={720}>Valable 30 jours</option>
          </select>
          <button onClick={() => void create()} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-hover transition-all disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />} Générer un lien
          </button>
        </div>
      )}

      {data.guestAccesses.length === 0 ? (
        <p className="text-xs text-ink-muted italic py-2">Aucun lien partagé.</p>
      ) : (
        <div className="space-y-1.5">
          {data.guestAccesses.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-surface-subtle">
              <div className="min-w-0">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-chip ${g.active ? "text-success-dark bg-success-light" : "text-ink-muted bg-surface-muted"}`}>
                  {g.active ? "Actif" : g.revokedAt ? "Révoqué" : "Expiré"}
                </span>
                <span className="text-[10px] text-ink-muted ml-2">expire le {fmtDate(g.expiresAt)}</span>
              </div>
              <div className="flex items-center gap-1">
                {g.active && (
                  <button onClick={() => copy(g.token)} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-brand hover:bg-brand-light rounded-md">
                    {copied === g.token ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                    {copied === g.token ? "Copié" : "Copier le lien"}
                  </button>
                )}
                {canEdit && g.active && (
                  <button onClick={() => void revoke(g.id)} className="p-1.5 rounded-md text-ink-subtle hover:text-danger hover:bg-danger-light transition-all" title="Révoquer">
                    <Ban className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
