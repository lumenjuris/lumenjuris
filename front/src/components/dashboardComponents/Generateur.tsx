import { useState } from "react";
import { FileText, Briefcase, ClipboardList, BookOpen, Shield, ChevronRight } from "lucide-react";

const docTypes = [
  { id: "cdi",          icon: Briefcase,     label: "CDI – Contrat à durée indéterminée" },
  { id: "cdd",          icon: ClipboardList, label: "CDD – Contrat à durée déterminée" },
  { id: "avenant",      icon: FileText,      label: "Avenant au contrat" },
  { id: "disciplinaire",icon: BookOpen,       label: "Lettre disciplinaire" },
  { id: "rupture",      icon: Shield,         label: "Rupture conventionnelle" },
];

const STEPS = ["Type de document", "Informations", "Clauses", "Aperçu"];

const PREVIEW_CONTENT: Record<string, { title: string; articles: { heading: string; text: string }[] }> = {
  cdi: {
    title: "CONTRAT À DURÉE INDÉTERMINÉE",
    articles: [
      { heading: "Article 1 – Engagement", text: "La société engage le salarié en qualité de [poste] à compter du [date]. Le présent contrat est soumis aux dispositions de la convention collective [convention]." },
      { heading: "Article 2 – Période d'essai", text: "Le présent contrat est conclu sous réserve d'une période d'essai de [durée] mois, renouvelable une fois..." },
      { heading: "Article 3 – Rémunération", text: "La rémunération mensuelle brute est fixée à [montant] €, versée le [date] de chaque mois..." },
    ],
  },
  cdd: {
    title: "CONTRAT À DURÉE DÉTERMINÉE",
    articles: [
      { heading: "Article 1 – Objet du contrat", text: "Le présent contrat est conclu pour [motif de recours] conformément aux articles L1242-1 et suivants du Code du travail." },
      { heading: "Article 2 – Durée", text: "Le contrat est conclu du [date début] au [date fin], soit une durée de [X] mois." },
    ],
  },
  avenant: {
    title: "AVENANT AU CONTRAT DE TRAVAIL",
    articles: [
      { heading: "Article 1 – Objet", text: "Le présent avenant modifie le contrat de travail conclu le [date] entre [société] et [salarié] dans les conditions suivantes." },
      { heading: "Article 2 – Modification", text: "À compter du [date d'effet], les dispositions suivantes remplacent et annulent les clauses correspondantes du contrat initial..." },
    ],
  },
  disciplinaire: {
    title: "LETTRE DISCIPLINAIRE",
    articles: [
      { heading: "Objet", text: "Nous avons été amenés à constater des faits de nature à justifier une sanction disciplinaire à votre encontre." },
      { heading: "Faits reprochés", text: "[Description précise des faits reprochés, dates, circonstances...]" },
    ],
  },
  rupture: {
    title: "RUPTURE CONVENTIONNELLE",
    articles: [
      { heading: "Article 1 – Accord des parties", text: "L'employeur et le salarié conviennent d'un commun accord de mettre fin au contrat de travail à durée indéterminée conformément aux articles L1237-11 et suivants du Code du travail." },
      { heading: "Article 2 – Indemnité", text: "Le salarié percevra une indemnité spécifique de rupture conventionnelle d'un montant de [montant] €." },
    ],
  },
};

export function Generateur() {
  const [step, setStep] = useState(0);
  const [selectedDoc, setSelectedDoc] = useState("cdi");
  const [cc, setCc] = useState("SYNTEC – Bureaux d'études");

  const preview = PREVIEW_CONTENT[selectedDoc];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Générateur de modèles</h1>
        <p className="text-sm text-gray-500 mt-1">Créez des documents juridiques conformes en quelques étapes</p>
      </div>

      {/* Visualisateur des étapes  */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-4">
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => i <= step && setStep(i)}
                className="flex items-center gap-2 shrink-0"
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  i < step  ? "bg-lumenjuris text-white"
                  : i === step ? "bg-lumenjuris text-white ring-4 ring-lumenjuris/20"
                  : "bg-gray-100 text-gray-400"
                }`}>
                  {i + 1}
                </span>
                <span className={`text-sm font-medium hidden sm:block ${i === step ? "text-lumenjuris" : i < step ? "text-gray-700" : "text-gray-400"}`}>
                  {s}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 text-gray-300 flex-1 mx-2 min-w-0 hidden sm:block" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Zone de choix */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-5">
          <h2 className="text-base font-semibold text-gray-900">Choisissez le type de document</h2>
          <div className="space-y-2">
            {docTypes.map((dt) => (
              <button
                key={dt.id}
                onClick={() => setSelectedDoc(dt.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                  selectedDoc === dt.id
                    ? "border-lumenjuris bg-lumenjuris/5"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <dt.icon className={`h-4 w-4 shrink-0 ${selectedDoc === dt.id ? "text-lumenjuris" : "text-gray-400"}`} />
                <span className={`text-sm font-medium ${selectedDoc === dt.id ? "text-lumenjuris" : "text-gray-700"}`}>
                  {dt.label}
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Convention Collective</label>
            <div className="flex items-center gap-2">
              <input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-lumenjuris transition-colors"
              />
              <button className="text-sm text-lumenjuris font-medium hover:text-lumenjuris-dark transition-colors shrink-0">
                Changer
              </button>
            </div>
          </div>

          <button
            onClick={() => setStep(Math.min(step + 1, STEPS.length - 1))}
            className="w-full flex items-center justify-center gap-2 bg-lumenjuris text-white text-sm font-semibold py-3 rounded-lg hover:bg-lumenjuris-dark transition-colors"
          >
            Continuer <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Aperçu du document */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Aperçu du document</h2>
          <div className="border border-gray-200 rounded-lg p-5 bg-gray-50 space-y-3 min-h-[300px]">
            <div className="text-center space-y-0.5">
              <p className="text-[11px] text-gray-400 uppercase tracking-widest font-medium">Contrat de travail</p>
              <p className="text-sm font-bold text-gray-900">{preview.title}</p>
            </div>
            <hr className="border-gray-200" />
            <div className="space-y-3">
              {preview.articles.map((a, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-xs font-bold text-gray-800">{a.heading}</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{a.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

