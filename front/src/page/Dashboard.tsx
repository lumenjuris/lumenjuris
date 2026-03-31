
import { Link } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard, FileText, PenTool, ShieldCheck, MessageSquare,
  Calculator, Newspaper, Settings, Lock, Scale, Bell, Search,
  PanelLeft, Upload, Briefcase, ClipboardList, BookOpen, Tag,
  ArrowRight, CalendarClock, AlertTriangle, Clock, FileCheck, ChevronDown,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Tableau de bord", path: "/dashboard", active: true },
  { icon: FileText, label: "Générateur de modèles", path: "/generateur" },
  { icon: PenTool, label: "Signature", path: "/signature" },
  { icon: ShieldCheck, label: "Analyse de conformité", path: "/analyzer" },
  { icon: MessageSquare, label: "Chat juridique RH", path: "/chat" },
  { icon: Calculator, label: "Calculateur juridique", path: "/calculateur" },
  { icon: Newspaper, label: "Veille information", path: "/veille" },
  { icon: Settings, label: "Paramètres", path: "/parametres" },
];

const kpiCards = [
  { icon: FileText,     iconBg: "bg-blue-50 text-blue-600",   value: "48", label: "Nombre de contrats",    sub: "Total actifs",                     badge: null },
  { icon: FileCheck,    iconBg: "bg-green-50 text-green-600", value: "32", label: "Contrats signés",        sub: null,                               badge: "+5 ce mois" },
  { icon: Clock,        iconBg: "bg-yellow-50 text-yellow-600", value: "12", label: "Contrats en cours",   sub: "En attente de signature",          badge: null },
  { icon: CalendarClock,iconBg: "bg-blue-50 text-blue-600",   value: "4",  label: "Arrivées bientôt",      sub: "Dans les 30 prochains jours",      badge: null },
  { icon: ShieldCheck,  iconBg: "bg-blue-50 text-blue-600",   value: "5",  label: "Procédures en cours",   sub: "2 échéances cette semaine",        badge: null },
  { icon: AlertTriangle,iconBg: "bg-red-50 text-red-500",     value: "3",  label: "Alertes juridiques",    sub: "2 prioritaires",                   badge: null },
];

const veilleItems = [
  { tag: "Temps de travail", tagClass: "bg-green-100 text-green-700",  title: "Nouvelle obligation d'information des salariés en CDD",         date: "28 fév. 2026" },
  { tag: "Rupture",          tagClass: "bg-yellow-100 text-yellow-700", title: "Réforme des indemnités prud'homales : barème actualisé",        date: "25 fév. 2026" },
  { tag: "Discipline",       tagClass: "bg-red-100 text-red-600",       title: "Procédure disciplinaire : nouveaux délais de prescription",     date: "22 fév. 2026" },
];

const docTypes = [
  { icon: Briefcase,    label: "CDI",                 sub: "Contrat durée indéterminée" },
  { icon: ClipboardList,label: "CDD",                 sub: "Contrat durée déterminée" },
  { icon: FileText,     label: "Avenant",             sub: "Modification contractuelle" },
  { icon: BookOpen,     label: "Lettre disciplinaire",sub: "Procédure disciplinaire" },
];

