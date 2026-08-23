import { useState } from "react";
import { BarChart2, MessageSquare, Users, TrendingUp, Activity, LayoutDashboard, Landmark, Library } from "lucide-react";
import { useUserStore } from "../store/userStore";
import { Navigate } from "react-router-dom";
import { LlmUsageSection } from "../components/MonitoringComponents/LlmUsageSection";
import { FeedbackSection } from "../components/MonitoringComponents/FeedbackSection";
import { UserManagement } from "../components/DashboardComponents/admin/UserManagement";
import { RevenueSection } from "../components/MonitoringComponents/RevenueSection";
import { ActivitySection } from "../components/MonitoringComponents/ActivitySection";
import { OverviewSection } from "../components/MonitoringComponents/OverviewSection";
import { LegalWatchSection } from "../components/MonitoringComponents/LegalWatchSection";
import { FiscaliteSection } from "../components/MonitoringComponents/FiscaliteSection";
import { Logger } from "../components/MonitoringComponents/Logger";

type Tab = "overview" | "llm" | "feedbacks" | "users" | "revenue" | "activity" | "legalWatch" | "fiscalite" | "logger";


const TABS: { id: Tab; label: string; icon: React.ElementType; description: string }[] = [
  { id: "overview", label: "Vue d'ensemble", icon: LayoutDashboard, description: "KPIs, alertes et crédits" },
  { id: "llm", label: "LLM Usage", icon: BarChart2, description: "Consommation et coûts des modèles IA" },
  { id: "feedbacks", label: "Feedbacks", icon: MessageSquare, description: "Retours des utilisateurs" },
  { id: "users", label: "Utilisateurs", icon: Users, description: "Gestion des comptes et rôles" },
  { id: "revenue", label: "Revenus", icon: TrendingUp, description: "Abonnements et paiements" },
  { id: "activity", label: "Activité", icon: Activity, description: "Usage des fonctionnalités IA" },
  { id: "legalWatch", label: "Actualité juridique", icon: Library , description: "Ajout de conventions collectives"},
  { id: "fiscalite", label: "Fiscalité", icon: Landmark, description: "TVA et factures par mois" },
  {id: "logger", label: "Logger", icon: MessageSquare, description: "Logs des utilisateurs"}
];

const SECTION_TITLES: Record<Tab, { title: string; sub: string }> = {
  overview: { title: "Vue d'ensemble", sub: "KPIs clés, alertes coût, top LLM users et suivi des crédits" },
  llm: { title: "LLM Usage", sub: "Consommation globale des modèles IA" },
  feedbacks: { title: "Feedbacks utilisateurs", sub: "Tous les retours envoyés via le widget" },
  users: { title: "Gestion des utilisateurs", sub: "Rôles et droits d'accès" },
  revenue: { title: "Revenus", sub: "Abonnements actifs, paiements et chiffre d'affaires" },
  activity: { title: "Activité des fonctionnalités", sub: "Usage de chaque fonctionnalité IA par période" },
  legalWatch: { title: "Actualité juridique", sub: "Ajout de conventions collectives"},
  fiscalite: { title: "Fiscalité", sub: "Récapitulatif TVA mensuel et export des factures" },
  logger: {title: "Logger", sub: "Logs des utilisateurs"}
};

export const Monitoring = () => {
  const { userData } = useUserStore();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  if (userData?.profile.role !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  const current = SECTION_TITLES[activeTab];

  return (
    <>

      <div className="min-h-[calc(100vh-64px)] bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

          {/* En-tête de page */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Monitoring</h1>
            <p className="mt-1 text-sm text-gray-500">Tableau de bord administrateur</p>
          </div>

          {/* Nav mobile */}
          <div className="sm:hidden w-full">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as Tab)}
              className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm font-medium text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {TABS.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Nav ordi & tablette */}
          <nav className="hidden sm:flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  activeTab === id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* Titre de section */}
          <div className="border-b border-gray-200 pb-4">
            <h2 className="text-lg font-semibold text-gray-900">{current.title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{current.sub}</p>
          </div>

          {/* Contenu de la section active */}
          <div>
            {activeTab === "overview" && <OverviewSection />}
            {activeTab === "llm" && <LlmUsageSection />}
            {activeTab === "feedbacks" && <FeedbackSection />}
            {activeTab === "users" && <UserManagement />}
            {activeTab === "revenue" && <RevenueSection />}
            {activeTab === "activity" && <ActivitySection />}
            {activeTab === "legalWatch" && <LegalWatchSection />}
            {activeTab === "fiscalite" && <FiscaliteSection />}
            {activeTab === "logger" &&< Logger />}
          </div>

        </div>
      </div>
    </>
  );
};
