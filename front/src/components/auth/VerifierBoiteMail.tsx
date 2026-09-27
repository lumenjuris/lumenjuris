import { useEffect, useState } from "react";
import { ExternalLink, Loader2, MailCheck } from "lucide-react";
import { fetchProxy } from "../../utils/fetchProxy";

/** Délai minimal entre deux renvois de l'e-mail (le serveur limite aussi). */
const ATTENTE_RENVOI_S = 30;

/** Messageries web proposées selon le domaine de l'adresse. */
function messageries(email: string): { nom: string; url: string }[] {
  const domaine = email.split("@")[1]?.toLowerCase() ?? "";
  const gmail = { nom: "Ouvrir Gmail", url: "https://mail.google.com/mail/u/0/#inbox" };
  const outlook = { nom: "Ouvrir Outlook", url: "https://outlook.live.com/mail/0/inbox" };
  const yahoo = { nom: "Ouvrir Yahoo Mail", url: "https://mail.yahoo.com" };
  if (/^(gmail|googlemail)\./.test(domaine)) return [gmail];
  if (/^(outlook|hotmail|live|msn)\./.test(domaine)) return [outlook];
  if (/^(yahoo|ymail)\./.test(domaine)) return [yahoo];
  // Adresse professionnelle : on ne sait pas quelle messagerie, on propose les deux courantes.
  return [gmail, outlook];
}

/**
 * Écran affiché juste après l'inscription, à la place du formulaire : il dit
 * où est parti l'e-mail de vérification, ouvre la messagerie d'un clic,
 * permet de renvoyer l'e-mail, de corriger l'adresse ou de passer à la
 * connexion une fois le lien cliqué.
 */
export function VerifierBoiteMail({
  email,
  onModifier,
  onSeConnecter,
}: {
  email: string;
  /** Retour au formulaire (champs conservés) pour corriger l'adresse. */
  onModifier: () => void;
  /** Bascule sur l'onglet de connexion, adresse préremplie. */
  onSeConnecter: () => void;
}) {
  const [attente, setAttente] = useState(ATTENTE_RENVOI_S);
  const [renvoi, setRenvoi] = useState<"idle" | "envoi" | "ok" | "erreur">("idle");

  useEffect(() => {
    if (attente <= 0) return;
    const t = window.setTimeout(() => setAttente((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [attente]);

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

  return (
    <div className="flex flex-col items-center gap-5 py-2 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-light">
        <MailCheck className="h-7 w-7 text-brand" strokeWidth={1.75} />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold text-ink">Vérifiez votre boîte mail</h2>
        <p className="text-sm text-ink-muted">Nous avons envoyé un lien de confirmation à</p>
        <p className="break-all text-sm font-semibold text-ink">{email}</p>
      </div>

      <div className="flex w-full flex-wrap justify-center gap-2">
        {messageries(email).map((m) => (
          <a
            key={m.nom}
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            {m.nom} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ))}
      </div>

      <div className="w-full space-y-2 rounded-lg bg-surface-subtle px-4 py-3 text-sm text-ink-secondary">
        <p>Rien reçu ? Regardez dans vos <span className="font-semibold">spams</span> ou courriers indésirables.</p>
        {attente > 0 ? (
          <p className="text-ink-muted">Renvoyer l'e-mail (possible dans {attente} s)</p>
        ) : (
          <button
            type="button"
            onClick={() => void renvoyer()}
            disabled={renvoi === "envoi"}
            className="inline-flex items-center gap-1.5 font-semibold text-brand underline-offset-2 hover:underline disabled:opacity-60"
          >
            {renvoi === "envoi" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Renvoyer l'e-mail
          </button>
        )}
        {renvoi === "ok" && <p className="text-xs text-success-dark">E-mail renvoyé.</p>}
        {renvoi === "erreur" && (
          <p className="text-xs text-danger">Le renvoi n'a pas abouti. Réessayez dans quelques minutes.</p>
        )}
      </div>

      <p className="text-sm text-ink-muted">
        Mauvaise adresse ?{" "}
        <button type="button" onClick={onModifier} className="font-semibold text-brand underline-offset-2 hover:underline">
          Modifier
        </button>
      </p>

      <div className="h-px w-full bg-border" />

      <p className="text-sm text-ink-muted">
        Déjà confirmé ?{" "}
        <button type="button" onClick={onSeConnecter} className="font-semibold text-brand underline-offset-2 hover:underline">
          Se connecter
        </button>
      </p>
    </div>
  );
}
