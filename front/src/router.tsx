import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ContractAnalysis from "./page/ContractAnalysis";

import { MainLayout } from "./components/DashboardComponents/MainLayout";
import { Generateur } from "./components/DashboardComponents/Generateur";
import { Signature } from "./components/DashboardComponents/Signature";
import { ChatJuridique } from "./components/DashboardComponents/ChatJuridique";
import { Calculateur } from "./components/DashboardComponents/Calculateur";
import { Veille } from "./components/DashboardComponents/Veille";
import { Conformite } from "./components/DashboardComponents/Conformite";
import { MesFiligranes } from "./components/DashboardComponents/MesFiligranes";

import { Dashboard } from "./page/Dashboard";
import { VerifyAccount } from "./page/VerifyAccount";
import { ResetPassword } from "./page/ResetPassword";
import { Inscription } from "./page/Inscription";
import { Sandbox } from "./page/Sandbox";
import { ParamCompte } from "./page/ParamCompte";
import { Monitoring } from "./page/Monitoring";
import { Subscription } from "./page/Subscription";

import { ScrollToTop } from "./components/common/ScrollToTop";
import { RequireAuth } from "./components/auth/RequireAuth";
import { useUserStore } from "./store/userStore";
import { usePreferencesStore } from "./store/preferencesStore";
import { GenerationContract } from "./page/GenerationContract";

export function App() {
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

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          {" "}
          {/* Sous-ensemble (charge panneau latéral et header) */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/generateur" element={<Generateur />} />
          <Route path="/generateur/filigranes" element={<MesFiligranes />} />
          <Route path="/signature" element={<Signature />} />
          <Route path="/chatjuridique" element={<ChatJuridique />} />
          <Route path="/calculateur" element={<Calculateur />} />
          <Route path="/veille" element={<Veille />} />
          <Route path="/conformite" element={<Conformite />} />
        </Route>

        {/* Entrée principale de l'application sur le dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/contrat-generation" element={<RequireAuth> <GenerationContract /> </RequireAuth>} />

        <Route path="/analyzer" element={<RequireAuth> <ContractAnalysis /> </RequireAuth>} />

        <Route path="/sandbox" element={<RequireAuth> <Sandbox /> </RequireAuth>} />

        <Route path="/inscription" element={<Inscription />} />

        <Route path="/mon-compte" element={ <RequireAuth> <ParamCompte /> </RequireAuth>}/>
        
        <Route path="/monitoring" element={ <RequireAuth>  <Monitoring /> </RequireAuth>} />
        <Route path="/verify-account" element={<VerifyAccount />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/souscription" element={<Subscription />} />
      </Routes>
    </>
  );
}

