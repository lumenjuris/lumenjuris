import { Routes, Route, Navigate } from "react-router-dom";
import ContractAnalysis from "./page/ContractAnalysis";

import { MainLayout } from "./components/dashboardComponents/MainLayout";
import { Generateur } from "./components/dashboardComponents/Generateur";
import { Signature } from "./components/dashboardComponents/Signature";
import { ChatJuridique } from "./components/dashboardComponents/ChatJuridique";
import { Calculateur } from "./components/dashboardComponents/Calculateur";
import { Veille } from "./components/dashboardComponents/Veille";
import { Conformite } from "./components/dashboardComponents/Conformite";

import { Dashboard } from "./page/Dashboard";
import { VerifyAccount } from "./page/VerifyAccount";
import { Inscription } from "./page/Inscription";
import { Sandbox } from "./page/Sandbox";
import { ParamCompte } from "./page/ParamCompte";

export function App() {
  return (
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
      <Route path="/verify-account" element={<VerifyAccount />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