export function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen w-full bg-[#f8f9fb]" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>

      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-64 bg-[#1a1d23] z-20">
          <div className="p-4 pb-2">
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
                <Scale className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white tracking-tight">LumenJuris</span>
                <span className="text-[10px] text-gray-400 leading-none">Conformité RH</span>
              </div>
            </Link>
          </div>

          <nav className="flex-1 overflow-auto pt-4 px-2">
            <ul className="flex flex-col gap-1">
              {navItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                      item.active
                        ? "bg-white/10 text-white font-medium"
                        : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="p-4">
            <div className="flex items-center justify-center gap-1.5 py-2">
              <Lock className="h-3 w-3 text-gray-500" />
              <span className="text-[10px] text-gray-500">Données sécurisées – Hébergement UE</span>
            </div>
          </div>
        </aside>
      )}

      {/* ── Main ── */}
      <div className={`flex-1 flex flex-col min-w-0 ${sidebarOpen ? "md:ml-64" : ""}`}>

        {/* Header */}
        <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 w-72">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un document, une clause..."
                className="bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none w-full"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell className="h-5 w-5 text-gray-400" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-green-500" />
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
              <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
                ML
              </div>
              <div className="hidden md:flex items-center gap-1 cursor-pointer">
                <span className="text-sm font-medium text-gray-800">Marie L.</span>
                <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="space-y-6 max-w-7xl">

            {/* Title */}
            <div className="flex items-end justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tableau de bord</h1>
                <p className="text-sm text-gray-500 mt-1">Vue d'ensemble de votre conformité RH</p>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs text-gray-500">
                <Lock className="h-3 w-3" />
                <span>Conforme au Code du travail français</span>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {kpiCards.map((card, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.iconBg}`}>
                      <card.icon className="h-5 w-5" />
                    </div>
                    {card.badge && (
                      <span className="text-xs font-medium text-green-600">{card.badge}</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-gray-900 tracking-tight">{card.value}</div>
                    <div className="text-sm text-gray-500">{card.label}</div>
                    {card.sub && <div className="text-xs text-gray-400">{card.sub}</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Middle grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Analyse rapide */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Analyse rapide</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Vérifiez la conformité de vos documents</p>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-gray-300" />
                </div>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center text-center mb-4 hover:border-blue-300 hover:bg-blue-50/30 transition-colors cursor-pointer">
                  <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-700">Glissez-déposez votre document ici</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, DOCX – Contrats, avenants, procédures</p>
                </div>
                <Link to="/analyzer" className="inline-flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-500 transition-colors">
                  Analyser un document <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Générateur intelligent */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Générateur intelligent</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Créez des documents juridiques conformes</p>
                  </div>
                  <FileText className="h-5 w-5 text-gray-300" />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {docTypes.map((item) => (
                    <button
                      key={item.label}
                      className="flex flex-col items-start gap-1 p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50/30 transition-all text-left group"
                    >
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 text-gray-400 group-hover:text-green-600 transition-colors" />
                        <span className="text-sm font-medium text-gray-800">{item.label}</span>
                      </div>
                      <span className="text-[11px] text-gray-400 leading-tight">{item.sub}</span>
                    </button>
                  ))}
                </div>
                <Link to="/generateur" className="inline-flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-500 transition-colors">
                  Créer un document <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Chat juridique RH */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Chat juridique RH</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Réponses avec sources juridiques</p>
                  </div>
                  <MessageSquare className="h-5 w-5 text-gray-300" />
                </div>
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                      <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-800">"Quelles sont les obligations lors d'un licenciement pour faute grave ?"</p>
                      <p className="text-xs text-gray-400 mt-1.5">Sources : Art. L1232-1, L1234-1 du Code du travail</p>
                    </div>
                  </div>
                </div>
                <Link to="/chat" className="inline-flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-500 transition-colors">
                  Poser une question <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Calculateur juridique */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Calculateur juridique</h2>
                    <p className="text-sm text-gray-400 mt-0.5">Estimations légales instantanées</p>
                  </div>
                  <Calculator className="h-5 w-5 text-gray-300" />
                </div>
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Indemnité de licenciement</p>
                  <div className="space-y-2.5">
                    {[
                      { label: "Ancienneté",          value: "8 ans" },
                      { label: "Salaire brut mensuel", value: "3 200 €" },
                      { label: "Motif",                value: "Personnel" },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between items-center">
                        <span className="text-xs text-gray-400">{row.label}</span>
                        <span className="text-sm font-medium text-gray-800 bg-white px-2.5 py-1 rounded-md border border-gray-200">{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-400">Estimation</span>
                    <span className="text-lg font-bold text-green-600">6 400 €</span>
                  </div>
                </div>
                <Link to="/calculateur" className="inline-flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-500 transition-colors">
                  Calculer une indemnité <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Veille personnalisée */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Veille personnalisée</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Actualités juridiques impactant votre entreprise</p>
                </div>
                <Newspaper className="h-5 w-5 text-gray-300" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {veilleItems.map((item, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-lg border border-gray-200 hover:border-green-300 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-3 w-3 text-gray-400" />
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.tagClass}`}>{item.tag}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 leading-snug group-hover:text-green-600 transition-colors">{item.title}</p>
                    <p className="text-xs text-gray-400 mt-2">{item.date}</p>
                  </div>
                ))}
              </div>
              <Link to="/veille" className="inline-flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-500 transition-colors">
                Voir toutes les actualités <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
