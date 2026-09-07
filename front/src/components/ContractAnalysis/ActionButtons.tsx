import React, { useState } from "react";
import { Share2, FileText, RefreshCw, Lightbulb } from "lucide-react";
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


  contract: ContractAnalysis;
  context: AnalysisContext | undefined
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
  const generateWordDocument = useAppliedRecommendationsStore(
    (s) => s.generateWordDocument,
  );


  const btnPrimary = "inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-blue-primary text-white  hover:-translate-y-0.5 rounded-xl shadow-sm transition-all disabled:opacity-50 hover:bg-blue-900";
  const btnGhostDisabled = "inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-400 bg-white/5 border border-white/5 rounded-xl cursor-not-allowed opacity-50 shrink-0 hover:-translate-y-0.5";

  const [suggestedClausesError, setSuggestedClausesError] = useState(false);

  const handleSuggestedClausesClick = async () => {
    if (!onSuggestedClauses) return;
    setSuggestedClausesError(false);
    try {
      // throw new Error("Erreur de test");
      onSuggestedClauses();
    } catch (error) {
      console.error("Erreur clauses suggérées :", error);
      setSuggestedClausesError(true);
    }
  }


  return (
    <div className="pb-2 flex justif-space gap-2 flex-col sm:flex-row ">
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


      <AddToContrathequeButton contract={contract} context={context} />

      {onSuggestedClauses && (
        <button
          onClick={handleSuggestedClausesClick}
          disabled={isLoadingSuggested}
          className={btnPrimary}
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
          className={btnPrimary}
          title="Relancer une nouvelle analyse complète"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRelaunchingAnalysis ? "animate-spin text-blue-400" : ""}`} />
          <span>{isRelaunchingAnalysis ? "Analyse..." : "Relancer"}</span>
        </button>
      )}

      <button onClick={onShareReport} className={btnPrimary} title="Partager le rapport">
        <Share2 className="w-3.5 h-3.5" />
        <span>Partager</span>
      </button>

      {extraActions}

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

    </div>);

};
