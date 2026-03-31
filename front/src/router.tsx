import { Routes, Route } from "react-router-dom";
import ContractAnalysis from "./page/ContractAnalysis"
import { Dashboard } from "./page/Dashboard";
import { Inscription } from "./page/Inscription";
import { Sandbox } from "./page/Sandbox";
import { ParamCompte } from "./page/ParamCompte";



export function App() {
  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/sandbox" element={<Sandbox />} />
      <Route path="/analyzer" element={<ContractAnalysis />} />
      <Route path="/inscription" element={<Inscription />} />
      <Route path="/mon-compte" element={<ParamCompte />} />
    </Routes>
  );
}