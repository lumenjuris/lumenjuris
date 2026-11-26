import * as React from "react";
import LoginScreen from "./auth/LoginScreen";
import { Menus, Page } from "./menu/Menus";
import Analyzer from "./analyzer/Analyzer";
import ContractGeneration from "./contractGeneration/ContractGeneration";
import { Status } from "./common/StatusMessage";
import { clearToken, getToken } from "../core/lumenService";

/**
 * Racine du volet : connexion obligatoire, puis menu + vue choisie
 * (`currentPage`). Chaque fonctionnalité gère son propre état.
 */
const App: React.FC = () => {
  const [authed, setAuthed] = React.useState<boolean>(() => Boolean(getToken()));
  const [loginNotice, setLoginNotice] = React.useState<Status | null>(null);
  const [currentPage, setCurrentPage] = React.useState<Page>("");

  /** Session invalide ou déconnexion volontaire : retour à l'écran de connexion. */
  const signOut = (notice: Status | null) => {
    clearToken();
    setLoginNotice(notice);
    setAuthed(false);
    setCurrentPage("");
  };

  /* ---------- Connexion obligatoire (première exécution) ---------- */
  if (!authed) {
    return (
      <LoginScreen
        notice={loginNotice}
        onSignedIn={() => {
          setLoginNotice(null);
          setAuthed(true);
        }}
      />
    );
  }

  /* ---------- Menu + vue courante ---------- */
  return (
    <main className="lj-content">
      <header className="lj-topbar">
        <button type="button" className="lj-logout lj-topbar-brand" onClick={() => setCurrentPage("")} title="Accueil">
          <img src="assets/icon-64.png" alt="" />
          Lumen Juris
        </button>
        <button type="button" className="lj-logout" onClick={() => signOut(null)}>
          Se déconnecter
        </button>
      </header>

      <Menus currentPage={currentPage} setCurrentPage={setCurrentPage} />

      {currentPage === "analyzer" && <Analyzer onSessionExpired={signOut} />}
      {currentPage === "generateurContract" && <ContractGeneration onSessionExpired={signOut} />}
    </main>
  );
};

export default App;
