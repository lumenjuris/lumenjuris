import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, Navigate, useNavigate } from "react-router-dom";
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
import {
  processContractAnalysisResults,
  useContractAnalysis,
  type ProcessingPhase,
} from "../hooks/useContractAnalysis";
import { useRiskStats } from "../hooks/useRiskStats";
import { useShareUrl } from "../hooks/useShareUrl";
import { useAppliedRecommendationsStore } from "../store/appliedRecommendationsStore";
import type { AppliedRecommendation } from "../store/appliedRecommendationsStore";
import { useDocumentTextStore } from "../store/documentTextStore";
import type { TextPatch } from "../store/documentTextStore";
import type { ContractAnalysis as ContractAnalysisType } from "../types";
import type {
  AnalysisContext,
  EnterpriseAnalysisContext,
} from "../types/contextualAnalysis";
import type {
  ApiResponse,
  ConventionCollectiveOption,
  EnterpriseSettings,
} from "../types/paramSettings";
import {
  analyzeContractWithAI,
  type AnalysisProgress,
} from "../utils/aiAnalyser/aiAnalyzer";
import {
  compareByUploadTimeDesc,
  createContractHistoryId,
  createContractHistoryPreviewItem,
  createContractHistorySnapshot,
  deleteContractHistoryEntry,
  loadContractHistoryIndex,
  loadContractHistorySnapshot,
  saveContractHistorySnapshot,
  touchContractHistoryEntry,
  type ContractHistoryItem,
} from "../utils/contractHistory";
import type { MarketAnalysisResult } from "../utils/marketAnalysis";

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

type TemporaryHistoryEntry = {
  id: string;
  contract: ContractAnalysisType;
  htmlContent: string | null;
  currentAnalysisContext: AnalysisContext | null;
  patches: TextPatch[];
  appliedRecommendations: AppliedRecommendation[];
  marketAnalysis: MarketAnalysisResult | null;
  reviewedClauseIds: string[];
  isProcessing: boolean;
  processingPhase: ProcessingPhase;
  analysisProgress: AnalysisProgress | null;
};

const consumedNavigationUploadKeys = new Set<string>();
const LEAVE_ANALYSIS_WARNING =
  "Une analyse est en cours ou n'a pas été finalisée. Si vous quittez cette page, elle sera abandonnée.";
