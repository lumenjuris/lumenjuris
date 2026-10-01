import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { Routes, Route } from "react-router-dom";

import { MainLayout } from "./components/MainLayout";
import { isFeatureEnabled } from "./config/features";
//import { Veille } from "./components/DashboardComponents/Veille";
//import { MesFiligranes } from "./components/DashboardComponents/MesFiligranes";

import { Dashboard } from "./page/Dashboard";

import { ScrollToTop } from "./components/common/ScrollToTop";
import { RequireAuth } from "./components/auth/RequireAuth";
import { useRetourConnexionExterne } from "./components/auth/useRetourConnexionExterne";
import { useUserStore } from "./store/userStore";
import { usePreferencesStore } from "./store/preferencesStore";

import { usePageLoaded } from "./hooks/usePageLoaded";
import { Loader } from "./components/common/Loader";
import { PublicLayout } from "./components/DashboardComponents/PublicLayout";

// Chaque écran (sauf l'accueil) est téléchargé seulement quand on l'ouvre : tous
// réunis dans un seul fichier, ils pesaient près de 5 Mo à charger avant le moindre
// affichage. L'attente éventuelle s'affiche dans le cadre de la page (MainLayout)
// ou en plein écran (Suspense ci-dessous) pour les pages sans menu.
const CLE_RECHARGEMENT = "lj-rechargement-ecran";
function lazyPage(load: () => Promise<{ default: ComponentType<any> }>) {
  return lazy(() =>
    load().then(
      (module) => {
        try { sessionStorage.removeItem(CLE_RECHARGEMENT); } catch { /* stockage indisponible */ }
        return module;
      },
      (error) => {
        // Après une mise en ligne, les fichiers de l'ancienne version n'existent plus :
        // un onglet resté ouvert ne trouve pas l'écran demandé. On recharge la page
        // une seule fois pour récupérer la nouvelle version.
        let dejaRecharge = true;
        try {
          dejaRecharge = sessionStorage.getItem(CLE_RECHARGEMENT) === "1";
          if (!dejaRecharge) sessionStorage.setItem(CLE_RECHARGEMENT, "1");
        } catch { /* stockage indisponible : pas de rechargement automatique */ }
        if (dejaRecharge) throw error;
        window.location.reload();
        return new Promise<never>(() => {});
      },
    ),
  );
}
const ContractAnalysis = lazyPage(() => import("./page/ContractAnalysis"));
const Generateur = lazyPage(() => import("./components/DashboardComponents/Generateur").then((m) => ({ default: m.Generateur })));
const Signature = lazyPage(() => import("./components/DashboardComponents/Signature").then((m) => ({ default: m.Signature })));
const ChatJuridique = lazyPage(() => import("./components/DashboardComponents/ChatJuridique").then((m) => ({ default: m.ChatJuridique })));
const Calculateur = lazyPage(() => import("./components/DashboardComponents/Calculateur").then((m) => ({ default: m.Calculateur })));
const Conformite = lazyPage(() => import("./components/DashboardComponents/Conformite").then((m) => ({ default: m.Conformite })));
const Contratheque = lazyPage(() => import("./page/Contratheque").then((m) => ({ default: m.Contratheque })));
const ClausesLibrary = lazyPage(() => import("./components/DashboardComponents/clauses/ClausesLibrary").then((m) => ({ default: m.ClausesLibrary })));
const PlaybookRules = lazyPage(() => import("./components/DashboardComponents/playbook/PlaybookRules").then((m) => ({ default: m.PlaybookRules })));
const PlaybookAnalysis = lazyPage(() => import("./page/PlaybookAnalysis").then((m) => ({ default: m.PlaybookAnalysis })));
const UserManagement = lazyPage(() => import("./components/DashboardComponents/admin/UserManagement").then((m) => ({ default: m.UserManagement })));
const NegotiationWorkspace = lazyPage(() => import("./components/DashboardComponents/negotiation/NegotiationWorkspace").then((m) => ({ default: m.NegotiationWorkspace })));
const NegotiationsList = lazyPage(() => import("./components/DashboardComponents/negotiation/NegotiationsList").then((m) => ({ default: m.NegotiationsList })));
const NegotiationGuest = lazyPage(() => import("./page/NegotiationGuest").then((m) => ({ default: m.NegotiationGuest })));
const ComprendreContrat = lazyPage(() => import("./components/DashboardComponents/ComprendreContrat").then((m) => ({ default: m.ComprendreContrat })));
const VerifyAccount = lazyPage(() => import("./page/VerifyAccount").then((m) => ({ default: m.VerifyAccount })));
const ResetPassword = lazyPage(() => import("./page/ResetPassword").then((m) => ({ default: m.ResetPassword })));
const Sandbox = lazyPage(() => import("./page/Sandbox").then((m) => ({ default: m.Sandbox })));
const ParamCompte = lazyPage(() => import("./page/ParamCompte").then((m) => ({ default: m.ParamCompte })));
const Monitoring = lazyPage(() => import("./page/Monitoring").then((m) => ({ default: m.Monitoring })));
const Subscription = lazyPage(() => import("./page/Subscription").then((m) => ({ default: m.Subscription })));
const SubscriptionSuccess = lazyPage(() => import("./components/SubscriptionComponents/SubscriptionSuccess").then((m) => ({ default: m.SubscriptionSuccess })));
const SubscriptionFailed = lazyPage(() => import("./components/SubscriptionComponents/SubscriptionFailed").then((m) => ({ default: m.SubscriptionFailed })));
const ConfirmDeleteAccountPage = lazyPage(() => import("./page/DeleteAccount").then((m) => ({ default: m.ConfirmDeleteAccountPage })));
const SignerPage = lazyPage(() => import("./page/SignerPage").then((m) => ({ default: m.SignerPage })));



