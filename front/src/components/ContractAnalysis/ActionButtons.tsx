import React from 'react';
import { Share2, FileText, CheckCircle } from 'lucide-react';
import { useDocumentTextStore } from '../../store/documentTextStore';
import { useAppliedRecommendationsStore } from '../../store/appliedRecommendationsStore';

interface ActionButtonsProps {
  onNewAnalysis: () => void;
  onShareReport: () => void;
  isProcessed: boolean;
  originalContent?: string;
  fileName?: string;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onNewAnalysis,
  onShareReport,
  isProcessed,
  originalContent,
  fileName
}) => {
  const patches = useDocumentTextStore(state => state.patches);
  const activePatchCount = patches.filter(p => p.active).length;
  const generateWordDocument = useAppliedRecommendationsStore(s => s.generateWordDocument);
  const hasAnyAppliedRecommendations = useAppliedRecommendationsStore(s => s.hasAnyAppliedRecommendations());

  return (
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

        <div className="flex items-center space-x-4">
          {activePatchCount > 0 && (
            <div className="flex items-center space-x-2 ml-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">
                {activePatchCount} recommandation{activePatchCount > 1 ? 's' : ''} appliquée{activePatchCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
