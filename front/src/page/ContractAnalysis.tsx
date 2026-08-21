import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { UploadZone } from "../components/ContractAnalysis/UploadZone";
import { DocumentViewer, DocumentViewerRef } from "../components/ContractAnalysis/DocumentViewer";



// ===> ACTION 3 : CORRIGER L'IMPORT ICI
import { EnhancedClauseDetail } from "../components/ContractAnalysis/EnhancedClauseDetail/EnhancedClauseDetail";
import { clearEnhancedClauseCaches } from "../components/ContractAnalysis/EnhancedClauseDetail/enhancedClauseCaches";
import { ActionButtons } from "../components/ContractAnalysis/ActionButtons";
import { ContextualAnalysisForm } from "../components/ContractAnalysis/ContextualAnalysisForm";
import React, { Suspense } from "react";

const MarketComparison = React.lazy(() =>
  import("../components/ContractAnalysis/MarketComparison").then((m) => ({
    default: m.MarketComparison,
  })),
);

import { processContractAnalysisResults, useContractAnalysis } from "../hooks/useContractAnalysis";
import { useRiskStats } from "../hooks/useRiskStats";
import { useShareUrl } from "../hooks/useShareUrl";
import { useAppliedRecommendationsStore } from "../store/appliedRecommendationsStore";
import { useDocumentTextStore } from "../store/documentTextStore";
import type { ContractAnalysis, ClauseRisk } from "../types";
import type { AnalysisContext } from "../types/contextualAnalysis";
import type { AnalysisProgress } from "../types/analysisProgress";

import {
  createContractHistoryId,
  createContractHistorySnapshot,
  loadContractHistoryIndex,
  loadContractHistorySnapshot,
  saveContractHistorySnapshot,
  touchContractHistoryEntry,
} from "../utils/contractHistory";


import { fetchProxy } from "../utils/fetchProxy";
import { LoadingZoneAnalyzer } from "../components/common/LoadingZoneAnalyzer";
import { ClausesSidebar } from "../components/ContractAnalysis/ClausesSidebar";
import { isFeatureEnabled } from "../config/features";
import { useEnterpriseContext } from "../hooks/Analyzer/useEnterpriseContext";
import { useContractHistory, TemporaryHistoryEntry } from "../hooks/Analyzer/useContractHistory";

import { confirmLeavingUnfinishedAnalysis, RECENT_NAVIGATION_CONFIRM_MS, LEAVE_ANALYSIS_WARNING } from "../utils/aiAnalyser/confirmLeaving";
import { handleAppendClause } from "../utils/aiAnalyser/handleAppendClause";


const consumedNavigationUploadKeys = new Set<string>();

function getFileUploadKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function createTemporaryHistorySnapshot(entry: TemporaryHistoryEntry) {
  return createContractHistorySnapshot({
    id: entry.id,
    contract: entry.contract,
    htmlContent: entry.htmlContent,
    currentAnalysisContext: entry.currentAnalysisContext,
    patches: entry.patches,
    appliedRecommendations: entry.appliedRecommendations,
    marketAnalysis: entry.marketAnalysis,
    reviewedClauseIds: entry.reviewedClauseIds,
  });
}








