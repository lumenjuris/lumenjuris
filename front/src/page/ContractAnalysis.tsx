import { useState, useEffect, useRef } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { UploadZone } from "../components/ContractAnalysis/UploadZone";
import {
  DocumentViewer,
  DocumentViewerRef,
} from "../components/ContractAnalysis/DocumentViewer";

import MainHeader from "../components/MainHeader/MainHeader";

// ===> ACTION 3 : CORRIGER L'IMPORT ICI
import {
  EnhancedClauseDetail,
} from "../components/ContractAnalysis/EnhancedClauseDetail/EnhancedClauseDetail";
import { clearEnhancedClauseCaches } from "../components/ContractAnalysis/EnhancedClauseDetail/enhancedClauseCaches";
import { ActionButtons } from "../components/ContractAnalysis/ActionButtons";
import { ContextualAnalysisForm } from "../components/ContractAnalysis/ContextualAnalysisForm";
import { DocumentHistorySidebar } from "../components/ContractAnalysis/DocumentHistorySidebar";
import React, { Suspense } from "react";
const MarketComparison = React.lazy(() =>
  import("../components/ContractAnalysis/MarketComparison").then((m) => ({
    default: m.MarketComparison,
  })),
);
import { useContractAnalysis } from "../hooks/useContractAnalysis";
import { useRiskStats } from "../hooks/useRiskStats";
import { useShareUrl } from "../hooks/useShareUrl";
import { useAppliedRecommendationsStore } from "../store/appliedRecommendationsStore";
import { useDocumentTextStore } from "../store/documentTextStore";
import type {
  AnalysisContext,
  EnterpriseAnalysisContext,
} from "../types/contextualAnalysis";
import type {
  ApiResponse,
  ConventionCollectiveOption,
  EnterpriseSettings,
} from "../types/paramSettings";
import type { AnalysisProgress } from "../utils/aiAnalyser/aiAnalyzer";
import {
  createContractHistoryId,
  createContractHistorySnapshot,
  deleteContractHistoryEntry,
  loadContractHistoryIndex,
  loadContractHistorySnapshot,
  saveContractHistorySnapshot,
  touchContractHistoryEntry,
} from "../utils/contractHistory";

import { useUserStore } from "../store/userStore";
import { fetchProxy } from "../utils/fetchProxy";
// ---------------------------------------------------------------------
// SUPPRIMER LA FONCTION DÉPLACÉE PAR ERREUR (elle existe déjà en utils)
// ---------------------------------------------------------------------

function getProcessingStatusLines(
  phase: string,
  analysisProgress?: AnalysisProgress | null,
): string[] {
  const lines: string[] = ["Préparation du document"];

  if (phase === "analysis" || phase === "scoring" || phase === "enhanced") {
    lines.push("Analyse des clauses");
  }

  if (analysisProgress?.totalChunks && analysisProgress.totalChunks > 1) {
    lines.push(
      `${analysisProgress.completedChunks}/${analysisProgress.totalChunks} partie(s) traitée(s)`,
    );
  }

  if ((analysisProgress?.currentAttempt ?? 1) > 1) {
    lines.push(
      `Essai ${analysisProgress?.currentAttempt}/${analysisProgress?.totalAttempts}`,
    );
  }

  if (phase === "scoring" || phase === "enhanced") {
    lines.push("Évaluation des risques");
  }

  if (phase === "enhanced") {
    lines.push("Finalisation du rapport");
  }

  if (analysisProgress?.message) {
    lines.push(analysisProgress.message);
  }

  return lines;
}

type EnterpriseGetData = EnterpriseSettings & {
  selectedIdcc?: ConventionCollectiveOption | null;
};

const consumedNavigationUploadKeys = new Set<string>();

function getFileUploadKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function cleanEnterpriseContextValue(value?: string | null): string | null {
  const cleanedValue = value?.trim();
  return cleanedValue ? cleanedValue : null;
}

