import { useState } from "react";
import { Link2, Loader2, Copy, Check, Ban, Send, Mail } from "lucide-react";
import { fmtDate } from "../contratheque/types";
import { negotiationApi } from "./api";
import type { NegotiationDetail } from "./types";
import { ConfirmationModal } from "../../ui/ConfirmationModal";

interface Props {
  data?: NegotiationDetail | null; // <-- Rend data optionnel
  canEdit: boolean;
  onChanged: () => void;
  onCreateNegotiation?: () => Promise<NegotiationDetail>;
}

function guestUrl(token: string): string {
  return `${window.location.origin}/negociation-invite/${token}`;
}

/** Partage externe sécurisé : liens invités nominatifs, à durée limitée,
 *  avec envoi d'e-mail d'invitation et relance. */
export function ShareDialog({ 
  data, 
  canEdit, 
  onChanged, 
  onCreateNegotiation 
}: Props) { // <-- 1. Récupération de onCreateNegotiation ici
  const [ttl, setTtl] = useState(168);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const [reminding, setReminding] = useState("");
  const [remindOk, setRemindOk] = useState("");
  const [linkId, setLinkId] = useState<string | null>(null);
  const [validateModalOpen, setValidateModalOpen] = useState(false);

  async function create() {
  setBusy(true);
  try {
    let currentData = data;

    if (!currentData && onCreateNegotiation) {
      currentData = await onCreateNegotiation();
    }

    if (!currentData) return;

    // Utilisation stricte de currentData
    await negotiationApi.inviteGuest(currentData.id, {
      ttlHours: ttl,
      name: name.trim() || undefined,
      email: email.trim() || undefined,
      fillSide: currentData.mode === "COMPLETION" ? "COUNTERPARTY" : undefined,
      role: currentData.mode === "COMPLETION" ? "FILLER" : "COMMENTER",
      sendEmail: Boolean(email.trim()),
    });

    setName(""); 
    setEmail("");
    onChanged();
  } finally { 
    setBusy(false); 
  }
}

  async function revoke(id: string) {
    setLinkId(id);
    setValidateModalOpen(true);
  }

  async function validateConfirmed() {
    if (!linkId || !data) return;
    try {
      await negotiationApi.revokeGuest(data.id, linkId);
      onChanged();
    } catch {}
    finally {
      setLinkId(null);
      setValidateModalOpen(false);
    }
  }

  async function remind(id: string) {
    if (!data) return;
    setReminding(id);
    try {
      const r = await negotiationApi.remindGuest(data.id, id);
      if (r.emailSent) { 
        setRemindOk(id); 
        setTimeout(() => setRemindOk(""), 2000); 
      }
      onChanged();
    } finally { 
      setReminding(""); 
    }
  }

  function copy(token: string) {
    void navigator.clipboard.writeText(guestUrl(token));
    setCopied(token);
    setTimeout(() => setCopied(""), 1500);
  }

  // Sécurisation au cas où data n'est pas encore défini
  const guestAccesses = data?.guestAccesses || [];

  return (
    <div className="bg-white rounded-card border border-line shadow-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Link2 className="w-4 h-4 text-ink-muted" />
        <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Partage externe (liens invité)</p>
      </div>

      {canEdit && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom du destinataire"
              className="flex-1 min-w-0 text-xs px-2.5 py-1.5 border border-line rounded-lg outline-none focus:border-brand/40 placeholder:text-ink-placeholder"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="E-mail (invitation automatique)"
              className="flex-1 min-w-0 text-xs px-2.5 py-1.5 border border-line rounded-lg outline-none focus:border-brand/40 placeholder:text-ink-placeholder"
            />
          </div>
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
        </div>
      )}

      {/* 3. Utilisation de la liste sécurisée */}
      {guestAccesses.length === 0 ? (
        <p className="text-xs text-ink-muted italic py-2">Aucun lien partagé.</p>
      ) : (
        <div className="space-y-1.5">
          {guestAccesses.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-surface-subtle">
              <div className="min-w-0">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-chip ${g.active ? "text-success-dark bg-success-light" : "text-ink-muted bg-surface-muted"}`}>
                  {g.active ? "Actif" : g.revokedAt ? "Révoqué" : "Expiré"}
                </span>
                <span className="text-[11px] font-medium text-ink-secondary ml-2 truncate">
                  {g.name || g.email || "Lien anonyme"}
                </span>
                <span className="text-[10px] text-ink-muted ml-2">expire le {fmtDate(g.expiresAt)}</span>
                {g.lastSentAt && (
                  <span className="text-[10px] text-ink-subtle ml-2 inline-flex items-center gap-0.5">
                    <Mail className="w-2.5 h-2.5" /> envoyé le {fmtDate(g.lastSentAt)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {g.active && (
                  <button onClick={() => copy(g.token)} className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-brand hover:bg-brand-light rounded-md">
                    {copied === g.token ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                    {copied === g.token ? "Copié" : "Copier le lien"}
                  </button>
                )}
                {canEdit && g.active && g.email && (
                  <button onClick={() => void remind(g.id)} disabled={reminding === g.id} title="Renvoyer l'invitation par e-mail" className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-brand hover:bg-brand-light rounded-md disabled:opacity-50">
                    {reminding === g.id ? <Loader2 className="w-3 h-3 animate-spin" /> : remindOk === g.id ? <Check className="w-3 h-3 text-success" /> : <Send className="w-3 h-3" />}
                    {remindOk === g.id ? "Envoyé" : "Relancer"}
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
      <ConfirmationModal
        open={validateModalOpen}
        title="Révoquer le lien d'accès"
        description={`Souhaitez-vous révoquer ce lien d'accès ?`}
        confirmLabel="Valider"
        onConfirm={validateConfirmed}
        onCancel={() => { setValidateModalOpen(false); setLinkId(null) }}
      />
    </div>
  );
}
