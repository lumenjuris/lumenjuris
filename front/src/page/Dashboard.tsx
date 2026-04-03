import InputFile from "../components/common/InputFile";
import { Link, useNavigate } from "react-router-dom";
import { useCallback } from "react";
import {
  FileText, ShieldCheck, MessageSquare,
  Calculator, Newspaper, Lock,
  Briefcase, ClipboardList, BookOpen, Tag,
  ArrowRight, CalendarClock, AlertTriangle, Clock, FileCheck,
} from "lucide-react";

const kpiCards = [
  { icon: FileText,     iconBg: "bg-slate-100 text-black-500", value: "48", label: "Nombre de contrats",    sub: "Total actifs",                     badge: null },
  { icon: FileCheck,    iconBg: "bg-green-50 text-green-600", value: "32", label: "Contrats signés",        sub: null,                               badge: "+5 ce mois" },
  { icon: Clock,        iconBg: "bg-yellow-50 text-yellow-600", value: "12", label: "Contrats en cours",   sub: "En attente de signature",          badge: null },
  { icon: CalendarClock,iconBg: "bg-slate-100 text-black-500", value: "4",  label: "Arrivées bientôt",      sub: "Dans les 30 prochains jours",      badge: null },
  { icon: ShieldCheck,  iconBg: "bg-slate-100 text-black-500", value: "5",  label: "Procédures en cours",   sub: "2 échéances cette semaine",        badge: null },
  { icon: AlertTriangle,iconBg: "bg-red-50 text-red-500",     value: "3",  label: "Alertes juridiques",    sub: "2 prioritaires",                   badge: null },
];

const veilleItems = [
  { tag: "Temps de travail", tagClass: "bg-green-100 text-green-700",   title: "Nouvelle obligation d'information des salariés en CDD",         date: "28 fév. 2026" },
  { tag: "Rupture",          tagClass: "bg-orange-100 text-orange-700", title: "Réforme des indemnités prud'homales : barème actualisé",        date: "25 fév. 2026" },
  { tag: "Discipline",       tagClass: "bg-purple-100 text-purple-700", title: "Procédure disciplinaire : nouveaux délais de prescription",     date: "22 fév. 2026" },
];

const docTypes = [
  { icon: Briefcase,    label: "CDI",                 sub: "Contrat durée indéterminée" },
  { icon: ClipboardList,label: "CDD",                 sub: "Contrat durée déterminée" },
  { icon: FileText,     label: "Avenant",             sub: "Modification contractuelle" },
  { icon: BookOpen,     label: "Lettre disciplinaire",sub: "Procédure disciplinaire" },
];

export function Dashboard() {
  const navigate = useNavigate();

  const handleFile = useCallback((file: File) => {
    if (!file) return;
    navigate("/analyzer", { state: { file } });
  }, [navigate]);

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) handleFile(files[0]);
  }, [handleFile]);

  return (
    <div className="space-y-6 max-w-7xl">

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

            {/* Statistiques */}
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
                <InputFile
                  onDrop={onDrop}
                  accepted={{
                    "application/pdf": [".pdf"]
                  }}
                  multiple={false}
                  fieldTitle="Cliquez ici ou glissez-déposez votre fichier PDF"
                  fieldDescription="Contrats, avenants, procédures"
                  supportedFileType="PDF"
                  fieldClassName="mb-4 p-6 border-gray-200 hover:border-lumenjuris hover:bg-lumenjuris/5"
                  iconClassName="w-10 h-10 bg-slate-100 text-gray-300"
                  fieldTitleClassName="text-sm font-medium text-gray-700 mb-0"
                  fieldDescriptionClassName="text-xs text-gray-400 mb-0"
                  fileTypeClassName="hidden"
                />
                <Link to="/conformite" className="inline-flex items-center gap-2 text-sm font-medium text-lumenjuris hover:text-lumenjuris transition-colors">
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
                      className="flex flex-col items-start gap-1 p-3 rounded-lg border border-gray-200 hover:border-lumenjuris hover:bg-lumenjuris/5 transition-all text-left group"
                    >
                      <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4 text-gray-400 group-hover:text-lumenjuris transition-colors" />
                        <span className="text-sm font-medium text-gray-800">{item.label}</span>
                      </div>
                      <span className="text-[11px] text-gray-400 leading-tight">{item.sub}</span>
                    </button>
                  ))}
                </div>
                <Link to="/generateur" className="inline-flex items-center gap-2 text-sm font-medium text-lumenjuris hover:text-lumenjuris transition-colors">
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
                    <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                      <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-800">"Quelles sont les obligations lors d'un licenciement pour faute grave ?"</p>
                      <p className="text-xs text-gray-400 mt-1.5">Sources : Art. L1232-1, L1234-1 du Code du travail</p>
                    </div>
                  </div>
                </div>
                <Link to="/chatjuridique" className="inline-flex items-center gap-2 text-sm font-medium text-lumenjuris hover:text-lumenjuris transition-colors">
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
                    <span className="text-lg font-bold text-lumenjuris">6 400 €</span>
                  </div>
                </div>
                <Link to="/calculateur" className="inline-flex items-center gap-2 text-sm font-medium text-lumenjuris hover:text-lumenjuris transition-colors">
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
                    className="p-4 rounded-lg border border-gray-200 hover:border-lumenjuris transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-3 w-3 text-gray-400" />
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.tagClass}`}>{item.tag}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 leading-snug group-hover:text-lumenjuris transition-colors">{item.title}</p>
                    <p className="text-xs text-gray-400 mt-2">{item.date}</p>
                  </div>
                ))}
              </div>
              <Link to="/veille" className="inline-flex items-center gap-2 text-sm font-medium text-lumenjuris hover:text-lumenjuris transition-colors">
                Voir toutes les actualités <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

    </div>
  );
}