function getSelectedConventionCollective(
  enterprise?: EnterpriseGetData | null,
): ConventionCollectiveOption | null {
  if (!enterprise) return null;

  if (enterprise.selectedIdcc) {
    return enterprise.selectedIdcc;
  }

  return (
    enterprise.idccSelections.find(
      (selection) => selection.key === enterprise.selectedIdccKey,
    ) ?? null
  );
}

function mapEnterpriseToAnalysisContext(
  enterprise?: EnterpriseGetData | null,
): EnterpriseAnalysisContext | undefined {
  const selectedConvention = getSelectedConventionCollective(enterprise);
  const enterpriseContext: EnterpriseAnalysisContext = {
    collectiveAgreement: cleanEnterpriseContextValue(selectedConvention?.name),
    companyLegalForm: cleanEnterpriseContextValue(enterprise?.statusJuridique),
  };

  return Object.values(enterpriseContext).some(Boolean)
    ? enterpriseContext
    : undefined;
}

export default function ContractAnalysis() {
  const location = useLocation();

  const { isConnected: userConnected } = useUserStore();

  // États locaux
  const [selectedClause, setSelectedClause] = useState<string | null>(null);
  const [showAnalysisForm, setShowAnalysisForm] = useState(false);
  //const [contextualAnalysis, setContextualAnalysis] = useState<any>(null);
  const [reviewedClauses, setReviewedClauses] = useState<Set<string>>(
    new Set(),
  );
  const [showMarketAnalysis, setShowMarketAnalysis] = useState(false);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const currentHistoryIdRef = useRef<string | null>(null);
  const [historyItems, setHistoryItems] = useState(() =>
    loadContractHistoryIndex(),
  );
  const [enterpriseContext, setEnterpriseContext] = useState<
    EnterpriseAnalysisContext | undefined
  >(undefined);
  const documentPreparationRef = useRef<string | null>(null);

  const setActiveHistoryId = (historyId: string | null) => {
    currentHistoryIdRef.current = historyId;
    setCurrentHistoryId(historyId);
  };

  useEffect(() => {
    const abortController = new AbortController();

    const loadEnterpriseContext = async () => {
      try {
        const response = await fetchProxy("/api/enterprise", {
          credentials: "include",
          signal: abortController.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | ApiResponse<EnterpriseGetData>
          | null;

        if (!response.ok || !payload?.success) {
          setEnterpriseContext(undefined);
          return;
        }

        setEnterpriseContext(mapEnterpriseToAnalysisContext(payload.data));
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        console.error(
          "Impossible de charger le contexte entreprise pour l'analyse.",
          error,
        );
        setEnterpriseContext(undefined);
      }
    };

    void loadEnterpriseContext();

    return () => {
      abortController.abort();
    };
  }, []);

  // Store pour les recommandations appliquées
  const { clearAllAppliedRecommendations } = useAppliedRecommendationsStore();
  const appliedRecommendations = useAppliedRecommendationsStore(
    (s) => s.appliedRecommendations,
  );
  const setAppliedRecommendations = useAppliedRecommendationsStore(
    (s) => s.setAppliedRecommendations,
  );

  // Ref pour contrôler le DocumentViewer
  const documentViewerRef = useRef<DocumentViewerRef>(null);
  const [recommendationIndex, setRecommandationIndex] = useState<number>(0);
  const handleIncrementIndexRecommendation = () =>
    setRecommandationIndex((prev) => prev + 1);
  const setOriginalText = useDocumentTextStore((s) => s.setOriginalText);
  const originalText = useDocumentTextStore((s) => s.originalText);
  const htmlContent = useDocumentTextStore((s) => s.htmlContent);
  const patches = useDocumentTextStore((s) => s.patches);
  const restoreDocumentState = useDocumentTextStore(
    (s) => s.restoreDocumentState,
  );
  const resetAllPatches = useDocumentTextStore((s) => s.resetAll);

  // Hook principal pour l'analyse des contrats
  const {
    contract,
    isProcessing,
    processingPhase,
    analysisProgress,
    currentAnalysisContext,
    marketAnalysis,
    isMarketAnalysisLoading,
    handleFileUpload,
    handleTextSubmit,
    handleStandardAnalysis,
    handleContextualAnalysis,
    handleMarketAnalysis,
    restoreAnalysis,
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
    },
  );

  // Chargement des données partagées au démarrage
  useEffect(() => {
    loadSharedData();
  }, [loadSharedData]);

  // Injection du texte original dans le nouveau store (étapes 1 & 2 – non invasif)
  useEffect(() => {
    if (contract?.content && originalText !== contract.content) {
      setOriginalText(contract.content);
    }
  }, [contract?.content, originalText, setOriginalText]);

  useEffect(() => {
    const activeHistoryId = currentHistoryIdRef.current;
    if (!contract || !activeHistoryId) return;

    const snapshot = createContractHistorySnapshot({
      id: activeHistoryId,
      contract,
      htmlContent,
      currentAnalysisContext,
      patches,
      appliedRecommendations,
      marketAnalysis,
      reviewedClauseIds: Array.from(reviewedClauses),
    });

    const savedItem = saveContractHistorySnapshot(snapshot);
    if (savedItem) {
      setHistoryItems(loadContractHistoryIndex());
    }
  }, [
    appliedRecommendations,
    contract,
    currentAnalysisContext,
    currentHistoryId,
    htmlContent,
    marketAnalysis,
    patches,
    reviewedClauses,
  ]);

  // Gestionnaires d'événements locaux (non extraits dans les hooks)
  const handleClauseClick = (clauseId: string) => {
    // Dimming immédiat + scroll
    setSelectedClause(clauseId);

    if (documentViewerRef.current) {
      documentViewerRef.current.scrollToClause(clauseId);
    }
  };

  // Handler pour fermer la modale et revenir au début de la zone PDF
  const handleCloseModal = () => {
    setSelectedClause(null);
  };

  const handleNewAnalysis = () => {
    console.log("🔄 Début de la nouvelle analyse");

    setActiveHistoryId(null);

    // Réinitialiser les recommandations appliquées EN PREMIER
    clearAllAppliedRecommendations();
    console.log("🧹 Recommandations appliquées réinitialisées");
    // Vider caches locaux (jurisprudence, textes, alternatives)
    clearEnhancedClauseCaches();

    // Puis réinitialiser le reste
    resetAnalysis();
    setSelectedClause(null);
    setShowAnalysisForm(false);
    setReviewedClauses(new Set());
    setShowMarketAnalysis(false);

    console.log("✅ Nouvelle analyse initialisée");
  };

  // Handlers avec intégration des hooks
  const onFileUpload = async (file: File) => {
    const preparationKey = `file:${getFileUploadKey(file)}`;

    if (documentPreparationRef.current) {
      console.warn("Upload ignoré: une préparation est déjà en cours.");
      return;
    }

    documentPreparationRef.current = preparationKey;
    const historyId = createContractHistoryId();

    try {
      setActiveHistoryId(null);
      resetAllPatches();
      clearEnhancedClauseCaches();
      await handleFileUpload(file);
      setActiveHistoryId(historyId);
      setShowAnalysisForm(true);
      setSelectedClause(null);
      setShowMarketAnalysis(false);
    } catch (error) {
      setActiveHistoryId(null);
      console.error("Erreur upload:", error);
    } finally {
      if (documentPreparationRef.current === preparationKey) {
        documentPreparationRef.current = null;
      }
    }
  };

  // Déclenche automatiquement l'upload si un fichier est passé via navigation state (autre page)
  useEffect(() => {
    const file = (location.state as { file?: File } | null)?.file;
    if (file) {
      const navigationUploadKey = `${location.key}:${getFileUploadKey(file)}`;

      if (consumedNavigationUploadKeys.has(navigationUploadKey)) {
        return;
      }

      consumedNavigationUploadKeys.add(navigationUploadKey);
      navigate(".", { replace: true, state: null });
      onFileUpload(file);
    }
    // Tableau vide intentionnel : on veut s'exécuter une seule fois au montage.
    // Ajouter onFileUpload en dépendance causerait une boucle infinie (sa référence change à chaque render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTextSubmit = async (text: string, fileName: string) => {
    const preparationKey = `text:${fileName}:${text.length}`;

    if (documentPreparationRef.current) {
      console.warn("Soumission ignorée: une préparation est déjà en cours.");
      return;
    }

    documentPreparationRef.current = preparationKey;
    const historyId = createContractHistoryId();

    try {
      setActiveHistoryId(null);
      resetAllPatches();
      clearEnhancedClauseCaches();
      await handleTextSubmit(text, fileName);
      setActiveHistoryId(historyId);
      setShowAnalysisForm(true);
      setSelectedClause(null);
      setShowMarketAnalysis(false);
    } catch (error) {
      setActiveHistoryId(null);
      console.error("Erreur soumission texte:", error);
    } finally {
      if (documentPreparationRef.current === preparationKey) {
        documentPreparationRef.current = null;
      }
    }
  };

  const onStandardAnalysis = async () => {
    try {
      resetAllPatches();
      clearEnhancedClauseCaches();
      await handleStandardAnalysis();
      setShowAnalysisForm(false);
    } catch (error) {
      console.error("Erreur analyse standard:", error);
    }
  };

  const onContextualAnalysis = async (context: AnalysisContext) => {
    try {
      resetAllPatches();
      clearEnhancedClauseCaches();
      const contextWithEnterprise: AnalysisContext = {
        ...context,
        enterpriseContext,
      };

      console.log(
        "🚀 Début onContextualAnalysis avec contexte:",
        contextWithEnterprise,
      );
      await handleContextualAnalysis(contextWithEnterprise);
      console.log("✅ handleContextualAnalysis terminé avec succès");
      setShowAnalysisForm(false);
      console.log("✅ setShowAnalysisForm(false) appelé");
      // TODO: Set contextual analysis result from hook response
    } catch (error) {
      console.error("❌ Erreur analyse contextuelle:", error);
      // IMPORTANT: Masquer le formulaire même en cas d'erreur pour éviter de rester bloqué
      setShowAnalysisForm(false);
      console.log("⚠️ setShowAnalysisForm(false) appelé après erreur");
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
      console.error("Erreur analyse de marché:", error);
    }
  };

  const handleQuestionClick = (question: string) => {
    // This function is now a placeholder, as the chat is in the modal.
    // You could use it to open the modal and pre-fill the chat with a question.
    console.log("Question clicked:", question);
  };

  // Fonction pour retourner à l'accueil
  const handleNavClick = () => {
    console.log("⚙️ Réinitialisation analyzer");

    setActiveHistoryId(null);

    // Réinitialiser les recommandations appliquées
    resetAllPatches();
    clearEnhancedClauseCaches();

    // Réinitialiser le reste
    resetAnalysis();
    setSelectedClause(null);
    setReviewedClauses(new Set());
    setShowAnalysisForm(false);
    setShowMarketAnalysis(false);
  };

  const handleOpenHistoryItem = (historyId: string) => {
    const snapshot = loadContractHistorySnapshot(historyId);
    if (!snapshot) {
      setHistoryItems(loadContractHistoryIndex());
      return;
    }

    setActiveHistoryId(null);
    clearEnhancedClauseCaches();
    setHistoryItems(touchContractHistoryEntry(historyId));
    setSelectedClause(null);
    setShowMarketAnalysis(false);
    setReviewedClauses(new Set(snapshot.reviewedClauseIds));
    setShowAnalysisForm(!snapshot.contract.processed);
    setRecommandationIndex(
      snapshot.appliedRecommendations.reduce(
        (max, recommendation) =>
          Math.max(max, recommendation.recommendationIndex),
        0,
      ),
    );

    restoreDocumentState({
      originalText: snapshot.contract.content,
      htmlContent: snapshot.htmlContent,
      patches: snapshot.patches,
    });
    setAppliedRecommendations(snapshot.appliedRecommendations);
    restoreAnalysis({
      contract: snapshot.contract,
      currentAnalysisContext: snapshot.currentAnalysisContext,
      marketAnalysis: snapshot.marketAnalysis,
    });
    setActiveHistoryId(historyId);
  };

  const handleDeleteHistoryItem = (historyId: string) => {
    if (!window.confirm("Supprimer ce document de l'historique ?")) return;

    const nextItems = deleteContractHistoryEntry(historyId);
    setHistoryItems(nextItems);

    if (historyId !== currentHistoryId) return;

    setActiveHistoryId(null);
    resetAllPatches();
    clearEnhancedClauseCaches();
    resetAnalysis();
    setSelectedClause(null);
    setReviewedClauses(new Set());
    setShowAnalysisForm(false);
    setShowMarketAnalysis(false);
  };

  const clauseData = contract?.clauses.find((c) => c.id === selectedClause);
  const processingStatusLines = getProcessingStatusLines(
    processingPhase,
    analysisProgress,
  );

  return !userConnected ? (
    <Navigate to="/inscription" />
  ) : (
    <div className="min-h-screen bg-gray-50">
      <MainHeader
        onNavClick={handleNavClick}
        onReanalyze={handleNewAnalysis}
        showReanalyze={!!contract}
      />

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <DocumentHistorySidebar
            items={historyItems}
            activeId={currentHistoryId}
            onOpen={handleOpenHistoryItem}
            onDelete={handleDeleteHistoryItem}
          />

          <div className="min-w-0 flex-1 w-full">
            {!contract && (
              <div className="max-w-4xl mx-auto text-center">
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
                  <h1 className="text-4xl font-bold text-gray-800 mb-6">
                    👩‍💼 Analyseur de Contrat IA
                  </h1>
                  <p className="text-lg text-gray-600 mb-8">
                    Détectez automatiquement les clauses à risque avec notre IA
                    spécialisée en droit français
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
            {isProcessing &&
              (processingPhase === "enhanced" ||
                processingPhase === "analysis" ||
                processingPhase === "scoring") &&
              contract && (
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
                              animation: "shimmer 2s ease-in-out infinite",
                            }}
                          ></div>
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 via-purple-600 to-green-600 transition-all duration-500 ease-out"
                            style={{
                              width: "100%",
                              animation: "fillProgress 15s ease-out forwards",
                            }}
                          ></div>
                        </div>
                      </div>
                      <div className="flex justify-center mt-3">
                        <span className="text-sm text-gray-700 font-medium">
                          {processingPhase === "analysis"
                            ? "🔍 Analyse des clauses..."
                            : processingPhase === "scoring"
                              ? "⚖️ Évaluation des risques..."
                              : "💡 Finalisation du rapport..."}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-slate-600">
                      {processingStatusLines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
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
                          <span className="font-medium">
                            Texte extrait - En attente d'analyse
                          </span>
                        </div>
                        <p className="text-sm text-blue-600 mt-1">
                          Le surlignage des clauses apparaîtra après l'analyse
                          contextuelle ou standard
                        </p>
                      </div>
                    )}

                    <DocumentViewer
                      content={contract.content}
                      clauses={sortedClauses}
                      onClauseClick={handleClauseClick}
                      fileName={contract.fileName || "Document"}
                      contractSummary={currentAnalysisContext ?? undefined}
                      recommendationIndex={recommendationIndex}
                      setRecommendationIndex={handleIncrementIndexRecommendation}
                      activeClauseId={selectedClause}
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
          </div>
        </div>
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
              <h2 className="text-xl font-bold text-gray-900">
                📊 Analyse Comparative & Standards
              </h2>
              <button
                onClick={() => setShowMarketAnalysis(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <Suspense
                fallback={
                  <div className="p-6 text-center text-sm text-gray-500">
                    Chargement de l'analyse comparative...
                  </div>
                }
              >
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
