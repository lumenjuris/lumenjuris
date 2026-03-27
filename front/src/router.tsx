import { Routes, Route } from "react-router-dom";
import ContractAnalysis from "./page/ContractAnalysis"
import { Dashboard } from "./page/Dashboard";
import { Inscription } from "./page/Inscription";
function Teste(){
    return (<div>Test</div>)
}


export function App() {
  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/teste" element={<Teste />} />
      <Route path="/analyzer" element={<ContractAnalysis />} />
      <Route path="/inscription" element={<Inscription />} />
    </Routes>
  );
}