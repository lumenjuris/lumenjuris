import React, { useState } from "react";
import {
  MarketAnalysisResult,
  MissingClause,
} from "../../utils/marketAnalysis";
import { useDocumentTextStore } from "../../store/documentTextStore";

interface MarketComparisonProps {
  analysisResult: MarketAnalysisResult;
  isLoading?: boolean;
  onAppendClause: (clause: MissingClause) => void;
}

export const MarketComparison: React.FC<MarketComparisonProps> = ({
  analysisResult,
  isLoading = false,
  onAppendClause,
}) => {
  const addedClauseNames = useDocumentTextStore(
    (state) => state.addedClauses || [],
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mr-3"></div>
          <span className="text-lg text-gray-600">
            Analyse des clauses suggérées en cours...
          </span>
        </div>
      </div>
    );
  }

  const allClauses = analysisResult?.clausesManquantes || [];
  const clausesManquantes = allClauses.filter(
    (clause) => !addedClauseNames.includes(clause.nom),
  );

  const PRIORITY_ORDER: Record<string, number> = {
    critique: 0,
    important: 1,
    mineur: 2,
  };

  const getPriorityColor = (priorite: string) => {
  switch (priorite?.toLowerCase()) {
    case "critique":
    case "obligatoire":
      return {
        headerBg: "bg-red-card-primary",
        border: "border-red-500",
        badgeText: "text-red-500",
      };
    case "important":
      return {
        headerBg: "bg-yellow-card-primary",
        border: "border-amber-500",
        badgeText: "text-yellow-card-text",
      };
    case "mineur":
      return {
        headerBg: "bg-green-card-primary",
        border: "border-green-500",
        badgeText: "text-green-card-primary",
      };
    default:
      return {
        headerBg: "bg-gray-400",
        border: "border-gray-400",
        badgeText: "text-gray-500",
      };
  }
};

return (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div className="p-6 bg-gray-50">
      {clausesManquantes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Aucune clause manquante critique détectée
        </div>
      ) : (
        <div className="space-y-6">
          {clausesManquantes
            .sort((a, b) => {
              const priorityA = PRIORITY_ORDER[a.priorite];
              const priorityB = PRIORITY_ORDER[b.priorite];
              return priorityA - priorityB;
            })
            .map((clause, index) => {
              const colors = getPriorityColor(clause.priorite);
              const badgeLabel =
                clause.importance || clause.priorite || "OBLIGATOIRE";

              return (
                <div
                  key={index}
                  className={`border-2 ${colors.border} rounded-2xl overflow-hidden bg-white shadow-sm`}
                >
                  {/* En-tête de la carte */}
                  <div
                    className={`${colors.headerBg} px-6 py-3.5 flex items-center justify-between gap-4`}
                  >
                    <h3 className="text-lg font-medium text-gray-900">
                      {clause.nom}
                    </h3>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => onAppendClause(clause)}
                        className="inline-flex items-center gap-1.5 px-5 py-1.5 bg-[#1E293B] hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-full transition-colors shadow-sm"
                      >
                        <span className="text-sm font-normal">+</span> Ajouter
                      </button>

                      <span
                        className={`px-4 py-1.5 bg-white ${colors.badgeText} text-xs uppercase tracking-wider rounded-full border border-white shadow-sm`}
                      >
                        {badgeLabel}
                      </span>
                    </div>
                  </div>

                  {/* Corps de la carte */}
                  <div className="p-6 space-y-4 text-sm text-gray-900 leading-relaxed">
                    {clause.explicationAbsence && (
                      <p>
                        <strong className="font-bold">Problème :</strong>{" "}
                        {clause.explicationAbsence}
                      </p>
                    )}

                    {clause.standardMarche && (
                      <p>
                        <strong className="font-bold">Standard du marché:</strong>{" "}
                        {clause.standardMarche}
                      </p>
                    )}

                    {(clause.titreSuggestion || clause.corpsSuggestion) && (
                      <div>
                        <p className="font-bold mb-1">
                          Suggestion: {clause.titreSuggestion}
                        </p>
                        <p className="whitespace-pre-line text-gray-800">
                          {clause.corpsSuggestion}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  </div>
)};
