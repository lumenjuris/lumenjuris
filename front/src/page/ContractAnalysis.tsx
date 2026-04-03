import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Header } from '../components/ContractAnalysis/Header';
import { UploadZone } from '../components/ContractAnalysis/UploadZone';
import { DocumentViewer, DocumentViewerRef } from '../components/ContractAnalysis/DocumentViewer';

// ===> ACTION 3 : CORRIGER L'IMPORT ICI
import { EnhancedClauseDetail, clearEnhancedClauseCaches } from '../components/ContractAnalysis/EnhancedClauseDetail/EnhancedClauseDetail';
import { ActionButtons } from '../components/ContractAnalysis/ActionButtons';
import { ContextualAnalysisForm } from '../components/ContractAnalysis/ContextualAnalysisForm';
import React, { Suspense } from 'react';
const MarketComparison = React.lazy(() => import('../components/ContractAnalysis/MarketComparison').then(m => ({ default: m.MarketComparison })));
import { useContractAnalysis } from '../hooks/useContractAnalysis';
import { useRiskStats } from '../hooks/useRiskStats';
import { useShareUrl } from '../hooks/useShareUrl';
import { useAppliedRecommendationsStore } from '../store/appliedRecommendationsStore';
import { useDocumentTextStore } from '../store/documentTextStore';
import { modernHighlighter } from '../utils/modernHighlighter';

// ---------------------------------------------------------------------
// SUPPRIMER LA FONCTION DÉPLACÉE PAR ERREUR (elle existe déjà en utils)
// ---------------------------------------------------------------------