export function App() {
  //Hook pour détecter le chargement complet de la page
  const pageReady = usePageLoaded();
  const [showLoaderPage, setShowLoaderPage] = useState(true);

  const authStatus = useUserStore((state) => state.authStatus);
  const fetchUser = useUserStore((state) => state.fetchUser);
  const isDyslexicMode = usePreferencesStore((state) => state.isDyslexicMode);
  const loadPreferences = usePreferencesStore((state) => state.loadPreferences);
  const resetPreferences = usePreferencesStore((state) => state.reset);

  useEffect(() => {
    if (authStatus === "idle") {
      void fetchUser();
    }
  }, [authStatus, fetchUser]);

  // Retour de Google : on reprend la page que l'utilisateur voulait ouvrir.
  useRetourConnexionExterne();

  useEffect(() => {
    if (authStatus === "authenticated") {
      void loadPreferences();
    } else if (authStatus === "unauthenticated") {
      resetPreferences();
    }
  }, [authStatus, loadPreferences, resetPreferences]);

  useEffect(() => {
    document.body.classList.toggle("dyslexic-font", isDyslexicMode);
  }, [isDyslexicMode]);


  useEffect(() => {
    if (pageReady) setTimeout(() => setShowLoaderPage(false), 400)
  }, [pageReady]);


  if (showLoaderPage) return <Loader />


  // L'accueil n'est plus une redirection selon l'authentification : `/` rend
  // directement le tableau de bord, qui s'adapte lui-même au visiteur.
  return (
    <>
      <ScrollToTop />

      <Suspense fallback={<Loader />}>
      <Routes>
        {/* ------------------------------------------------------------------
            Pages ouvertes à tous, avec le menu latéral et l'en-tête.
            L'accueil est visible sans compte : c'est la vitrine de l'outil,
            la connexion est demandée au moment d'utiliser une fonctionnalité.
           ------------------------------------------------------------------ */}
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        {/* ------------------------------------------------------------------
            Pages qui n'ont aucun sens sans compte : elles n'affichent que des
            données personnelles. Elles gardent le menu latéral et l'en-tête.
           ------------------------------------------------------------------ */}
        <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
          <Route path="/generateur" element={<Generateur />} />

          {/* En attente d'implémentation, décommenter le lien dans MainLayout pour réimplémenter */}
          {/* <Route path="/generateur/filigranes" element={<MesFiligranes />} /> */}
          <Route path="/contrat-generation" element={<Generateur />} />

          <Route path="/contrat-statique" element={<Generateur />} />

          <Route path="/contrat-from-model" element={<Generateur />} />
          <Route path="/contrat-enhanced" element={<Generateur />} />
          <Route path="/signature" element={<Signature />} />
          <Route path="/contratheque" element={<Contratheque />} />
          <Route path="/contratheque/:externalId" element={<Contratheque />} />
          <Route path="/clauses" element={<ClausesLibrary />} />
          {isFeatureEnabled("ENABLE_PLAYBOOK") && <Route path="/playbook" element={<PlaybookRules />} />}
          {isFeatureEnabled("ENABLE_PLAYBOOK") && <Route path="/analyse-playbook" element={<PlaybookAnalysis />} />}
          <Route path="/utilisateurs" element={<UserManagement />} />
          <Route path="/negociations" element={<NegotiationsList />} />
          <Route path="/negociation/:negotiationId" element={<NegotiationWorkspace />} />
          <Route path="/chatjuridique" element={<ChatJuridique />} />
          <Route path="/calculateur" element={<Calculateur />} />
          {/* désactiver en attente d'amélioration de cet outil
            <Route path="/veille" element={<Veille />} />
             */}
          <Route path="/conformite" element={<Conformite />} />
          <Route path="/comprendre-contrat" element={<ComprendreContrat />} />
          <Route path="/mon-compte" element={<ParamCompte />} />
          <Route path="/analyzer" element={<ContractAnalysis />} />
          <Route path="/monitoring" element={<Monitoring />} />
        </Route>


        {/* Pages de retour Stripe Checkout (URLs configurées côté backend) */}
        <Route path="/subscription/success" element={<SubscriptionSuccess />} />
        <Route path="/subscription/failed" element={<SubscriptionFailed />} />


        {/* Page de gestion d'un cluster pour les multi user
          <Route path="/cluster" element={<ClusterUserPage />} /> EN COURS DE DEV
          */}



        <Route path="/sandbox" element={<RequireAuth>{" "}<Sandbox />{" "}</RequireAuth>} />


        <Route path="/verify-account" element={<VerifyAccount />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<PublicLayout />}>
          <Route path="/user/deleteaccount/:token" element={<ConfirmDeleteAccountPage />} />
        </Route>

        {/* Page publique de signature pour le cocontractant — sans auth */}
        <Route path="/signer/:token" element={<SignerPage />} />

        {/* Route pour les formulaire et l'achat d'un plan */}
        <Route path="/souscription" element={<Subscription />} />

        {/* Page publique de négociation pour un invité externe — sans auth */}
        <Route path="/negociation-invite/:token" element={<NegotiationGuest />} />
      </Routes>
      </Suspense>


    </>
  );
}
