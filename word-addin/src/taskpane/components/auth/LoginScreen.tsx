import * as React from "react";
import { login, loginWithProvider } from "../../core/lumenService";
import StatusMessage, { Status } from "../common/StatusMessage";
import { FcGoogle } from "react-icons/fc"


/* global window */

interface Props {
  /** Message affiché à l'arrivée (ex. session expirée). */
  notice?: Status | null;
  onSignedIn: () => void;
}

const SIGNUP_URL = "https://app.lumenjuris.com/";
const CONTACT_URL = "https://www.lumenjuris.com/contactez-nous/";


const MicrosoftLogo = () => (
  <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
)


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

  const handleProvider = async (provider: "google" | "microsoft") => {
    setSubmitting(true);
    setStatus(null);
    try {
      await loginWithProvider(provider);
      onSignedIn();
    } catch (error) {
      setStatus({ kind: "err", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogGoogle = () => handleProvider("google");

  const handleLogMicrosoft = () => handleProvider("microsoft");

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
    <main className="lj-content lj-auth">
      {/* ---- En-tête de marque ---- */}
      <div className="lj-auth-hero">
        <img src="assets/icon-64.png" alt="" />
        <h2>Lumen Juris</h2>
        <p>L'assistant juridique IA dans Word</p>
      </div>

      {/* ---- Connexion ---- */}
      <div className="lj-auth-card">
        <h3>Connectez-vous pour commencer</h3>
        <p className="lj-muted" style={{ margin: 0 }}>
          Utilisez votre compte Lumen Juris. Pas encore de compte ? L'offre Free permet de démarrer
          gratuitement, sans engagement.
        </p>

        <div className="lj-sso">
          <button type="button" className="lj-sso-btn" disabled={submitting} onClick={handleLogGoogle}>
            <FcGoogle />
            Continuer avec Google
          </button>
          <button type="button" className="lj-sso-btn" disabled={submitting} onClick={handleLogMicrosoft}>
            <MicrosoftLogo />
            Continuer avec Microsoft
          </button>
        </div>

        <div className="lj-divider">ou</div>

        <form onSubmit={handleSubmit}>
          <label className="lj-label" htmlFor="lj-login-email">E-mail</label>
          <input
            id="lj-login-email"
            className="lj-input"
            type="email"
            autoComplete="username"
            placeholder="vous@cabinet.fr"
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
          <button className="lj-btn-brand" type="submit" disabled={submitting}>
            {submitting ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <StatusMessage status={status} />

        <p className="lj-auth-links">
          <a href={SIGNUP_URL} target="_blank" rel="noreferrer">Créer un compte gratuit</a>
          {" · "}
          <a href={CONTACT_URL} target="_blank" rel="noreferrer">Nous contacter</a>
        </p>
      </div>

      {/* ---- Proposition de valeur (exigence Microsoft 1100.1.5) ---- */}
      <div className="lj-auth-card">
        <h3>Analysez vos contrats sans quitter Word</h3>
        <p className="lj-muted" style={{ margin: "0 0 10px" }}>
          Les clauses à risque sont détectées, surlignées dans le document et expliquées, avec des
          reformulations prêtes à insérer en suivi des modifications.
        </p>
        <ul className="lj-auth-features">
          <li>Détection des clauses sensibles (responsabilité, résiliation, pénalités, RGPD…)</li>
          <li>Recommandations sourcées, adossées à Légifrance et à la jurisprudence française</li>
          <li>Questions libres à l'IA sur chaque clause</li>
        </ul>
        <p className="lj-muted" style={{ margin: "10px 0 0", fontSize: 11.5 }}>
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