const RECENT_NAVIGATION_CONFIRM_MS = 500;

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
  const navigate = useNavigate();

  const { isConnected: userConnected, fetchUser } = useUserStore();
  const [hasCheckedUser, setHasCheckedUser] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (userConnected) {
      setHasCheckedUser(true);
      return;
    }

    fetchUser().finally(() => {
      if (isMounted) {
        setHasCheckedUser(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [fetchUser, userConnected]);

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
  const [historyItems, setHistoryItems] = useState<ContractHistoryItem[]>([]);

  useEffect(() => {
    loadContractHistoryIndex().then(setHistoryItems).catch(() => {});
  }, []);
  const [temporaryHistoryEntries, setTemporaryHistoryEntries] = useState<
    Record<string, TemporaryHistoryEntry>
  >({});
  const temporaryHistoryEntriesRef = useRef<
    Record<string, TemporaryHistoryEntry>
  >({});
  const [enterpriseContext, setEnterpriseContext] = useState<
    EnterpriseAnalysisContext | undefined
  >(undefined);
  const documentPreparationRef = useRef<string | null>(null);
  const confirmedNavigationAtRef = useRef(0);

  const setActiveHistoryId = (historyId: string | null) => {
    currentHistoryIdRef.current = historyId;
    setCurrentHistoryId(historyId);
  };

  useEffect(() => {
    temporaryHistoryEntriesRef.current = temporaryHistoryEntries;
  }, [temporaryHistoryEntries]);

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
    handleMarketAnalysis,
    restoreAnalysis,
    resetAnalysis,
  } = useContractAnalysis();

  // Statistiques de risque supprimées (plus de tableau de bord) – on garde seulement les clauses triées
  const { sortedClauses } = useRiskStats(contract);

  const activeTemporaryEntry = currentHistoryId
    ? temporaryHistoryEntries[currentHistoryId]
    : undefined;
  const displayedIsProcessing = activeTemporaryEntry?.isProcessing ?? isProcessing;
  const displayedProcessingPhase =
    activeTemporaryEntry?.processingPhase ?? processingPhase;
  const displayedAnalysisProgress =
    activeTemporaryEntry?.analysisProgress ?? analysisProgress;

  const visibleHistoryItems = useMemo(() => {
    const temporaryItems = Object.values(temporaryHistoryEntries).map((entry) =>
      createContractHistoryPreviewItem(
        createTemporaryHistorySnapshot(entry),
        historyItems.find((item) => item.id === entry.id),
      ),
    );
    const temporaryIds = new Set(temporaryItems.map((item) => item.id));

    return [...temporaryItems, ...historyItems.filter((item) => !temporaryIds.has(item.id))]
      .sort(compareByUploadTimeDesc);
  }, [historyItems, temporaryHistoryEntries]);

  const updateTemporaryHistoryEntry = (
    historyId: string,
    updater: (entry: TemporaryHistoryEntry) => TemporaryHistoryEntry,
  ) => {
    const currentRefEntry = temporaryHistoryEntriesRef.current[historyId];
    if (currentRefEntry) {
      temporaryHistoryEntriesRef.current = {
        ...temporaryHistoryEntriesRef.current,
        [historyId]: updater(currentRefEntry),
      };
    }

    setTemporaryHistoryEntries((previousEntries) => {
      const currentEntry = previousEntries[historyId];
      if (!currentEntry) return previousEntries;

      return {
        ...previousEntries,
        [historyId]: updater(currentEntry),
      };
    });
  };

  const removeTemporaryHistoryEntry = (historyId: string) => {
    if (temporaryHistoryEntriesRef.current[historyId]) {
      const nextRefEntries = { ...temporaryHistoryEntriesRef.current };
      delete nextRefEntries[historyId];
      temporaryHistoryEntriesRef.current = nextRefEntries;
    }

    setTemporaryHistoryEntries((previousEntries) => {
      if (!previousEntries[historyId]) return previousEntries;

      const nextEntries = { ...previousEntries };
      delete nextEntries[historyId];
      return nextEntries;
    });
  };

  const rememberTemporaryContract = (
    historyId: string,
    preparedContract: ContractAnalysisType,
  ) => {
    const documentState = useDocumentTextStore.getState();
    const recommendationState = useAppliedRecommendationsStore.getState();
    const entry: TemporaryHistoryEntry = {
      id: historyId,
      contract: preparedContract,
      htmlContent: documentState.htmlContent,
      currentAnalysisContext: null,
      patches: documentState.patches,
      appliedRecommendations: recommendationState.appliedRecommendations,
      marketAnalysis: null,
      reviewedClauseIds: [],
      isProcessing: false,
      processingPhase: "extraction",
      analysisProgress: null,
    };

    temporaryHistoryEntriesRef.current = {
      ...temporaryHistoryEntriesRef.current,
      [historyId]: entry,
    };

    setTemporaryHistoryEntries((previousEntries) => ({
      ...previousEntries,
      [historyId]: entry,
    }));
  };

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

    try {
      const analysisResults = await analyzeContractWithAI(
        baseContract.content,
        analysisContext,
        {
          onProgress: (progress) => {
            updateTemporaryHistoryEntry(historyId, (currentEntry) => ({
              ...currentEntry,
              analysisProgress: progress,
              processingPhase: "analysis",
            }));
          },
        },
      );

      const latestEntry = temporaryHistoryEntriesRef.current[historyId];
      if (!latestEntry) return;

      const updatedContract = processContractAnalysisResults(
        baseContract,
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

      // htmlContent intentionnellement null : resetAll() vide le htmlContent avant toute analyse,
      // donc le flux normal sauvegarde aussi avec null. Forcer null ici aligne le flux background
      // sur ce comportement -> au rechargement, DocumentViewer utilise le fallback formatContentToHtml
      // (qui fonctionne) plutôt que injectClausesIntoHtml (qui échoue sur le HTML brut Python).
      const savedItem = await saveContractHistorySnapshot(
        createTemporaryHistorySnapshot({ ...completedEntry, htmlContent: null }),
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

  const confirmLeavingUnfinishedAnalysis = () => {
    if (!shouldWarnBeforeLeaving) return true;

    const hasRecentlyConfirmed =
      Date.now() - confirmedNavigationAtRef.current <
      RECENT_NAVIGATION_CONFIRM_MS;
    if (hasRecentlyConfirmed) return true;

    const confirmed = window.confirm(LEAVE_ANALYSIS_WARNING);
    if (confirmed) {
      confirmedNavigationAtRef.current = Date.now();
    }

    return confirmed;
  };

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

  // Réinitialise tous les états locaux et stores (nouvelle analyse ou navigation)
  const resetPageState = () => {
    documentPreparationRef.current = null;
    temporaryHistoryEntriesRef.current = {};
    setTemporaryHistoryEntries({});
    setActiveHistoryId(null);
    // Vider les stores partagés (recommandations, patches, caches)
    clearAllAppliedRecommendations();
    resetAllPatches();
    clearEnhancedClauseCaches();
    // Réinitialiser le hook d'analyse et les états UI
    resetAnalysis();
    setSelectedClause(null);
    setShowAnalysisForm(false);
    setReviewedClauses(new Set());
    setShowMarketAnalysis(false);
  };

  const handleNewAnalysis = () => {
    if (!confirmLeavingUnfinishedAnalysis()) return;
    resetPageState();
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

  const handleNavClick = (event?: React.MouseEvent<HTMLElement>) => {
    if (!confirmLeavingUnfinishedAnalysis()) {
      event?.preventDefault();
      event?.stopPropagation();
      return false;
    }
    resetPageState();
    return true;
  };

  const handleOpenHistoryItem = async (historyId: string) => {
    if (historyId === currentHistoryId) return;

    // Gestion de l'entrée courante avant de changer de vue
    if (documentPreparationRef.current) {
      // Préparation PDF/texte en cours -> confirmation requise avant d'annuler
      if (!confirmLeavingUnfinishedAnalysis()) return;
      documentPreparationRef.current = null;
    } else if (currentHistoryId) {
      const currentEntry = temporaryHistoryEntriesRef.current[currentHistoryId];
      if (currentEntry && !currentEntry.isProcessing && !currentEntry.contract.processed) {
        // Formulaire en cours -> confirmation requise avant de supprimer
        if (!confirmLeavingUnfinishedAnalysis()) return;
        documentPreparationRef.current = null;
        removeTemporaryHistoryEntry(currentHistoryId);
      }
      // Si isProcessing: true -> analyse en fond, pas de dialogue, on laisse tourner
    }

    // Annule la phase de préparation en cours (les callbacks async abandonnent d'eux-mêmes)
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

  const handleDeleteHistoryItem = async (historyId: string) => {
    const isTemporaryItem = Boolean(
      temporaryHistoryEntriesRef.current[historyId],
    );
    const isDraftItem =
      isTemporaryItem ||
      (historyId === currentHistoryId && contract?.processed === false);
    const confirmMessage = isDraftItem
      ? "Abandonner cette analyse en cours ?"
      : "Supprimer ce document de l'historique ?";

    if (!window.confirm(confirmMessage)) return;

    if (isTemporaryItem) {
      removeTemporaryHistoryEntry(historyId);

      if (historyId !== currentHistoryId) return;

      setActiveHistoryId(null);
      resetAllPatches();
      clearEnhancedClauseCaches();
      resetAnalysis();
      setSelectedClause(null);
      setReviewedClauses(new Set());
      setShowAnalysisForm(false);
      setShowMarketAnalysis(false);
      return;
    }

    await deleteContractHistoryEntry(historyId);
    setHistoryItems(await loadContractHistoryIndex());

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
    displayedProcessingPhase,
    displayedAnalysisProgress,
  );

  if (!hasCheckedUser && !userConnected) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MainHeader />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
            Chargement de l'analyseur...
          </div>
        </main>
      </div>
    );
  }

  return !userConnected ? (
    <Navigate to="/inscription" replace />
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
            items={visibleHistoryItems}
            activeId={currentHistoryId}
            onOpen={handleOpenHistoryItem}
            onDelete={handleDeleteHistoryItem}
          />

          <div className="min-w-0 flex-1 w-full">
            {!contract && (
              <div className="max-w-5xl mx-auto space-y-8">
                <div className="mx-auto max-w-2xl text-center">
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    Analyse de contrat
                  </h1>
                  <p className="mt-2 text-sm text-gray-500">
                    Importez un document ou collez son contenu pour identifier
                    les clauses à risque en droit français.
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

                  <UploadZone
                    onFileSelect={onFileUpload}
                    onTextSubmit={onTextSubmit}
                    isProcessing={displayedIsProcessing}
                    processingPhase={displayedProcessingPhase}
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

        {/* Zone de chargement pour l'analyse approfondie */}
            {displayedIsProcessing &&
              (displayedProcessingPhase === "enhanced" ||
                displayedProcessingPhase === "analysis" ||
                displayedProcessingPhase === "scoring") &&
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
                          {displayedProcessingPhase === "analysis"
                            ? "🔍 Analyse des clauses..."
                            : displayedProcessingPhase === "scoring"
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

            {contract?.processed && !displayedIsProcessing && (
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
