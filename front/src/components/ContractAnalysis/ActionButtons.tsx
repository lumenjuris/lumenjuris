import React, { useState, useEffect } from "react";
import { Share2, FileText, RefreshCw, Lightbulb } from "lucide-react";
import { useAppliedRecommendationsStore } from "../../store/appliedRecommendationsStore";
import { AddToContrathequeButton } from "./AddToContrathequeButton";
import { ContractAnalysis } from "../../types";
import { AnalysisContext } from "../../types/contextualAnalysis";
import { AlertBanner } from "../common/AlertBanner";
import { isAnalyzerQuotaExhausted } from "../../utils/analyzerQuota";
import { BANNER_ACTION_CLASS } from "../common/PageBanner";
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

  const [enoughtCredit, setEnoughtCredit] = useState<boolean>()

  useEffect(() =>{
     isAnalyzerQuotaExhausted().then((ec)=>setEnoughtCredit(ec))
  }, [])


  // Ces boutons vivent dans le bandeau bleu : même style que tous les boutons d'en-tête.
  const btnPrimary = BANNER_ACTION_CLASS;
  const btnGhostDisabled = BANNER_ACTION_CLASS;

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
    <div className="flex flex-wrap items-center gap-2.5">
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
          <Lightbulb />
          <span>{isLoadingSuggested ? "Analyse..." : "Clauses suggérées"}</span>
        </button>
      )}

      {onRelaunchAnalysis && (
        <button
          onClick={onRelaunchAnalysis}
          disabled={isRelaunchingAnalysis || enoughtCredit}
          className={btnPrimary}
          title={!enoughtCredit ? "Relancer une nouvelle analyse complète" : "Vos crédits d'analyse de contrat sont épuisés"}
        >
          <RefreshCw className={isRelaunchingAnalysis ? "animate-spin" : ""} />
          <span>{isRelaunchingAnalysis ? "Analyse..." : "Relancer"}</span>
        </button>
      )}

      <button onClick={onShareReport} className={btnPrimary} title="Partager le rapport">
        <Share2 />
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
          <FileText />
          <span>Export Word</span>
        </button>
      )}

    </div>);

};
