import { Routes, Route, Navigate } from "react-router-dom";
import ContractAnalysis from "./page/ContractAnalysis";

import { Dashboard } from "./page/Dashboard";
import { MainLayout } from "./components/MainLayout";
import { Generateur } from "./page/Generateur";
import { Signature } from "./page/Signature";
import { ChatJuridique } from "./page/ChatJuridique";
import { Calculateur } from "./page/Calculateur";
import { Veille } from "./page/Veille";

import { Inscription } from "./page/Inscription";
import { Sandbox } from "./page/Sandbox";
import { ParamCompte } from "./page/ParamCompte";

export function App() {
  return (
    <Routes> 
      <Route element={<MainLayout />}> {/* Sous-ensemble (charge panneau latéral et header) */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/generateur" element={<Generateur />} />
        <Route path="/signature" element={<Signature />} />
        <Route path="/chatjuridique" element={<ChatJuridique />} />
        <Route path="/calculateur" element={<Calculateur />} />
        <Route path="/veille" element={<Veille />} />
      </Route>

      <Route path="/analyzer" element={<ContractAnalysis />} />
      <Route path="/sandbox" element={<Sandbox />} />
      <Route path="/inscription" element={<Inscription />} />
      <Route path="/mon-compte" element={<ParamCompte />} />
    </Routes>
  );
}