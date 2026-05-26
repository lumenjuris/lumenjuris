import React from "react";
import { Lightbulb, RefreshCw } from "lucide-react";
import { ClauseRisk } from "../../types";
import { ClauseRiskCard } from "./ClauseRiskCard";
import { TextPatch } from "../../store/documentTextStore";

interface ClausesSidebarProps {
  clauses: ClauseRisk[];
  onClauseClick?: (clause: ClauseRisk, index: number) => void;
  isVisible: boolean;
  activeClauseId?: string | null;
  recommandationApplied?: TextPatch[];
  onSuggestedClauses?: () => void;
  isLoadingSuggested?: boolean;
}

export const ClausesSidebar: React.FC<ClausesSidebarProps> = ({
  clauses,
  onClauseClick,
  isVisible = true,
  recommandationApplied,
  onSuggestedClauses,
  isLoadingSuggested = false,
}) => {
  if (!isVisible || !clauses || clauses.length === 0) {
    return null;
  }

  const handleClauseClick = (clause: ClauseRisk, index: number) => {
    if (onClauseClick) {
      onClauseClick(clause, index);
    }
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-fit">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2 mb-3">
          ⚖️ {clauses.length} Clauses détectées
        </h3>

        {/* Boutons d'action */}
        <div className="flex flex-col gap-2">
          <button
            onClick={onSuggestedClauses}
            disabled={isLoadingSuggested}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-white text-green-600 hover:bg-green-50 border border-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Lightbulb className="w-4 h-4" />
            {isLoadingSuggested ? "Analyse en cours..." : "Clauses suggérées"}
          </button>

          <button
            disabled
            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-white text-gray-400 border border-gray-200 cursor-not-allowed"
          >
            <RefreshCw className="w-4 h-4" />
            Re-analyser les clauses
          </button>
        </div>
      </div>

      {/* Clauses List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {clauses.map((clause, index) => (
          <ClauseRiskCard
            key={clause.id}
            clause={clause}
            onClick={() => handleClauseClick(clause, index)}
            recommandationApplied={recommandationApplied}
          />
        ))}
      </div>
    </div>
  );
};
