import React from "react";
import { MarketAnalysisResult } from "../../utils/marketAnalysis";

interface MarketComparisonProps {
  analysisResult: MarketAnalysisResult;
  isLoading?: boolean;
}

export const MarketComparison: React.FC<MarketComparisonProps> = ({
  analysisResult,
  isLoading = false,
}) => {
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

  const { clausesManquantes } = analysisResult;

  const getPriorityColor = (priorite: string) => {
    switch (priorite) {
      case "critique":
        return "bg-red-50 border-red-200";
      case "important":
        return "bg-orange-50 border-orange-200";
      case "mineur":
        return "bg-yellow-50 border-yellow-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="p-6 bg-gray-50">
        {clausesManquantes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Aucune clause manquante critique détectée
          </div>
        ) : (
          <div className="space-y-3">
            {clausesManquantes.map((clause, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${getPriorityColor(clause.priorite)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-800">{clause.nom}</h4>
                  <span className="text-xs px-2 py-1 rounded-full bg-white bg-opacity-50 text-gray-700">
                    {clause.importance.toUpperCase()}
                  </span>
                </div>

                <p className="text-sm mb-3 text-gray-700">
                  <strong>Problème:</strong> {clause.explicationAbsence}
                </p>

                <div className="bg-white bg-opacity-60 rounded p-3 mb-3">
                  <p className="text-sm text-gray-800">
                    <strong>Standard du marché:</strong> {clause.standardMarche}
                  </p>
                </div>

                <div className="bg-white bg-opacity-60 rounded p-3">
                  <p className="text-sm text-gray-800">
                    <strong>Suggestion:</strong> {clause.suggestionAjout}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
