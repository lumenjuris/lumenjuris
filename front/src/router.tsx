import { Routes, Route, Navigate } from "react-router-dom";
import ContractAnalysis from "./page/ContractAnalysis";

import { MainLayout } from "./components/DashboardComponents/MainLayout";
import { Generateur } from "./components/DashboardComponents/Generateur";
import { Signature } from "./components/DashboardComponents/Signature";
import { ChatJuridique } from "./components/DashboardComponents/ChatJuridique";
import { Calculateur } from "./components/DashboardComponents/Calculateur";
import { Veille } from "./components/DashboardComponents/Veille";
import { Conformite } from "./components/DashboardComponents/Conformite";

import { Dashboard } from "./page/Dashboard";
import { VerifyAccount } from "./page/VerifyAccount";
import { ResetPassword } from "./page/ResetPassword";
import { Inscription } from "./page/Inscription";
import { Sandbox } from "./page/Sandbox";
import { ParamCompte } from "./page/ParamCompte";
import { Monitoring } from "./page/Monitoring";
import { Subscription } from "./page/Subscription";

import { ScrollToTop } from "./components/common/ScrollToTop";

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<MainLayout />}>
          {" "}
          {/* Sous-ensemble (charge panneau latéral et header) */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/generateur" element={<Generateur />} />
          <Route path="/signature" element={<Signature />} />
          <Route path="/chatjuridique" element={<ChatJuridique />} />
          <Route path="/calculateur" element={<Calculateur />} />
          <Route path="/veille" element={<Veille />} />
          <Route path="/conformite" element={<Conformite />} />
        </Route>

        <Route path="/analyzer" element={<ContractAnalysis />} />
        <Route path="/sandbox" element={<Sandbox />} />
        <Route path="/inscription" element={<Inscription />} />
        <Route path="/mon-compte" element={<ParamCompte />} />
        <Route path="/monitoring" element={<Monitoring />} />
        <Route path="/verify-account" element={<VerifyAccount />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/souscription" element={<Subscription />} />
      </Routes>
    </>
  );
}
