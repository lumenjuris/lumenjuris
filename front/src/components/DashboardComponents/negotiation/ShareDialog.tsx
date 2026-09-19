import { useState } from "react";
import { Loader2, Copy, Check, Ban, Send, Plus, Trash2, X } from "lucide-react";
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
  const [formOpen, setFormOpen] = useState(false);
  const [participantDelete, setParticipantDelete] = useState<string | null>(null);

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

  async function removeParticipantConfirmed() {
    if (!participantDelete || !data) return;
    try { await negotiationApi.removeParticipant(data.id, participantDelete); onChanged(); }
    catch {}
    finally { setParticipantDelete(null); }
  }

  const guestAccesses = data?.guestAccesses || [];
  // Personnes ajoutées sans lien d'accès (ex. collègues internes) : affichées dans la même liste.
  const guestEmails = new Set(guestAccesses.map((g) => g.email?.toLowerCase()).filter(Boolean));
  const otherParticipants = (data?.participants || []).filter((p) => !p.email || !guestEmails.has(p.email.toLowerCase()));
  const count = guestAccesses.length + otherParticipants.length;

  const btn = "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-ink-secondary bg-white border border-line rounded-lg hover:border-brand/40 hover:text-brand transition-all disabled:opacity-50";

  return (
    <div className="bg-white rounded-card border border-line shadow-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {count === 0 ? "Personne n'a encore été invité." : `${count} personne${count > 1 ? "s" : ""} invitée${count > 1 ? "s" : ""}`}
        </p>
        {canEdit && !formOpen && (
          <button onClick={() => setFormOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-hover transition-all">
            <Plus className="w-3.5 h-3.5" /> Inviter une personne
          </button>
        )}
      </div>

      {canEdit && formOpen && (
        <div className="rounded-panel border border-brand/30 bg-surface-subtle p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Inviter une personne</p>
            <button onClick={() => setFormOpen(false)} className="p-1 text-ink-subtle hover:text-ink" title="Fermer"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" className="text-sm px-3 py-2 bg-white border border-line rounded-lg outline-none focus:border-brand/40 placeholder:text-ink-placeholder" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="E-mail" className="text-sm px-3 py-2 bg-white border border-line rounded-lg outline-none focus:border-brand/40 placeholder:text-ink-placeholder" />
            <select value={ttl} onChange={(e) => setTtl(Number(e.target.value))} className="text-sm px-3 py-2 bg-white border border-line rounded-lg outline-none focus:border-brand/40 cursor-pointer">
              <option value={24}>Accès pendant 24 h</option>
              <option value={72}>Accès pendant 3 jours</option>
              <option value={168}>Accès pendant 7 jours</option>
              <option value={720}>Accès pendant 30 jours</option>
            </select>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-ink-muted">{email.trim() ? "La personne recevra le lien par e-mail." : "Sans e-mail, vous copierez le lien vous-même."}</p>
            <button onClick={() => void create()} disabled={busy || (!name.trim() && !email.trim())} className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-hover transition-all disabled:opacity-50">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} {email.trim() ? "Envoyer l'invitation" : "Créer le lien"}
            </button>
          </div>
        </div>
      )}

      {count > 0 && (
        <div className="divide-y divide-line border border-line rounded-panel">
          {guestAccesses.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink truncate">{g.name || g.email || "Lien sans nom"}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${g.active ? "text-success-dark bg-success-light" : "text-ink-muted bg-surface-muted"}`}>
                    {g.active ? "Accès actif" : g.revokedAt ? "Accès retiré" : "Accès expiré"}
                  </span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  {g.name && g.email ? `${g.email} · ` : ""}
                  {g.lastSentAt ? `Invitation envoyée le ${fmtDate(g.lastSentAt)}` : "Lien à transmettre vous-même"}
                  {g.active && g.expiresAt ? ` · jusqu'au ${fmtDate(g.expiresAt)}` : ""}
                </p>
              </div>
              {g.active && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => copy(g.token)} className={btn}>
                    {copied === g.token ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied === g.token ? "Copié" : "Copier le lien"}
                  </button>
                  {canEdit && g.email && (
                    <button onClick={() => void remind(g.id)} disabled={reminding === g.id} className={btn} title="Renvoyer l'invitation par e-mail">
                      {reminding === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : remindOk === g.id ? <Check className="w-3.5 h-3.5 text-success" /> : <Send className="w-3.5 h-3.5" />}
                      {remindOk === g.id ? "Envoyé" : "Renvoyer"}
                    </button>
                  )}
                  {canEdit && (
                    <button onClick={() => void revoke(g.id)} className="p-2 rounded-lg text-ink-subtle hover:text-danger hover:bg-danger-light transition-all" title="Retirer l'accès">
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {otherParticipants.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <span className="text-sm font-medium text-ink truncate">{p.name || p.email || "Participant"}</span>
                <p className="text-xs text-ink-muted mt-0.5">{p.side === "INTERNAL" ? "Membre de votre équipe" : "Sans lien d'accès"}</p>
              </div>
              {canEdit && (
                <button onClick={() => setParticipantDelete(p.id)} className="p-2 rounded-lg text-ink-subtle hover:text-danger hover:bg-danger-light transition-all" title="Retirer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <ConfirmationModal
        open={validateModalOpen}
        title="Retirer l'accès"
        description="Cette personne ne pourra plus ouvrir le document avec son lien. Souhaitez-vous continuer ?"
        confirmLabel="Retirer l'accès"
        onConfirm={validateConfirmed}
        onCancel={() => { setValidateModalOpen(false); setLinkId(null) }}
      />
      <ConfirmationModal
        open={participantDelete !== null}
        title="Retirer cette personne"
        description="Souhaitez-vous retirer cette personne de la négociation ?"
        confirmLabel="Retirer"
        onConfirm={removeParticipantConfirmed}
        onCancel={() => setParticipantDelete(null)}
      />
    </div>
  );
}
