import React, { useState } from "react";
import {
  Share2,
  FileText,
  CheckCircle,
  RefreshCw,
  Lightbulb,
} from "lucide-react";
import { useDocumentTextStore } from "../../store/documentTextStore";
import { useAppliedRecommendationsStore } from "../../store/appliedRecommendationsStore";
import { AddToContrathequeButton } from "./AddToContrathequeButton";
import { ContractAnalysis } from "../../types";
import { AnalysisContext } from "../../types/contextualAnalysis";
import { AlertBanner } from "../common/AlertBanner";

interface ActionButtonsProps {
  onShareReport: () => void;
  isProcessed: boolean;
  originalContent?: string;
  htmlContent?: string | null;
  fileName?: string;
  onRelaunchAnalysis?: () => void;
  isRelaunchingAnalysis?: boolean;
  onSuggestedClauses?: () => void;
  isLoadingSuggested?: boolean;
  /** Actions supplémentaires (ex. « Ajouter à la contrathèque »). */
  extraActions?: React.ReactNode;


  contract:ContractAnalysis;
  context:AnalysisContext | undefined
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onShareReport,
  isProcessed,
  originalContent,
  htmlContent,
  fileName,
  onRelaunchAnalysis,
  isRelaunchingAnalysis = false,
  onSuggestedClauses,
  isLoadingSuggested = false,
  extraActions,

  contract,
  context

}) => {
  const patches = useDocumentTextStore((state) => state.patches);
  const activePatchCount = patches.filter((p) => p.active).length;
  const generateWordDocument = useAppliedRecommendationsStore(
    (s) => s.generateWordDocument,
  );

  
  const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-xl shadow-sm transition-all disabled:opacity-50 shrink-0";
  const btnGhost = "inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-200 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl backdrop-blur-sm transition-all disabled:opacity-50 shrink-0";
  const btnGhostDisabled = "inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-400 bg-white/5 border border-white/5 rounded-xl cursor-not-allowed opacity-50 shrink-0";

  const [suggestedClausesError, setSuggestedClausesError] = useState(false);

  const handleSuggestedClausesClick = async () => {
    if (!onSuggestedClauses) return;
    setSuggestedClausesError(false);

    try {
      // throw new Error("Erreur de test");
      await onSuggestedClauses();
    } catch (error) {
      console.error("Erreur clauses suggérées :", error);
      setSuggestedClausesError(true);
    }
  }
 

  return (
    <div className=" px-6 py-6">
      {suggestedClausesError && (
        <div className="mb-4">
          <AlertBanner
            title="Erreur de chargement !"
            variant="error"
            detail="Impossible de récupérer les clauses suggérées. Veuillez réessayer."
            duration={8000}
            onClose={() => setSuggestedClausesError(false)}
          />
        </div>
      )}


  <div className="flex items-center justify-center sm:justify-between gap-3 flex-wrap">
    
    <div className="flex items-center gap-2 flex-wrap">
      <AddToContrathequeButton 
        contract={contract}
        context={context}
      />

      {onSuggestedClauses && (
        <button
          onClick={handleSuggestedClausesClick}
          disabled={isLoadingSuggested}
          className={btnGhost}
          title="Voir les clauses suggérées"
        >
          <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
          <span>{isLoadingSuggested ? "Analyse..." : "Clauses suggérées"}</span>
        </button>
      )}

      {onRelaunchAnalysis && (
        <button
          onClick={onRelaunchAnalysis}
          disabled={isRelaunchingAnalysis}
          className={btnGhost}
          title="Relancer une nouvelle analyse complète"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRelaunchingAnalysis ? "animate-spin text-blue-400" : ""}`} />
          <span>{isRelaunchingAnalysis ? "Analyse..." : "Relancer"}</span>
        </button>
      )}

      <button onClick={onShareReport} className={btnGhost} title="Partager le rapport">
        <Share2 className="w-3.5 h-3.5" />
        <span>Partager</span>
      </button>

      {extraActions}
    </div>

    {generateWordDocument && (
      <button
        onClick={() =>
          generateWordDocument(
            originalContent,
            fileName,
            htmlContent ?? undefined,
          )
        }
        disabled={!isProcessed}
        className={isProcessed ? btnPrimary : btnGhostDisabled}
        title="Exporter le document en .docx"
      >
        <FileText className="w-4 h-4 text-blue-600" />
        <span>Export Word</span>
      </button>
    )}

        {activePatchCount > 0 && (
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <CheckCircle className="w-4 h-4 text-green-500" />
            {activePatchCount} recommandation{activePatchCount > 1 ? "s" : ""}{" "}
            appliquée{activePatchCount > 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
};