// ─── Page principale ──────────────────────────────────────────────────────────
export default function ContractAnalysis() {
  const location = useLocation();
  const navigate = useNavigate();

  // Ã‰tats locaux
  const [selectedClause, setSelectedClause] = useState<string | null>(null);
  const [showAnalysisForm, setShowAnalysisForm] = useState(false);
  const [reviewedClauses, setReviewedClauses] = useState<Set<string>>(new Set());
  const [showMarketAnalysis, setShowMarketAnalysis] = useState(false);
  const currentHistoryIdRef = useRef<string | null>(null);
  const sidebarCollapsed = false;



  const { enterpriseContext } = useEnterpriseContext()  //Clef isLoading accessible au besoin d'UX
  const {
    currentHistoryId,
    temporaryHistoryEntriesRef,
    temporaryHistoryEntries,

    setCurrentHistoryId,
    setHistoryItems,

    updateTemporaryHistoryEntry,
    removeTemporaryHistoryEntry,
    rememberTemporaryContract,
  } = useContractHistory()



  const { clearAllAppliedRecommendations } = useAppliedRecommendationsStore();

  const documentPreparationRef = useRef<string | null>(null);
  const confirmedNavigationAtRef = useRef(0);

  const setActiveHistoryId = (historyId: string | null) => {
    currentHistoryIdRef.current = historyId;
    setCurrentHistoryId(historyId);
  };

  useEffect(() => {
    temporaryHistoryEntriesRef.current = temporaryHistoryEntries;
  }, [temporaryHistoryEntries]);






  // Store pour les recommandations appliquées
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
  // const setHtmlContent = useDocumentTextStore((s) => s.setHtmlContent);
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
    handleMarketAnalysis,
    restoreAnalysis,
  } = useContractAnalysis();

  const { sortedClauses } = useRiskStats(contract);

  const activeTemporaryEntry = currentHistoryId
    ? temporaryHistoryEntries[currentHistoryId]
    : undefined;
  const displayedIsProcessing =
    activeTemporaryEntry?.isProcessing ?? isProcessing;
  const displayedProcessingPhase =
    activeTemporaryEntry?.processingPhase ?? processingPhase;
  const displayedAnalysisProgress =
    activeTemporaryEntry?.analysisProgress ?? analysisProgress;







  const startTemporaryAnalysis = async (
    historyId: string,
    analysisType: "standard" | "contextual",
    context?: AnalysisContext,
  ) => {
    const entry = temporaryHistoryEntriesRef.current[historyId];
    if (!entry || entry.isProcessing) return;

    const baseContract = entry.contract;
    const analysisContext = analysisType === "contextual" ? context : undefined;

    updateTemporaryHistoryEntry(historyId, (currentEntry) => ({
      ...currentEntry,
      currentAnalysisContext: analysisContext ?? null,
      isProcessing: true,
      processingPhase: "analysis",
      analysisProgress: null,
    }));

    if (currentHistoryIdRef.current === historyId) {
      setShowAnalysisForm(false);
    }

    let contentToAnalyze = baseContract.content;

    if (entry.htmlContent) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(entry.htmlContent, "text/html");
      const plainText = doc.body.innerText || doc.body.textContent || baseContract.content;
      contentToAnalyze = plainText;
    }

    try {
      updateTemporaryHistoryEntry(historyId, (currentEntry) => ({
        ...currentEntry,
        analysisProgress: {
          mode: "direct",
          state: "running",
          currentAttempt: 1,
          totalAttempts: 3,
          totalChunks: 1,
          completedChunks: 0,
          successfulChunks: 0,
          failedChunks: 0,
          message: "Analyse du document en cours.",
        } satisfies AnalysisProgress,
        processingPhase: "analysis",
      }));

      const response = await fetchProxy("/api/analyzer/analyze-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: contentToAnalyze,
          context: analysisContext,
        }),
      });

      if (!response.ok)
        throw new Error(`Analyse échouée (${response.status})`);
      const data = (await response.json()) as {
        success: boolean;
        clauses: ClauseRisk[];
      };
      const analysisResults: ClauseRisk[] = data.clauses ?? [];

      const latestEntry = temporaryHistoryEntriesRef.current[historyId];
      if (!latestEntry) return;

      const contractToProcess = entry.htmlContent ? { ...baseContract, content: contentToAnalyze } : baseContract;

      const updatedContract = processContractAnalysisResults(
        contractToProcess,
        analysisResults,
        analysisType,
        analysisContext,
      );
      const completedEntry: TemporaryHistoryEntry = {
        ...latestEntry,
        contract: updatedContract,
        currentAnalysisContext: analysisContext ?? null,
        isProcessing: false,
        processingPhase: "enhanced",
        analysisProgress: null,
      };

      const savedItem = await saveContractHistorySnapshot(
        createTemporaryHistorySnapshot({
          ...completedEntry,
          htmlContent: completedEntry.htmlContent,
        }),
      );
      if (savedItem) {
        setHistoryItems(await loadContractHistoryIndex());
        removeTemporaryHistoryEntry(historyId);
      } else {
        updateTemporaryHistoryEntry(historyId, () => completedEntry);
      }

      if (currentHistoryIdRef.current === historyId) {
        restoreAnalysis({
          contract: updatedContract,
          currentAnalysisContext: completedEntry.currentAnalysisContext,
          marketAnalysis: completedEntry.marketAnalysis,
        });
        setShowAnalysisForm(false);

        fetchProxy("/api/billing/remove-credits", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ removeCredit: 100 }),
        }).catch(console.error);
      }
    } catch (error) {
      console.error("Erreur analyse:", error);
      if (!temporaryHistoryEntriesRef.current[historyId]) return;
      updateTemporaryHistoryEntry(historyId, (currentEntry) => ({
        ...currentEntry,
        isProcessing: false,
        processingPhase: "extraction",
        analysisProgress: null,
      }));

      if (currentHistoryIdRef.current === historyId) {
        setShowAnalysisForm(true);
      }
    }
  };









  const { handleShareReport, loadSharedData } = useShareUrl(contract, reviewedClauses, (_, loadedReviewedClauses) => {
    setReviewedClauses(new Set(loadedReviewedClauses));
  });

  useEffect(() => { loadSharedData() }, [loadSharedData]);

  useEffect(() => {
    if (contract?.content && originalText !== contract.content) {
      setOriginalText(contract.content);
    }
  }, [contract?.content, originalText, setOriginalText]);




  useEffect(() => {
    const activeHistoryId = currentHistoryIdRef.current;
    if (!contract || !activeHistoryId || !contract.processed) return;

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

    void saveContractHistorySnapshot(snapshot).then(async (savedItem) => {
      if (savedItem) setHistoryItems(await loadContractHistoryIndex());
    });
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



  const hasTemporaryUnfinishedAnalysis = Object.values(
    temporaryHistoryEntries,
  ).some((entry) => !entry.contract.processed || entry.isProcessing);
  const shouldWarnBeforeLeaving = Boolean(
    hasTemporaryUnfinishedAnalysis ||
    isProcessing ||
    (contract && (!contract.processed || showAnalysisForm)),
  );









  useEffect(() => {
    if (!shouldWarnBeforeLeaving) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const hasRecentlyConfirmed =
        Date.now() - confirmedNavigationAtRef.current <
        RECENT_NAVIGATION_CONFIRM_MS;
      if (hasRecentlyConfirmed) return;

      event.preventDefault();
      event.returnValue = LEAVE_ANALYSIS_WARNING;
      return LEAVE_ANALYSIS_WARNING;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [shouldWarnBeforeLeaving]);



  useEffect(() => {
    if (!shouldWarnBeforeLeaving) return;
    const handleDocumentLinkClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const targetAttribute = anchor.getAttribute("target");
      if (targetAttribute && targetAttribute !== "_self") return;

      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.href === window.location.href) return;

      if (window.confirm(LEAVE_ANALYSIS_WARNING)) {
        confirmedNavigationAtRef.current = Date.now();
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    };

    document.addEventListener("click", handleDocumentLinkClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentLinkClick, true);
    };
  }, [shouldWarnBeforeLeaving]);



  const handleClauseClick = (clauseId: string) => {
    setSelectedClause(clauseId);
    if (documentViewerRef.current) {
      documentViewerRef.current.scrollToClause(clauseId);
    }
  };

  const handleCloseModal = () => {
    setSelectedClause(null);
  };





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
      const preparedContract = await handleFileUpload(file);
      if (documentPreparationRef.current !== preparationKey) return;
      if (!preparedContract) return;
      rememberTemporaryContract(historyId, preparedContract);
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

  // Déclenche automatiquement l'analyse si un fichier OU un texte est passé via navigation state
  // (ex. depuis la génération de contrats : « Réviser (risques) »).
  useEffect(() => {
    const state = location.state as {
      file?: File;
      text?: string;
      fileName?: string;
      historyId?: string;
    } | null;
    if (state?.historyId) {
      // Ouverture d'une analyse depuis la liste d'historique (page Conformité).
      const historyId = state.historyId;
      navigate(".", { replace: true, state: null });
      void handleOpenHistoryItem(historyId);
    } else if (state?.file) {
      const navigationUploadKey = `${location.key}:${getFileUploadKey(state.file)}`;
      if (consumedNavigationUploadKeys.has(navigationUploadKey)) return;
      consumedNavigationUploadKeys.add(navigationUploadKey);
      navigate(".", { replace: true, state: null });
      onFileUpload(state.file);
    } else if (state?.text && state.text.trim()) {
      const fileName = state.fileName || "Contrat généré";
      const navigationTextKey = `${location.key}:text:${fileName}:${state.text.length}`;
      if (consumedNavigationUploadKeys.has(navigationTextKey)) return;
      consumedNavigationUploadKeys.add(navigationTextKey);
      navigate(".", { replace: true, state: null });
      void onTextSubmit(state.text, fileName);
    } else if (state?.historyId) {
      const navigationHistoryKey = `${location.key}:history:${state.historyId}`;
      if (consumedNavigationUploadKeys.has(navigationHistoryKey)) return;
      consumedNavigationUploadKeys.add(navigationHistoryKey);
      navigate(".", { replace: true, state: null });
      void handleOpenHistoryItem(state.historyId);
    }
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
      const preparedContract = await handleTextSubmit(text, fileName);
      if (documentPreparationRef.current !== preparationKey) return;
      if (!preparedContract) return;
      rememberTemporaryContract(historyId, preparedContract);
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





  const onStandardAnalysis = () => {
    const analysisHistoryId = currentHistoryIdRef.current;
    if (!analysisHistoryId || !contract) return;

    if (!temporaryHistoryEntriesRef.current[analysisHistoryId]) {
      rememberTemporaryContract(analysisHistoryId, contract);
    }

    resetAllPatches();
    clearEnhancedClauseCaches();
    void startTemporaryAnalysis(analysisHistoryId, "standard");
  };






  //Redemarrage d'une analyse en cas de crash
  const handleForceRelaunchAnalysis = () => {
    const analysisHistoryId = currentHistoryIdRef.current;
    if (!analysisHistoryId || !contract) return;

    const existingContext = currentAnalysisContext ?? undefined;
    if (!temporaryHistoryEntriesRef.current[analysisHistoryId]) {
      rememberTemporaryContract(analysisHistoryId, contract);
    }

    const liveHtmlContent = useDocumentTextStore.getState().htmlContent;
    updateTemporaryHistoryEntry(analysisHistoryId, (e) => ({
      ...e,
      htmlContent: liveHtmlContent
    }));

    clearAllAppliedRecommendations();
    resetAllPatches();
    clearEnhancedClauseCaches();

    updateTemporaryHistoryEntry(analysisHistoryId, (e) => ({
      ...e,
      isProcessing: false,
    }));

    void startTemporaryAnalysis(analysisHistoryId, existingContext ? "contextual" : "standard", existingContext);
  };





  const onContextualAnalysis = (context: AnalysisContext) => {
    const analysisHistoryId = currentHistoryIdRef.current;
    if (!analysisHistoryId || !contract) return;

    if (!temporaryHistoryEntriesRef.current[analysisHistoryId]) {
      rememberTemporaryContract(analysisHistoryId, contract);
    }

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
    void startTemporaryAnalysis(
      analysisHistoryId,
      "contextual",
      contextWithEnterprise,
    );
  };


  //Ouverture de la modale de l'analyse de marché 
  const handleMarketAnalysisClick = async () => {
    try {
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




  //Ouveerture d'un contract depuis la bdd qui a déjà été analysé
  const handleOpenHistoryItem = async (historyId: string) => {
    if (historyId === currentHistoryId) return;

    if (documentPreparationRef.current) {
      if (!confirmLeavingUnfinishedAnalysis(shouldWarnBeforeLeaving, confirmedNavigationAtRef)) return;
      documentPreparationRef.current = null;
    } else if (currentHistoryId) {
      const currentEntry = temporaryHistoryEntriesRef.current[currentHistoryId];
      if (
        currentEntry &&
        !currentEntry.isProcessing &&
        !currentEntry.contract.processed
      ) {
        if (!confirmLeavingUnfinishedAnalysis(shouldWarnBeforeLeaving, confirmedNavigationAtRef)) return;
        documentPreparationRef.current = null;
        removeTemporaryHistoryEntry(currentHistoryId);
      }
    }

    documentPreparationRef.current = null;

    const temporaryEntry = temporaryHistoryEntriesRef.current[historyId];
    if (temporaryEntry) {
      documentPreparationRef.current = null;
      setActiveHistoryId(null);
      clearEnhancedClauseCaches();
      setSelectedClause(null);
      setShowMarketAnalysis(false);
      setReviewedClauses(new Set(temporaryEntry.reviewedClauseIds));
      setShowAnalysisForm(
        !temporaryEntry.contract.processed && !temporaryEntry.isProcessing,
      );
      setRecommandationIndex(
        temporaryEntry.appliedRecommendations.reduce(
          (max, recommendation) =>
            Math.max(max, recommendation.recommendationIndex),
          0,
        ),
      );

      restoreDocumentState({
        originalText: temporaryEntry.contract.content,
        htmlContent: temporaryEntry.htmlContent,
        patches: temporaryEntry.patches,
      });
      setAppliedRecommendations(temporaryEntry.appliedRecommendations);
      restoreAnalysis({
        contract: temporaryEntry.contract,
        currentAnalysisContext: temporaryEntry.currentAnalysisContext,
        marketAnalysis: temporaryEntry.marketAnalysis,
      });
      setActiveHistoryId(historyId);
      return;
    }



    const snapshot = await loadContractHistorySnapshot(historyId);

    if (!snapshot) {
      setHistoryItems(await loadContractHistoryIndex());
      return;
    }

    documentPreparationRef.current = null;
    setActiveHistoryId(null);
    clearEnhancedClauseCaches();
    void touchContractHistoryEntry(historyId);
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





  const clauseData = contract?.clauses.find((c) => c.id === selectedClause);



/*
    RETOUR DU JSX
  */
  return (
    <>
      <div className="-m-5 lg:-m-7 px-4 py-8 overflow-x-hidden">
        <div className="min-w-0 w-full">
          {!contract && (
            <div className="max-w-5xl mx-auto space-y-8">
              <div className="mx-auto max-w-2xl text-center">
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  Analyse de contrat
                </h1>
                <p className="mt-2 text-sm text-gray-500">
                  Importez un document ou collez son contenu pour identifier les
                  clauses à risque en droit français.
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <UploadZone
                  onFileSelect={onFileUpload}
                  onTextSubmit={onTextSubmit}
                  isProcessing={displayedIsProcessing}
                  processingPhase={displayedProcessingPhase}
                  analyseCredit={9999}
                />
              </div>
            </div>
          )}

          {showAnalysisForm && contract && !displayedIsProcessing && (
            <div className="max-w-4xl mx-auto mb-8">
              <ContextualAnalysisForm
                onSubmit={onContextualAnalysis}
                onSkip={onStandardAnalysis}
                extractedText={contract.content}
                isVisible={showAnalysisForm}
              />
            </div>
          )}

          {/* Zone de chargement dynamique */}
          {displayedIsProcessing && contract && (
            <div className="max-w-4xl mx-auto mb-8">
              <LoadingZoneAnalyzer
                phase={displayedProcessingPhase}
                analysisProgress={displayedAnalysisProgress}
              />
            </div>
          )}

          {contract?.processed && !displayedIsProcessing && (
            <div className="max-w-7xl mx-auto space-y-6">
              
              <div className="bg-blue-primary text-white rounded-2xl p-6 shadow-sm text-center space-y-4">
                <div>
                  <h1 className="text-2xl font-bold">Analyse de conformité</h1>
                  <p className="text-sm text-slate-300 mt-1">
                    Vérifiez la conformité juridique de vos documents
                  </p>
                </div>

                <div className="flex justify-center items-center">
                  <ActionButtons
                    onShareReport={handleShareReport}
                    contract={contract}
                    context={currentAnalysisContext || undefined}
                    isProcessed={Boolean(contract?.processed)}
                    originalContent={contract?.content}
                    htmlContent={htmlContent}
                    fileName={contract?.fileName || "document"}
                    onRelaunchAnalysis={handleForceRelaunchAnalysis}
                    isRelaunchingAnalysis={displayedIsProcessing}
                    onSuggestedClauses={handleMarketAnalysisClick}
                    isLoadingSuggested={isMarketAnalysisLoading}
                  />
                </div>
              </div>

              {/* 2. Grille principale Document + Sidebar */}
              <div className="flex flex-col md:flex-row gap-6 items-start">
                
                {/* Zone Visualiseur de Document */}
                <div id="clauses-section" className="flex-1 w-full min-w-0">
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    {contract.clauses.length === 0 && (
                      <div className="p-4 bg-blue-50 border-b border-blue-200">
                        <div className="flex items-center gap-2 text-blue-800">
                          <span className="text-lg">🚀</span>
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
                      isFullscreen={sidebarCollapsed}
                      ref={documentViewerRef}
                    />
                  </div>
                </div>

                {/* Sidebar des risques à droite */}
                {isFeatureEnabled("ENABLE_CLAUSES_SIDEBAR") && (
                  <div className="w-full md:w-80 border-gray-200 flex-shrink-0">
                    <ClausesSidebar
                      clauses={sortedClauses}
                      onClauseClick={(clause) => handleClauseClick(clause.id)}
                      isVisible={true}
                      recommandationApplied={patches}
                    />
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>

      {selectedClause && clauseData && (
        <EnhancedClauseDetail
          clause={clauseData}
          context={currentAnalysisContext || undefined}
          onClose={handleCloseModal}
          recommendationIndex={recommendationIndex}
          setRecommendationIndex={handleIncrementIndexRecommendation}
          isSensitive={contract?.isSensitive ?? true}
        />
      )}

      {showMarketAnalysis && marketAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="px-8 py-6 border-b bg-blue-primary flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">
                Clauses Suggérées
              </h2>
              <button
                onClick={() => setShowMarketAnalysis(false)}
                className="text-white hover:text-gray-400 text-2xl"
              >
                X
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <Suspense
                fallback={
                  <div className="p-6 text-center text-sm text-gray-500">
                    Chargement des clauses suggérées...
                  </div>
                }
              >
                <MarketComparison
                  analysisResult={marketAnalysis}
                  isLoading={isMarketAnalysisLoading}
                  onAppendClause={handleAppendClause}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      <Toaster position="top-right" />
    </>
  );
}
