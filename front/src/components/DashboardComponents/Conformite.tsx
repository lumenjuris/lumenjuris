import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, AlertCircle, CheckCircle, Lock } from "lucide-react";
import InputFile from "../common/InputFile";

type RiskLevel = "high" | "medium" | "ok";

interface Risk {
  level: RiskLevel;
  title: string;
  article: string;
  suggestion: string;
}

const mockRisks: Risk[] = [
  {
    level: "high",
    title: "Clause de non-concurrence non conforme",
    article: "Art. L1121-1",
    suggestion: "La clause doit prévoir une contrepartie financière et être limitée dans le temps et l'espace.",
  },
  {
    level: "medium",
    title: "Période d'essai : durée excessive",
    article: "Art. L1221-19",
    suggestion: "La période d'essai ne peut excéder 4 mois pour les cadres (renouvellement compris : 8 mois).",
  },
  {
    level: "ok",
    title: "Mention de la convention collective manquante",
    article: "Art. R2262-1",
    suggestion: "Le contrat doit mentionner la convention collective applicable.",
  },
];

const RISK_CONFIG: Record<RiskLevel, { icon: typeof AlertTriangle; iconClass: string; borderClass: string }> = {
  high:   { icon: AlertTriangle, iconClass: "text-red-500",    borderClass: "border-red-100"    },
  medium: { icon: AlertCircle,   iconClass: "text-amber-500",  borderClass: "border-amber-100"  },
  ok:     { icon: CheckCircle,   iconClass: "text-lumenjuris",  borderClass: "border-lumenjuris/20" },
};

export function Conformite() {
  const navigate = useNavigate();

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) navigate("/analyzer", { state: { file: files[0] } });
  }, [navigate]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Analyse de conformité</h1>
        <p className="text-sm text-gray-500 mt-1">Vérifiez la conformité juridique de vos documents RH</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* Left: upload */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-5">
          <h2 className="text-base font-semibold text-gray-900">Importer un document</h2>

          <InputFile
            onDrop={onDrop}
            accepted={{ "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] }}
            multiple={false}
            fieldTitle="Glissez-déposez votre document"
            fieldDescription="PDF, DOCX – Max 10 Mo"
            supportedFileType="PDF / DOCX"
            fieldClassName="mb-0 p-6 border-gray-200 hover:border-lumenjuris/40 hover:bg-gray-50"
            iconClassName="w-10 h-10 bg-slate-100 text-gray-300"
            fieldTitleClassName="text-sm font-medium mb-0 text-gray-700"
            fieldDescriptionClassName="text-xs text-gray-400 mb-0"
            fileTypeClassName="hidden"
          />

          <button
            disabled
            className="w-full bg-lumenjuris text-white text-sm font-semibold py-3 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Analyser le document
          </button>

          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
            <Lock className="h-3 w-3" />
            Document traité de manière confidentielle
          </div>
        </div>

        {/* Right: results */}
        <div className="space-y-4">
          {/* Score */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900">Score de conformité</h2>
              <span className="text-xs font-semibold text-lumenjuris bg-lumenjuris/10 border border-lumenjuris/20 px-2.5 py-1 rounded-full">
                Conforme
              </span>
            </div>

            <div className="flex items-center gap-6">
              {/* Circle */}
              <div className="relative shrink-0">
                <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#f1f5f9" strokeWidth="7" />
                  <circle
                    cx="40" cy="40" r="32" fill="none"
                    stroke="#354F99" strokeWidth="7"
                    strokeDasharray={`${2 * Math.PI * 32 * 0.85} ${2 * Math.PI * 32}`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-lumenjuris">
                  85%
                </span>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between text-sm text-gray-700">
                  <span>Clauses conformes</span>
                  <span className="font-semibold">17/20</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-lumenjuris rounded-full" style={{ width: "85%" }} />
                </div>
                <p className="text-xs text-gray-400">3 points nécessitent votre attention</p>
              </div>
            </div>
          </div>

          {/* Risks */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Risques détectés</h2>
              <div className="space-y-3">
                {mockRisks.map((risk, i) => {
                  const cfg = RISK_CONFIG[risk.level];
                  const Icon = cfg.icon;
                  return (
                    <div key={i} className={`rounded-lg border p-4 space-y-2 ${cfg.borderClass}`}>
                      <div className="flex items-start gap-2.5">
                        <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${cfg.iconClass}`} />
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{risk.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{risk.article}</p>
                        </div>
                      </div>
                      <div className="ml-6.5 bg-gray-50 border border-gray-100 rounded-md px-3 py-2">
                        <span className="text-xs font-semibold text-gray-600">Texte proposé : </span>
                        <span className="text-xs text-gray-500 italic">{risk.suggestion}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
