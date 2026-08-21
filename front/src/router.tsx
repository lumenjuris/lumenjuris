import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ContractAnalysis from "./page/ContractAnalysis";

import { MainLayout } from "./components/DashboardComponents/MainLayout";
import { Generateur } from "./components/DashboardComponents/Generateur";
import { Signature } from "./components/DashboardComponents/Signature";
import { ChatJuridique } from "./components/DashboardComponents/ChatJuridique";
import { Calculateur } from "./components/DashboardComponents/Calculateur";
import { Veille } from "./components/DashboardComponents/Veille";
import { Conformite } from "./components/DashboardComponents/Conformite";
import { Contratheque } from "./components/DashboardComponents/Contratheque";
import { ClausesLibrary } from "./components/DashboardComponents/clauses/ClausesLibrary";
import { UserManagement } from "./components/DashboardComponents/admin/UserManagement";
import { NegotiationWorkspace } from "./components/DashboardComponents/negotiation/NegotiationWorkspace";
import { NegotiationsList } from "./components/DashboardComponents/negotiation/NegotiationsList";
import { NegotiationGuest } from "./page/NegotiationGuest";
import { MesFiligranes } from "./components/DashboardComponents/MesFiligranes";
import { ComprendreContrat } from "./components/DashboardComponents/ComprendreContrat";

import { Dashboard } from "./page/Dashboard";
import { VerifyAccount } from "./page/VerifyAccount";
import { ResetPassword } from "./page/ResetPassword";
import { Inscription } from "./page/Inscription";
import { Sandbox } from "./page/Sandbox";
import { ParamCompte } from "./page/ParamCompte";
import { Monitoring } from "./page/Monitoring";
import { Subscription } from "./page/Subscription";
import { SubscriptionSuccess } from "./components/SubscriptionComponents/SubscriptionSuccess";
import { SubscriptionFailed } from "./components/SubscriptionComponents/SubscriptionFailed";
import { ConfirmDeleteAccountPage } from "./page/DeleteAccount";

import { ScrollToTop } from "./components/common/ScrollToTop";
import { RequireAuth } from "./components/auth/RequireAuth";
import { useUserStore } from "./store/userStore";
import { usePreferencesStore } from "./store/preferencesStore";
import { SignerPage } from "./page/SignerPage";

import { ClusterUserPage } from "./page/ClusterEnterprise";
import { usePageLoaded } from "./hooks/usePageLoaded";
import { Loader } from "./components/common/Loader";
import { PublicLayout } from "./components/DashboardComponents/PublicLayout";

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


  if (showLoaderPage) return <Loader label="Chargement de l'application en cours ..." />


  //Point d'entrée de l'application dynamique selon l'auth de l'user depuis le authStatus
  const HomeRedirect = () => {
    return authStatus === "authenticated" ? (
      <Navigate to="/dashboard" replace />
    ) : (
      <Navigate to="/inscription" replace />
    );
  };

  return (
    <>
      <ScrollToTop />

      <Routes>
        <Route element={<RequireAuth> <MainLayout />  </RequireAuth>}>
          {/* Entrée principale de l'application sur le dashboard avec direction selon state de l'auth User*/}
          <Route path="/" element={<HomeRedirect />} />

          {/* Sous-ensemble (charge panneau latéral et header) */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/generateur" element={<Generateur />} />
          <Route path="/generateur/filigranes" element={<MesFiligranes />} />
          <Route path="/contrat-generation" element={<Generateur />} />

          <Route path="/contrat-statique" element={<Generateur />} />

          <Route path="/contrat-from-model" element={<Generateur />} />
          <Route path="/contrat-enhanced" element={<Generateur />} />
          <Route path="/signature" element={<Signature />} />
          <Route path="/contratheque" element={<Contratheque />} />
          <Route path="/contratheque/:externalId" element={<Contratheque />} />
          <Route path="/clauses" element={<ClausesLibrary />} />
          <Route path="/utilisateurs" element={<UserManagement />} />
          <Route path="/negociations" element={<NegotiationsList />} />
          <Route path="/negociation/:negotiationId" element={<NegotiationWorkspace />} />
          <Route path="/chatjuridique" element={<ChatJuridique />} />
          <Route path="/calculateur" element={<Calculateur />} />
          <Route path="/veille" element={<Veille />} />
          <Route path="/conformite" element={<Conformite />} />
          <Route path="/comprendre-contrat" element={<ComprendreContrat />} />
          <Route path="/mon-compte" element={<ParamCompte />} />
          <Route path="/analyzer" element={<ContractAnalysis />} />
          {/* Pages de retour Stripe Checkout (URLs configurées côté backend) */}
        <Route path="/subscription/success" element={<SubscriptionSuccess />} />
        <Route path="/subscription/failed" element={<SubscriptionFailed />} />


          {/* Page de gestion d'un cluster pour les multi user
          <Route path="/cluster" element={<ClusterUserPage />} /> EN COURS DE DEV
          */}

          <Route path="/monitoring" element={<Monitoring />} />
        </Route>

        <Route
          path="/sandbox" element={<RequireAuth>{" "}<Sandbox />{" "}</RequireAuth>} />
        <Route path="/inscription" element={<Inscription />} />


        <Route path="/monitoring" element={<RequireAuth>{" "} <Monitoring />{" "} </RequireAuth>} />

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


    </>
  );
}
