/* hooks/useContractAnalysis.ts
 * Hook personnalisé pour la gestion de l'analyse des contrats
 * Extrait la logique métier de App.tsx
 */

import { useState, useCallback } from "react";
import { ContractAnalysis } from "../types";
import { AnalysisContext } from "../types/contextualAnalysis";
import { extractDocumentContent } from "../utils/documentExtractor";
import { analyzeContractWithAI } from "../utils/aiAnalyser/aiAnalyzer";
import {
  performCompleteMarketAnalysis,
  MarketAnalysisResult,
} from "../utils/marketAnalysis";
import { useDocumentTextStore } from "../store/documentTextStore";
// import { triggerPostAnalysisJournal } from '../utils/analysisLogger';

export type ProcessingPhase =
  | "extraction"
  | "analysis"
  | "scoring"
  | "report"
  | "contextual"
  | "enhanced";

interface UseContractAnalysisReturn {
  contract: ContractAnalysis | null;
  isProcessing: boolean;
  processingPhase: ProcessingPhase;
  currentAnalysisContext: AnalysisContext | null;
  marketAnalysis: MarketAnalysisResult | null;
  isMarketAnalysisLoading: boolean;
  handleFileUpload: (file: File) => Promise<void>;
  handleTextSubmit: (text: string, fileName: string) => Promise<void>;
  handleStandardAnalysis: () => Promise<void>;
  handleContextualAnalysis: (context: AnalysisContext) => Promise<void>;
  handleMarketAnalysis: () => Promise<void>;
  resetAnalysis: () => void;
}

