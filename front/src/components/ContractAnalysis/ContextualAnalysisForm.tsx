import React, { useState, useEffect } from 'react';
import { AnalysisContext } from '../../types/contextualAnalysis';
import { detectContractWithAI } from '../../utils/contractDetector';

interface ContextualAnalysisFormProps {
  onSubmit: (context: AnalysisContext) => void;
  onSkip: () => void;
  contractPreview?: string;
  extractedText?: string;
  isVisible: boolean;
}

export const ContextualAnalysisForm: React.FC<ContextualAnalysisFormProps> = ({
  onSubmit,
  onSkip,
  extractedText,
  isVisible
}) => {


  const [context, setContext] = useState<AnalysisContext>({
    contractType: '',
    userRole: '',
    specificQuestions: '',
    analysisDepth: 'detailed',
    interestOrientation: 'balanced',
    mission: '',
    legalRegime: "",
    contractObjective : "",
  });



  const [isDetecting, setIsDetecting] = useState(false);
  const [placeholders] = useState({ mission: '', questions: '' }); // Retiré setPlaceholders
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEquitable = context.interestOrientation === 'balanced';


  
  // Détection automatique au chargement du formulaire - 100% IA
  useEffect(() => {
    if (!extractedText || extractedText.length < 100) {
      return;
    }

    let isActive = true;

    const performDetection = async () => {
      console.log('🔍 Détection IA 100% dynamique en cours...');
      setIsDetecting(true);

      try {
        // Utilise UNIQUEMENT l'IA pour déterminer TOUT
        const aiResult = await detectContractWithAI(extractedText);

        if (isActive) {
          // Remplace TOUT le contexte par les valeurs de l'IA
          setContext({
            contractType: aiResult.contractType,
            userRole: aiResult.userRole,
            specificQuestions: aiResult.specificQuestions,
            mission: aiResult.mission || '',
            analysisDepth: aiResult.analysisDepth,
            interestOrientation: aiResult.interestOrientation,
            legalRegime: aiResult.legalRegime || '',
            contractObjective: aiResult.contractObjective || '',
          });

          console.log('✅ Pré-remplissage 100% IA effectué - aucune variable statique utilisée');
        }
      } catch (error) {
        console.error('❌ Erreur détection IA:', error);
      } finally {
        if (isActive) {
          setIsDetecting(false);
        }
      }
    };

    const timeoutId = setTimeout(performDetection, 500);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [extractedText]);

  if (!isVisible) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🎯 Formulaire soumis avec contexte:', context);

    if (!context.contractType.trim()) {
      alert('Veuillez spécifier le type de contrat');
      return;
    }
    if (!isEquitable && !context.userRole.trim()) {
      alert('Veuillez spécifier votre position');
      return;
    }

    const contextToSubmit = {
      ...context,
      specificQuestions: context.specificQuestions || placeholders.questions || 'Analyse générale des risques',
      missionContext: context.mission || placeholders.mission || 'Analyse contractuelle'
    };

    console.log('🚀 Soumission du contexte:', contextToSubmit);

    setIsSubmitting(true);

    try {
      onSubmit(contextToSubmit);
    } catch (error) {
      console.error('❌ Erreur lors de l\'appel onSubmit:', error);
      setIsSubmitting(false);
    }
  };






  // Retour du JSX
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-semibold mb-4">📋 Questions d'analyse personnalisée</h3>

        {isDetecting && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-sm text-blue-700">
            <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full"></div>
            Analyse du document pour pré-remplir le formulaire...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type de contrat - maintenant en texte libre */}
          <div>
            <label className="block text-sm font-medium mb-2">Type de contrat :</label>
            <input
              type="text"
              value={context.contractType}
              onChange={(e) => setContext({ ...context, contractType: e.target.value })}
              placeholder="ex: Contrat de mariage, Contrat commercial, Contrat de travail..."
              className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {isEquitable && (
            <div className="p-3 mb-4 bg-green-50 border border-green-300 text-green-800 rounded-md text-sm">
              ⚖️ Contrat équilibré détecté : la position contractuelle est neutre.
            </div>
          )}

          {/* Votre rôle - Version juridique professionnelle */}
          {!isEquitable && (
            <div>
              <label className="block text-sm font-medium mb-2">Quelle est votre position contractuelle ? :</label>

              {/* Options radio pour le rôle */}
              <div className="space-y-2 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="userRole"
                    value="position_favorable"
                    checked={context.userRole === 'position_favorable'}
                    onChange={(e) => setContext({ ...context, userRole: e.target.value, interestOrientation: 'assertive' })}
                    className="text-blue-600"
                  />
                  <span className="text-sm">
                    <span className="font-medium">🏛️ Position favorable</span> - J'ai l'avantage contractuel
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="userRole"
                    value="position_vulnerable"
                    checked={context.userRole === 'position_vulnerable'}
                    onChange={(e) => setContext({ ...context, userRole: e.target.value, interestOrientation: 'defensive' })}
                    className="text-green-600"
                  />
                  <span className="text-sm">
                    <span className="font-medium">🛡️ Position vulnérable</span> - Je suis en situation de faiblesse
                  </span>
                </label>
              </div>
            </div>)}


          {/* Orientation des intérêts */}
          <div>
            <label className="block text-sm font-medium mb-3">
              🎯 Orientation de l'analyse :
            </label>

            {/* Options radio */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="interestOrientation"
                  value="defensive"
                  checked={context.interestOrientation === 'defensive'}
                  onChange={(e) => setContext({ ...context, interestOrientation: e.target.value as 'defensive' | 'balanced' | 'assertive' })}
                  className="text-blue-600"
                />
                <span className="text-sm">
                  <span className="font-medium">🛡️ Défensif</span> - Protéger mes intérêts, identifier tous les risques
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="interestOrientation"
                  value="balanced"
                  checked={context.interestOrientation === 'balanced'}
                  onChange={(e) => setContext({ ...context, interestOrientation: e.target.value as 'defensive' | 'balanced' | 'assertive' })}
                  className="text-green-600"
                />
                <span className="text-sm">
                  <span className="font-medium">⚖️ Équilibré</span> - Analyse objective des deux parties
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="interestOrientation"
                  value="assertive"
                  checked={context.interestOrientation === 'assertive'}
                  onChange={(e) => setContext({ ...context, interestOrientation: e.target.value as 'defensive' | 'balanced' | 'assertive' })}
                  className="text-orange-600"
                />
                <span className="text-sm">
                  <span className="font-medium">⚡ Assertif</span> - Maximiser mes avantages contractuels
                </span>
              </label>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              {context.interestOrientation === 'defensive' ?
                'L\'analyse se concentrera sur la protection et l\'identification des risques.' :
                context.interestOrientation === 'balanced' ?
                  'L\'analyse sera objective et équitable pour toutes les parties.' :
                  'L\'analyse optimisera vos avantages dans le respect de la légalité.'
              }
            </p>
          </div>



          {/* NOUVEAU : Ajout de contexte du contrat pour une meilleurs analyse 
          1. Régime juridique
          2. Objectif du contrat
          */}
          <div>
            <label
              htmlFor="legalRegim"
              className="block text-sm font-medium"
            >Régime Juridique :</label>

            <input
              type="text"
              value={context.legalRegime || ''}
              placeholder="ex: Droit privé – Contrat commercial"
              className="w-full mt-2 p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              id="legalRegim"
              name="legalRegim"
              onChange={(e)=> setContext(prev => ({...prev, legalRegime: e.target.value}))}
              required
            />
          </div>

          <div>
            <label
              htmlFor="contractGoal"
              className="block text-sm font-medium "
            >Objectif du Contrat :</label>

            <input
              type="text"
              value={context.contractObjective || ''}
              placeholder="ex: Sécuriser un partenariat"
              className="w-full mt-2 p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              id="contractGoal"
              name="contractGoal"
              onChange={(e)=> setContext(prev => ({...prev , contractObjective : e.target.value}) )}
              required
            />
          </div>




          {/* NOUVEAU: Champ Mission - Après les questions spécifiques */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Mission spécifique
              <span className="ml-2 text-xs text-gray-500">(optionnel - améliore la précision)</span>
            </label>

            <textarea
              value={context.mission || ''}
              onChange={(e) => setContext(prev => ({ ...prev, mission: e.target.value }))}
              placeholder={placeholders.mission || getMissionPlaceholder(context.contractType)}
              className="w-full  px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
              rows={3}
            />

            {context.mission && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Mission prise en compte pour une analyse personnalisée
              </p>
            )}
          </div>

          {/* Boutons */}
          <div className="flex justify-between items-center pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyse en cours...
                </span>
              ) : (
                '🚀 Analyse'
              )}
            </button>

            <button
              type="button"
              onClick={onSkip}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md text-sm"
            >
              Ignorer
            </button>
          </div>

        </form>

        <div className="mt-3 text-center text-xs text-gray-500">
          {isSubmitting && (
            <div className="text-blue-600 font-medium">
              ⏳ Lancement de l'analyse personnalisée...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Fonction helper pour le placeholder adaptatif
function getMissionPlaceholder(contractType: string): string {
  const type = contractType.toLowerCase();
  if (type.includes('bail') || type.includes('location')) {
    return "Ex: Vérifier les charges cachées, protéger mes droits de locataire, analyser le dépôt de garantie, négocier une réduction du loyer...";
  }
  if (type.includes('travail') || type.includes('emploi')) {
    return "Ex: Vérifier la période d'essai, analyser les clauses de non-concurrence, protéger mes droits de salarié, négocier le télétravail...";
  }
  if (type.includes('vente') || type.includes('achat')) {
    return "Ex: Vérifier les garanties, analyser les conditions de livraison, protéger mes droits d'acheteur, négocier les délais...";
  }
  if (type.includes('prestation') || type.includes('service')) {
    return "Ex: Vérifier les livrables, analyser les pénalités de retard, protéger mes intérêts, clarifier la propriété intellectuelle...";
  }
  return "Décrivez votre objectif principal : vérifier la conformité légale, protéger vos intérêts, identifier les risques, négocier des conditions...";
}
