import React, { useState } from 'react';
import { Share2, FileText, BarChart3, CheckCircle } from 'lucide-react';
import { MarketComparison } from './MarketComparison';
import { useDocumentTextStore } from '../../store/documentTextStore';
import type { MarketAnalysisResult } from '../../utils/marketAnalysis';
import { useAppliedRecommendationsStore } from '../../store/appliedRecommendationsStore';

interface ActionButtonsProps {
  onNewAnalysis: () => void;
  onShareReport: () => void;
  onMarketAnalysis?: () => Promise<void>;
  isMarketAnalysisLoading?: boolean;
  isProcessed: boolean;
  analysisResult?: MarketAnalysisResult | null;
  onQuestionClick?: (question: string) => void;
  // Restauration export Word
  originalContent?: string;
  fileName?: string;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onNewAnalysis,
  onShareReport,
  onMarketAnalysis,
  isMarketAnalysisLoading = false,
  isProcessed,
  analysisResult,
  onQuestionClick,
  originalContent,
  fileName
}) => {
  const [showComparison, setShowComparison] = useState(false);

  // RESTAURATION: Récupérer le nombre de patches appliqués depuis le store
  const patches = useDocumentTextStore(state => state.patches);
  const activePatchCount = patches.filter(p => p.active).length;
  //const viewMode = useDocumentTextStore(state => state.viewMode); A SUPPRIMER
  //const setViewMode = useDocumentTextStore(state => state.setViewMode);A SUPPRIMER
  // Store recommandations appliquées (pour export Word)
  const generateWordDocument = useAppliedRecommendationsStore(s => s.generateWordDocument);
  const hasAnyAppliedRecommendations = useAppliedRecommendationsStore(s => s.hasAnyAppliedRecommendations());

  const handleMarketAnalysisClick = async () => {
    setShowComparison(!showComparison);
    if (!showComparison && onMarketAnalysis && !analysisResult) {
      await onMarketAnalysis();
    }
  };

  return (
    <>
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onNewAnalysis}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FileText className="w-4 h-4 mr-2" />
              Nouvelle analyse
            </button>

            <button
              onClick={handleMarketAnalysisClick}
              disabled={!isProcessed || isMarketAnalysisLoading}
              className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors ${showComparison
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } ${(!isProcessed || isMarketAnalysisLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              {isMarketAnalysisLoading ? 'Analyse en cours...' : (showComparison ? 'Masquer comparatif' : 'Analyse comparative')}
            </button>

            <button
              onClick={onShareReport}
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Partager
            </button>

            {generateWordDocument && (
              <button
                onClick={() => generateWordDocument(originalContent, fileName)}
                disabled={!isProcessed || !hasAnyAppliedRecommendations}
                className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors ${(!isProcessed || !hasAnyAppliedRecommendations)
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                title={!hasAnyAppliedRecommendations ? 'Aucune recommandation appliquée à exporter' : 'Exporter le document modifié en .docx'}
              >
                <FileText className="w-4 h-4 mr-2" />
                Export Word
              </button>
            )}
          </div>

          {/* RESTAURATION: Affichage du nombre de recommandations appliquées */}
          <div className="flex items-center space-x-4">
            {activePatchCount > 0 && (
              <div className="flex items-center space-x-2 ml-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-gray-700">
                  {activePatchCount} recommandation{activePatchCount > 1 ? 's' : ''} appliquée{activePatchCount > 1 ? 's' : ''}
                </span>


                {/* RESTAURATION: Boutons pour basculer entre original et modifié */}
                {/* A SUPPRIMER <div className="inline-flex rounded-full border border-gray-300 overflow-hidden ml-2">
                  <button
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      viewMode === 'original' ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setViewMode('original')}
                    title="Afficher le texte original"
                  >
                    Original
                  </button>
                  <button
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      viewMode === 'modified' ? 'bg-green-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                    onClick={() => setViewMode('modified')}
                    title="Afficher le texte modifié"
                  >
                    Modifié
                  </button>
                </div> */}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panneau d'analyse comparative */}
      {showComparison && (
        <div className="bg-white border-b border-gray-200 shadow-lg">
          <div className="p-6">
            {analysisResult ? (
              <MarketComparison
                analysisResult={analysisResult}
                onQuestionClick={onQuestionClick || (() => { })}
                isLoading={isMarketAnalysisLoading}
              />
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p>Analyse du marché en cours...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};