export const useContractAnalysis = (): UseContractAnalysisReturn => {
  const [contract, setContract] = useState<ContractAnalysis | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const setHtmlContent = useDocumentTextStore((s) => s.setHtmlContent);
  const [processingPhase, setProcessingPhase] =
    useState<ProcessingPhase>("extraction");
  const [currentAnalysisContext, setCurrentAnalysisContext] =
    useState<AnalysisContext | null>(null);
  const [marketAnalysis, setMarketAnalysis] =
    useState<MarketAnalysisResult | null>(null);
  const [isMarketAnalysisLoading, setIsMarketAnalysisLoading] = useState(false);

  const createBaseContract = useCallback(
    (
      fileName: string,
      content: string,
      extractionMethod: string = "direct_input",
      metadata?: any,
    ): ContractAnalysis => {
      return {
        id: Date.now().toString(),
        fileName,
        uploadDate: new Date(),
        content,
        clauses: [],
        overallRiskScore: 0,
        riskProfile: "conservative",
        processed: false,
        jurisdiction: "France",
        contractType: "",
        aiConfidenceScore: 0,
        reviewHistory: [],
        extractionMetadata: {
          pages: metadata?.pages ?? 1,
          wordCount: content.split(/\s+/).length,
          language: "fr",
          extractionMethod,
          fileSize: `${(content.length / 1024).toFixed(1)} KB`,
          extractionTime: metadata?.extraction_time ?? new Date().toISOString(),
          protectionDetected: metadata?.isProtected ?? false,
          isProtected: metadata?.isProtected ?? false,
          extractionQuality: metadata?.extractionQuality ?? "high",
          aiSummary: "",
        },
      };
    },
    [],
  );

  const processAnalysisResults = useCallback(
    (
      baseContract: ContractAnalysis,
      analysisResults: any[],
      analysisType: "standard" | "contextual",
      context?: AnalysisContext,
    ): ContractAnalysis => {
      const processedClauses = analysisResults.map((c) => ({
        ...c,
        category: (
          [
            "penalty",
            "termination",
            "responsibility",
            "confidentiality",
            "nonCompete",
            "warranty",
            "other",
          ] as const
        ).includes(c.category as any)
          ? (c.category as
              | "penalty"
              | "termination"
              | "responsibility"
              | "confidentiality"
              | "nonCompete"
              | "warranty"
              | "other")
          : "other",
      }));

      return {
        ...baseContract,
        clauses: processedClauses,
        overallRiskScore:
          analysisResults.reduce((sum, c) => sum + c.riskScore, 0) /
          analysisResults.length,
        contractType:
          analysisType === "contextual"
            ? "Contrat analysé avec contexte"
            : "Contrat analysé",
        processed: true,
        aiConfidenceScore: analysisType === "contextual" ? 90 : 85,
        extractionMetadata: {
          ...baseContract.extractionMetadata,
          wordCount: baseContract.extractionMetadata?.wordCount || 0,
          language: baseContract.extractionMetadata?.language || "fr",
          extractionMethod:
            baseContract.extractionMetadata?.extractionMethod || "text",
          fileSize: baseContract.extractionMetadata?.fileSize || "0KB",
          extractionTime:
            baseContract.extractionMetadata?.extractionTime || "0ms",
          aiSummary: `${analysisResults.length} clauses à risque identifiées${analysisType === "contextual" ? " avec contexte" : ""}`,
        },
        ...(analysisType === "contextual" && context
          ? {
              reponses_questions_mandant: {
                contractType: context.contractType,
                userRole: context.userRole,
                missionContext: context.missionContext || "",
                specificQuestions: context.specificQuestions,
              },
            }
          : {}),
      };
    },
    [],
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      // Log supprimé pour de meilleures performances

      setIsProcessing(true);
      setProcessingPhase("extraction");
      setContract(null);
      setCurrentAnalysisContext(null);

      try {
        const extractedContent = await extractDocumentContent(file);
        setHtmlContent(extractedContent.html);

        const tempContract = createBaseContract(
          file.name,
          extractedContent.text,
          extractedContent.metadata?.extraction_method ?? "ocr",
          {
            pages: extractedContent.metadata?.pages ?? 0,
            extraction_time: extractedContent.metadata?.extraction_time,
            isProtected: extractedContent.isProtected,
            extractionQuality: extractedContent.extractionQuality,
          },
        );

        setContract(tempContract);
        // Log supprimé pour de meilleures performances
      } catch (err) {
        console.error("Erreur lors de l'extraction:", err);
        throw new Error(
          "Échec de l'extraction du texte. Assurez-vous que le PDF n'est pas protégé et réessayez.",
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [createBaseContract],
  );

  const handleTextSubmit = useCallback(
    async (text: string, fileName: string) => {
      console.log(
        "📝 Soumission de texte direct:",
        fileName,
        text.length,
        "caractères",
      );

      setIsProcessing(false);
      setContract(null);
      setCurrentAnalysisContext(null);

      try {
        const tempContract = createBaseContract(fileName, text);
        setContract(tempContract);
        console.log("✅ Texte préparé, formulaire prêt");
      } catch (error) {
        console.error("❌ Erreur lors de la préparation du texte:", error);
        throw new Error(
          "Erreur lors de la préparation du texte. Veuillez réessayer.",
        );
      }
    },
    [createBaseContract],
  );

  const handleStandardAnalysis = useCallback(async () => {
    if (!contract) return;

    setIsProcessing(true);
    setProcessingPhase("analysis");

    try {
      console.log("Lancement de l'analyse standard...");

      setProcessingPhase("scoring");
      const basicAnalysis = await analyzeContractWithAI(contract.content);

      const updatedContract = processAnalysisResults(
        contract,
        basicAnalysis,
        "standard",
      );
      setContract(updatedContract);

      console.log("Analyse standard terminée avec succès");
    } catch (error) {
      console.error("Erreur lors de l'analyse standard:", error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [contract, processAnalysisResults]);

  const handleContextualAnalysis = useCallback(
    async (context: AnalysisContext) => {
      if (!contract) return;

      console.log("🔄 handleContextualAnalysis démarré");
      setIsProcessing(true);
      setProcessingPhase("enhanced");
      setCurrentAnalysisContext(context);

      // Timeout de sécurité pour éviter de rester bloqué
      const timeoutId = setTimeout(() => {
        console.log(
          "⏰ Timeout de sécurité dans handleContextualAnalysis - forçage de setIsProcessing(false)",
        );
        setIsProcessing(false);
      }, 120000); // 2 minutes maximum

      try {
        console.log(
          "Démarrage de l'analyse personnalisée avec contexte:",
          context,
        );

        setProcessingPhase("analysis");
        console.log("📊 Phase: analysis");
        const enhancedAnalysis = await analyzeContractWithAI(
          contract.content,
          context,
        );

        setProcessingPhase("scoring");
        console.log("📊 Phase: scoring");
        const updatedContract = processAnalysisResults(
          contract,
          enhancedAnalysis,
          "contextual",
          context,
        );
        setContract(updatedContract);

        setProcessingPhase("enhanced");
        console.log("📊 Phase: enhanced");

        console.log(
          "✅ Analyse personnalisée terminée avec",
          enhancedAnalysis.length,
          "clauses détectées",
        );

        // triggerPostAnalysisJournal({
        //   documentName: contract.fileName || 'Document sans nom',
        //   clauses: enhancedAnalysis,
        //   highlightedCount: enhancedAnalysis.length,
        //   analysisTime: Date.now() - new Date().getTime(),
        // });
      } catch (error) {
        console.error("❌ Erreur lors de l'analyse personnalisée:", error);
        throw new Error(
          "Erreur lors de l'analyse personnalisée. Veuillez réessayer.",
        );
      } finally {
        clearTimeout(timeoutId);
        console.log(
          "🏁 handleContextualAnalysis finally - setIsProcessing(false)",
        );
        setIsProcessing(false);
      }
    },
    [contract, processAnalysisResults],
  );

  const handleMarketAnalysis = useCallback(async () => {
    if (!contract || !currentAnalysisContext) {
      throw new Error(
        "Contrat et contexte d'analyse requis pour l'analyse de marché",
      );
    }

    setIsMarketAnalysisLoading(true);

    try {
      console.log("🔍 Lancement de l'analyse comparative de marché...");

      const marketResult = await performCompleteMarketAnalysis(
        contract.content,
        currentAnalysisContext.contractType,
        contract.clauses,
      );

      setMarketAnalysis(marketResult);
      console.log("✅ Analyse de marché terminée:", marketResult);
    } catch (error) {
      console.error("❌ Erreur lors de l'analyse de marché:", error);
      throw new Error(
        "Erreur lors de l'analyse comparative. Veuillez réessayer.",
      );
    } finally {
      setIsMarketAnalysisLoading(false);
    }
  }, [contract, currentAnalysisContext]);

  const resetAnalysis = useCallback(() => {
    setContract(null);
    setCurrentAnalysisContext(null);
    setMarketAnalysis(null);
    setIsProcessing(false);
    setIsMarketAnalysisLoading(false);
    setProcessingPhase("extraction");
    setHtmlContent(null);
  }, [setHtmlContent]);

  return {
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
  };
};
