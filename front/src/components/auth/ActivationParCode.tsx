import { useEffect, useState } from "react";
import { ExternalLink, Loader2, MailCheck, ShieldCheck } from "lucide-react";

import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { fetchProxy } from "../../utils/fetchProxy";

/** Délai minimal entre deux renvois du code (le serveur limite aussi). */
const ATTENTE_RENVOI_S = 30;

/**
 * Raccourci « ouvrir sa messagerie » pour aller lire le code. On ne le propose
 * que lorsqu'on reconnaît le fournisseur (Gmail ou Outlook) dans le domaine de
 * l'adresse ; pour toute autre adresse, on n'affiche rien (on ne saurait pas
 * vers quelle boîte envoyer).
 */
function messagerie(email: string): { nom: string; url: string } | null {
  const domaine = email.split("@")[1]?.toLowerCase() ?? "";
  if (/gmail/.test(domaine)) {
    return { nom: "Ouvrir Gmail", url: "https://mail.google.com/mail/u/0/#inbox" };
  }
  if (/outlook/.test(domaine)) {
    return { nom: "Ouvrir Outlook", url: "https://outlook.live.com/mail/0/inbox" };
  }
  return null;
}

interface Props {
  /** Adresse à laquelle le code d'activation a été envoyé. */
  email: string;
  /** Retour au formulaire (champs conservés) pour corriger l'adresse. */
  onModifier: () => void;
  /** Compte activé et session ouverte : le parent enchaîne (fetchUser + navigation). */
  onActive: () => void;
  /** Bascule sur le panneau de connexion (compte déjà activé). */
  onSeConnecter: () => void;
}

/**
 * Saisie du code d'activation reçu par e-mail (nouveau flux d'activation).
 *
 * L'utilisateur tape le code à 6 chiffres ; à la validation, le serveur active
 * le compte et ouvre la session — l'utilisateur poursuit sa navigation, sans
 * lien à cliquer ni page de retour.
 */
export function ActivationParCode({
  email,
  onModifier,
  onActive,
  onSeConnecter,
}: Props) {
  const [code, setCode] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [dejaActive, setDejaActive] = useState(false);

  const [attente, setAttente] = useState(ATTENTE_RENVOI_S);
  const [renvoi, setRenvoi] = useState<"idle" | "envoi" | "ok" | "erreur">("idle");

  useEffect(() => {
    if (attente <= 0) return;
    const t = window.setTimeout(() => setAttente((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [attente]);

  const handleChangeCode = (valeur: string) => {
    // On ne garde que les chiffres, 6 au maximum.
    setCode(valeur.replace(/\D/g, "").slice(0, 6));
    setErreur(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code.length !== 6 || enCours) return;

    setEnCours(true);
    setErreur(null);
    try {
      const response = await fetchProxy("/api/user/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; alreadyVerified?: boolean; message?: string }
        | null;

      if (!response.ok || !payload?.success) {
        setErreur(payload?.message ?? "Code invalide. Veuillez réessayer.");
        setEnCours(false);
        return;
      }

      // Compte déjà activé (aucune session ouverte) : on invite à se connecter.
      if (payload.alreadyVerified) {
        setDejaActive(true);
        setEnCours(false);
        return;
      }

      // Activé et connecté : le parent enchaîne.
      onActive();
    } catch {
      setErreur("Serveur injoignable. Vérifiez votre connexion et réessayez.");
      setEnCours(false);
    }
  };

  async function renvoyer() {
    setRenvoi("envoi");
    try {
      const res = await fetchProxy("/api/user/resend-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setRenvoi(res.ok ? "ok" : "erreur");
    } catch {
      setRenvoi("erreur");
    }
    setAttente(ATTENTE_RENVOI_S);
  }

  if (dejaActive) {
    return (
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light">
          <ShieldCheck className="h-6 w-6 text-brand" strokeWidth={1.75} />
        </div>
        <p className="text-sm text-ink-secondary">
          Ce compte est déjà activé. Vous pouvez vous connecter.
        </p>
        <Button
          type="button"
          size="lg"
          className="w-full text-background border border-lumenjuris"
          onClick={onSeConnecter}
        >
          Se connecter
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light">
          <MailCheck className="h-6 w-6 text-brand" strokeWidth={1.75} />
        </div>
        <div className="space-y-1">
          <p className="text-sm text-ink-muted">
            Nous avons envoyé un code d'activation à
          </p>
          <p className="break-all text-sm font-semibold text-ink">{email}</p>
        </div>

        {messagerie(email) && (
          <a
            href={messagerie(email)!.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-primary px-4 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            {messagerie(email)!.nom}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          id="activation-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          placeholder="Code à 6 chiffres"
          value={code}
          onChange={(event) => handleChangeCode(event.target.value)}
          className={`text-center text-lg font-semibold tracking-[0.4em] ${
            erreur ? "border-destructive ring-1 ring-destructive" : ""
          }`}
        />
        {erreur && <p className="text-[12px] text-destructive">{erreur}</p>}

        <Button
          type="submit"
          size="lg"
          disabled={code.length !== 6 || enCours}
          className="w-full text-background border border-lumenjuris"
        >
          {enCours ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          {enCours ? "Activation…" : "Activer mon compte"}
        </Button>
      </form>

      <div className="flex flex-col items-center gap-1 text-[12.5px] text-ink-muted">
        {attente > 0 ? (
          <p>Renvoyer le code (possible dans {attente} s)</p>
        ) : (
          <button
            type="button"
            onClick={() => void renvoyer()}
            disabled={renvoi === "envoi"}
            className="inline-flex items-center gap-1.5 font-semibold text-brand underline-offset-2 hover:underline disabled:opacity-60"
          >
            {renvoi === "envoi" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Renvoyer le code
          </button>
        )}
        {renvoi === "ok" && <p className="text-success-dark">Nouveau code envoyé.</p>}
        {renvoi === "erreur" && (
          <p className="text-destructive">Le renvoi n'a pas abouti. Réessayez.</p>
        )}
      </div>

      <p className="text-center text-[12.5px] text-ink-muted">
        Mauvaise adresse ?{" "}
        <button
          type="button"
          onClick={onModifier}
          className="font-semibold text-brand underline-offset-2 hover:underline"
        >
          Modifier
        </button>
      </p>
    </div>
  );
}