export default function ContractAnalysis() {


  const location = useLocation();

  // États locaux
  const [selectedClause, setSelectedClause] = useState<string | null>(null);
  const [showAnalysisForm, setShowAnalysisForm] = useState(false);
  //const [contextualAnalysis, setContextualAnalysis] = useState<any>(null);
  const [reviewedClauses, setReviewedClauses] = useState<Set<string>>(new Set());
  const [showMarketAnalysis, setShowMarketAnalysis] = useState(false);

  // Store pour les recommandations appliquées
  const { clearAllAppliedRecommendations } = useAppliedRecommendationsStore();

  // Ref pour contrôler le DocumentViewer
  const documentViewerRef = useRef<DocumentViewerRef>(null);
  const [recommendationIndex, setRecommandationIndex] = useState<number>(0)
  const handleIncrementIndexRecommendation = () => setRecommandationIndex((prev) => prev + 1)
  const setOriginalText = useDocumentTextStore(s => s.setOriginalText);
  const resetAllPatches = useDocumentTextStore(s => s.resetAll);

  // Hook principal pour l'analyse des contrats
  const {
    contract,
    isProcessing,
    processingPhase,
    currentAnalysisContext,
    marketAnalysis,
    isMarketAnalysisLoading,
    handleFileUpload,
    handleTextSubmit,
    handleStandardAnalysis,
    handleContextualAnalysis,
    handleMarketAnalysis,
    resetAnalysis,
  } = useContractAnalysis();




  // Statistiques de risque supprimées (plus de tableau de bord) – on garde seulement les clauses triées
  const { sortedClauses } = useRiskStats(contract);



  const { handleShareReport, loadSharedData } = useShareUrl(
    contract,
    reviewedClauses,
    (_, loadedReviewedClauses) => {
      // Cette fonction sera appelée quand des données partagées sont chargées
      setReviewedClauses(new Set(loadedReviewedClauses));
    }
  );


  // Chargement des données partagées au démarrage
  useEffect(() => {
    loadSharedData();
  }, [loadSharedData]);

  // Injection du texte original dans le nouveau store (étapes 1 & 2 – non invasif)
  useEffect(() => {
    if (contract?.content) {
      setOriginalText(contract.content);
    }
  }, [contract?.content, setOriginalText]);



  // Gestionnaires d'événements locaux (non extraits dans les hooks)
  const handleClauseClick = (clauseId: string) => {
    console.log('🚀 handleClauseClick appelé avec clauseId:', clauseId);


    if (documentViewerRef.current) {
      console.log('✅ Appel de scrollToClause...');
      documentViewerRef.current.scrollToClause(clauseId);
    }

    // Ouvrir la modale uniquement quand le scroll s'est stabilisé (plus fluide pour les longs articles)
    let lastScrollTime = Date.now();

    const onScroll = () => {
      lastScrollTime = Date.now();
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    const checkScrollStop = () => {
      if (Date.now() - lastScrollTime > 250) {
        window.removeEventListener('scroll', onScroll);
        console.log('📱 Ouverture de la modale (scroll terminé)');
        setSelectedClause(clauseId);
      } else {
        setTimeout(checkScrollStop, 150);
      }
    };

    // Lancer la vérification après un petit délai initial
    setTimeout(checkScrollStop, 300);
  };



  // Handler pour fermer la modale et revenir au début de la zone PDF
  const handleCloseModal = () => {
    console.log('🚪 Fermeture de la modale - Retour au début de la zone PDF');
    setSelectedClause(null);

    // Attendre un peu que la modale se ferme, puis aller au début de la zone PDF
    setTimeout(() => {
      console.log('📄 Retour au début de la zone PDF');
      const clausesSection = document.getElementById('clauses-section');
      if (clausesSection) {
        clausesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300); // Délai pour laisser la modale se fermer complètement

    setTimeout(() => {
      modernHighlighter.clearAllHighlights()
    }, 800)
  };




  const handleNewAnalysis = () => {
    console.log('🔄 Début de la nouvelle analyse');

    // Réinitialiser les recommandations appliquées EN PREMIER
    clearAllAppliedRecommendations();
    console.log('🧹 Recommandations appliquées réinitialisées');
    // Vider caches locaux (jurisprudence, textes, alternatives)
    clearEnhancedClauseCaches();

    // Puis réinitialiser le reste
    resetAnalysis();
    setSelectedClause(null);
    setShowAnalysisForm(false);
    setReviewedClauses(new Set());

    console.log('✅ Nouvelle analyse initialisée');
  };



  // Handlers avec intégration des hooks
  const onFileUpload = async (file: File) => {
    try {
      resetAllPatches();
      clearEnhancedClauseCaches();
      await handleFileUpload(file);
      setShowAnalysisForm(true);
      setSelectedClause(null);
    } catch (error) {
      console.error('Erreur upload:', error);
    }
  };

  // Déclenche automatiquement l'upload si un fichier est passé via navigation state (autre page)
  useEffect(() => {
    const file = (location.state as { file?: File } | null)?.file;
    if (file) {
      // Efface le state de navigation immédiatement : empêche un re-déclenchement si le
      // composant est remonté (Mode dev, refresh, retour navigateur, etc.)
      window.history.replaceState({}, '', window.location.pathname);
      onFileUpload(file);
    }
  // Tableau vide intentionnel : on veut s'exécuter une seule fois au montage.
  // Ajouter onFileUpload en dépendance causerait une boucle infinie (sa référence change à chaque render).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const onTextSubmit = async (text: string, fileName: string) => {
    try {
      resetAllPatches();
      clearEnhancedClauseCaches();
      await handleTextSubmit(text, fileName);
      setShowAnalysisForm(true);
      setSelectedClause(null);
    } catch (error) {
      console.error('Erreur soumission texte:', error);
    }
  };

  const onStandardAnalysis = async () => {
    try {
      resetAllPatches();
      clearEnhancedClauseCaches();
      await handleStandardAnalysis();
      setShowAnalysisForm(false);
    } catch (error) {
      console.error('Erreur analyse standard:', error);
    }
  };

  const onContextualAnalysis = async (context: any) => {
    // Timeout de sécurité pour éviter de rester bloqué
    const timeoutId = setTimeout(() => {
      console.log('⏰ Timeout de sécurité déclenché - forçage de setShowAnalysisForm(false)');
      setShowAnalysisForm(false);
    }, 60000); // 60 secondes maximum

    try {
      resetAllPatches();
      clearEnhancedClauseCaches();
      console.log('🚀 Début onContextualAnalysis avec contexte:', context);
      await handleContextualAnalysis(context);
      console.log('✅ handleContextualAnalysis terminé avec succès');
      setShowAnalysisForm(false);
      console.log('✅ setShowAnalysisForm(false) appelé');
      // TODO: Set contextual analysis result from hook response
    } catch (error) {
      console.error('❌ Erreur analyse contextuelle:', error);
      // IMPORTANT: Masquer le formulaire même en cas d'erreur pour éviter de rester bloqué
      setShowAnalysisForm(false);
      console.log('⚠️ setShowAnalysisForm(false) appelé après erreur');
    } finally {
      clearTimeout(timeoutId);
    }
  };





  const handleMarketAnalysisClick = async () => {
    try {
      // Si déjà calculée, on n'appelle pas à nouveau l'analyse
      if (marketAnalysis) {
        setShowMarketAnalysis(true);
        return;
      }
      await handleMarketAnalysis();
      setShowMarketAnalysis(true);
    } catch (error) {
      console.error('Erreur analyse de marché:', error);
    }
  };



  const handleQuestionClick = (question: string) => {
    // This function is now a placeholder, as the chat is in the modal.
    // You could use it to open the modal and pre-fill the chat with a question.
    console.log('Question clicked:', question);
  };



  // Fonction pour retourner à l'accueil
  const handleLogoClick = () => {
    console.log('🏠 Retour à l\'accueil');

    // Réinitialiser les recommandations appliquées
    resetAllPatches();
    clearEnhancedClauseCaches();

    // Réinitialiser le reste
    resetAnalysis();
    setSelectedClause(null);
    setReviewedClauses(new Set());
    setShowAnalysisForm(false);
  };


  const clauseData = contract?.clauses.find((c) => c.id === selectedClause);



  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        onLogoClick={handleLogoClick}
        onReanalyze={handleNewAnalysis}
        showReanalyze={!!contract}
      />

      <main className="container mx-auto px-4 py-8">
        {!contract && (
          <div className="max-w-4xl mx-auto text-center">
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
              <h1 className="text-4xl font-bold text-gray-800 mb-6">
                👩‍💼 Analyseur de Contrat IA
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Détectez automatiquement les clauses à risque avec notre IA spécialisée en droit français
              </p>

              <UploadZone
                onFileSelect={onFileUpload}
                onTextSubmit={onTextSubmit}
                isProcessing={isProcessing}
                processingPhase={processingPhase}
              />
            </div>
          </div>
        )}

        {showAnalysisForm && contract && !isProcessing && (
          <div className="max-w-4xl mx-auto mb-8">
            <ContextualAnalysisForm
              onSubmit={onContextualAnalysis}
              onSkip={onStandardAnalysis}
              extractedText={contract.content}
              isVisible={showAnalysisForm}
            />
          </div>
        )}

        {/* Zone de chargement pour l'analyse approfondie */}
        {isProcessing && (processingPhase === 'enhanced' || processingPhase === 'analysis' || processingPhase === 'scoring') && contract && (
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-white border border-blue-200 rounded-xl p-8 shadow-lg">
              {/* Barre de progression en temps réel */}
              <div className="mb-8">
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-400 via-purple-500 to-green-500 h-4 rounded-full transition-all duration-1000 ease-out relative">
                    {/* Animation de progression continue */}
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-40 animate-pulse"
                      style={{
                        animation: 'shimmer 2s ease-in-out infinite'
                      }}
                    ></div>
                    {/* Barre qui se remplit progressivement */}
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 via-purple-600 to-green-600 transition-all duration-500 ease-out"
                      style={{
                        width: '100%',
                        animation: 'fillProgress 15s ease-out forwards'
                      }}
                    ></div>
                  </div>
                </div>
                <div className="flex justify-center mt-3">
                  <span className="text-sm text-gray-700 font-medium">
                    {processingPhase === 'analysis' ? '🔍 Analyse des clauses...' :
                      processingPhase === 'scoring' ? '⚖️ Évaluation des risques...' :
                        '💡 Finalisation du rapport...'}
                  </span>
                </div>
              </div>

              {/* Messages professionnels qui tournent */}
              <div className="text-center text-sm text-slate-600">Analyse en cours…</div>
            </div>
          </div>
        )}

        {contract?.processed && !isProcessing && (
          <div className="max-w-7xl mx-auto">
            {/* Tableau de bord des risques supprimé (allègement UI) */}

            {/* Zone principale - Document avec sidebar intégrée */}
            <div id="clauses-section" className="mb-6">
              <div className="bg-white rounded-lg shadow-lg">
                {/* Message informatif si pas encore d'analyse */}
                {contract.clauses.length === 0 && (
                  <div className="p-4 bg-blue-50 border-b border-blue-200">
                    <div className="flex items-center gap-2 text-blue-800">
                      <span className="text-lg">📄</span>
                      <span className="font-medium">Texte extrait - En attente d'analyse</span>
                    </div>
                    <p className="text-sm text-blue-600 mt-1">
                      Le surlignage des clauses apparaîtra après l'analyse contextuelle ou standard
                    </p>
                  </div>
                )}

                <DocumentViewer
                  content={contract.content}
                  clauses={sortedClauses}
                  onClauseClick={handleClauseClick}
                  fileName={contract.fileName || 'Document'}
                  contractSummary={currentAnalysisContext ?? undefined}
                  recommendationIndex={recommendationIndex}
                  setRecommendationIndex={handleIncrementIndexRecommendation}
                  ref={documentViewerRef}
                />
              </div>
            </div>

            {/* Boutons d'action - Centrés */}
            <div className="flex justify-center">
              <ActionButtons
                onNewAnalysis={handleNewAnalysis}
                onShareReport={handleShareReport}
                onMarketAnalysis={handleMarketAnalysisClick}
                isMarketAnalysisLoading={isMarketAnalysisLoading}
                isProcessed={Boolean(contract?.processed)}
                analysisResult={marketAnalysis}
                onQuestionClick={handleQuestionClick}
              />
            </div>

          </div>
        )}
      </main>

      {/* Détails de la clause sélectionnée */}
      {selectedClause && clauseData && (
        <EnhancedClauseDetail
          clause={clauseData}
          context={currentAnalysisContext || undefined}
          onClose={handleCloseModal}
          recommendationIndex={recommendationIndex}
          setRecommendationIndex={handleIncrementIndexRecommendation}
        />

      )}



      {/* Analyse comparative de marché */}
      {showMarketAnalysis && marketAnalysis && currentAnalysisContext && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">📊 Analyse Comparative & Standards</h2>
              <button
                onClick={() => setShowMarketAnalysis(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <Suspense fallback={<div className="p-6 text-center text-sm text-gray-500">Chargement de l'analyse comparative...</div>}>
                <MarketComparison
                  analysisResult={marketAnalysis}
                  onQuestionClick={handleQuestionClick}
                  isLoading={isMarketAnalysisLoading}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      <Toaster position="top-right" />
    </div>
  );
}