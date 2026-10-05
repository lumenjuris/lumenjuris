import * as React from "react";
import { login } from "../core/lumenService";
import StatusMessage, { Status } from "./StatusMessage";

/* global window */

interface Props {
  /** Message affiché à l'arrivée (ex. session expirée). */
  notice?: Status | null;
  onSignedIn: () => void;
}

const SIGNUP_URL = "https://app.lumenjuris.com/";
const CONTACT_URL = "https://www.lumenjuris.com/contactez-nous/";

/**
 * Écran de première exécution : présente la proposition de valeur du
 * complément (exigence Microsoft 1100.1.5) puis demande la connexion au
 * compte LumenJuris (exigence 100.12.1 — l'analyse nécessite un compte).
 */
const LoginScreen: React.FC<Props> = ({ notice, onSignedIn }) => {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [status, setStatus] = React.useState<Status | null>(notice ?? null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setStatus({ kind: "warn", text: "Saisissez votre e-mail et votre mot de passe." });
      return;
    }
    setSubmitting(true);
    setStatus(null);
    try {
      await login(email.trim(), password);
      onSignedIn();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus({
        kind: "err",
        text: /fetch/i.test(message)
          ? "Connexion au serveur impossible. Vérifiez votre connexion internet puis réessayez."
          : message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="lj-content">
      {/* ---- Proposition de valeur (première exécution) ---- */}
      <div className="lj-card" style={{ marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="assets/icon-64.png" alt="" width={36} height={36} style={{ borderRadius: 8 }} />
          <div>
            <h3 style={{ margin: 0 }}>Lumen Juris — Analyse de contrats</h3>
            <p className="lj-muted" style={{ margin: "2px 0 0" }}>L'assistant juridique IA dans Word</p>
          </div>
        </div>
        <p style={{ margin: "10px 0 4px", lineHeight: 1.5 }}>
          Analysez le contrat ouvert dans Word en quelques secondes : les clauses à risque sont
          détectées, surlignées dans le document et expliquées, avec des reformulations prêtes à
          insérer en suivi des modifications.
        </p>
        <ul className="lj-list lj-muted" style={{ marginTop: 6 }}>
          <li>Détection des clauses sensibles (responsabilité, résiliation, pénalités, RGPD…)</li>
          <li>Recommandations sourcées, adossées à Légifrance et à la jurisprudence française</li>
          <li>Questions libres à l'IA sur chaque clause, sans quitter Word</li>
        </ul>
      </div>

      {/* ---- Connexion ---- */}
      <div className="lj-card">
        <h3>Connectez-vous pour commencer</h3>
        <p className="lj-muted" style={{ margin: "0 0 8px" }}>
          Utilisez vos identifiants Lumen Juris. Pas encore de compte ? L'offre Free permet de
          démarrer gratuitement, sans engagement.
        </p>
        <form onSubmit={handleSubmit}>
          <label className="lj-label" htmlFor="lj-login-email">E-mail</label>
          <input
            id="lj-login-email"
            className="lj-input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
          <label className="lj-label" htmlFor="lj-login-password">Mot de passe</label>
          <input
            id="lj-login-password"
            className="lj-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
          <button className="lj-btn" type="submit" disabled={submitting} style={{ width: "100%", marginTop: 4 }}>
            {submitting ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <StatusMessage status={status} />
        <p className="lj-muted" style={{ margin: "10px 0 0" }}>
          <a href={SIGNUP_URL} target="_blank" rel="noreferrer">Créer un compte gratuit</a>
          {" · "}
          <a href={CONTACT_URL} target="_blank" rel="noreferrer">Nous contacter</a>
        </p>
        <p className="lj-muted" style={{ margin: "6px 0 0", fontSize: 11.5 }}>
          Entreprises : offres Starter, Pro et Enterprise (RBAC, SSO, intégrations) sur{" "}
          <a
            href="https://www.lumenjuris.com"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => {
              // Certains hôtes Office bloquent les liens : ouverture explicite.
              e.preventDefault();
              window.open("https://www.lumenjuris.com", "_blank");
            }}
          >
            lumenjuris.com
          </a>
          .
        </p>
      </div>
    </main>
  );
};

export default LoginScreen;
