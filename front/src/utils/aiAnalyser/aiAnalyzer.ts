/* ------------------------------------------------------------------
   🧠 AI ANALYZER V2.4 - ANALYSE CONTEXTUELLE AUTOMATIQUE
   ------------------------------------------------------------------ 
*/

import { ClauseRisk } from "../../types";
import { AnalysisContext } from "../../types/contextualAnalysis";
import { callOpenAi52 } from "../aiClient";

import { saveAnalysisToCache, loadAnalysisFromCache } from "./cachedAnalysis";
import { parseAIResponse } from "./parsingData";
import { buildClauseExtractionPromptForAI } from "./buildingPrompt";

export type AnalysisProgressMode =
  | "direct"
  | "fallback"
  | "cached";

export type AnalysisProgressState = "running" | "completed" | "error";

export interface AnalysisProgress {
  mode: AnalysisProgressMode;
  state: AnalysisProgressState;
  currentAttempt: number;
  totalAttempts: number;
  totalChunks: number;
  completedChunks: number;
  successfulChunks: number;
  failedChunks: number;
  message: string;
}

export interface AnalyzeContractOptions {
  onProgress?: (progress: AnalysisProgress) => void;
}

interface AnalysisProgressContext {
  onProgress?: (progress: AnalysisProgress) => void;
  currentAttempt: number;
  totalAttempts: number;
}

/**
 * 🎯 ANALYSE PRINCIPALE - API OpenAI
 * Prend le texte du contrat et déclenche l'analyse des clauses à risque.
 * Utilise automatiquement une analyse contextuelle si un contexte est fourni.
 *
 * @param {string} content - Texte brut du contrat à analyser
 * @param {AnalysisContext} [context] - Contexte optionnel de l'analyse
 * @returns {Promise<ClauseRisk[]>} Liste des clauses à risque détectées
 */
export async function analyzeContractWithAI(
  content: string,
  context?: AnalysisContext,
  options?: AnalyzeContractOptions,
): Promise<ClauseRisk[]> {
  console.log(`🧠 === ANALYSE IA OPENAI DÉMARRE ===`);
  console.log(`📄 Contenu: ${content.length} caractères`);
  console.log("🛑🛑 CONTENU :", content.slice(0, 1000));

  if (context) {
    console.log(
      "%c🧩 Contexte utilisateur fourni - ANALYSE CONTEXTUELLE ACTIVÉE",
      "background:purple; border-radius:5px; padding:6px; font-size:1.2em; color:white",
      {
        contractType: context.contractType,
        userRole: context.userRole,
        orientation: context.interestOrientation,
        mission: context.missionContext || context.mission,
        questions: context.specificQuestions?.slice(0, 120),
        regimeLegal: context.legalRegime,
        contractObjective: context.contractObjective,
        enterpriseContext: context.enterpriseContext,
      },
    );
  }

  const estimatedTokens = Math.ceil(content.length / 4);
  console.log(`📊 Estimation tokens: ~${estimatedTokens} tokens`);

  if (content.length > 30000) {
    console.warn(
      "⚠️ ATTENTION: Contrat très long, envoi du document complet en une seule requête OpenAI.",
    );
  }

  const cached = loadAnalysisFromCache(content, context);
  if (cached && cached.length > 0) {
    console.log("🗂️ Analyse servie depuis le cache (sessionStorage)");
    emitAnalysisProgress(options?.onProgress, {
      mode: "cached",
      state: "completed",
      currentAttempt: 1,
      totalAttempts: 1,
      totalChunks: 1,
      completedChunks: 1,
      successfulChunks: 1,
      failedChunks: 0,
      message: "Analyse prête.",
    });
    return cached;
  }

  try {
    console.log(`📄 Taille du contenu: ${content.length} caractères`);
    const timeStart = Date.now();
    let clauses: ClauseRisk[] = [];
    const totalAttempts = 3;

    for (let i = 0; i < totalAttempts; i++) {
      const retryState: boolean = i > 1; //=> declanche le changement de prompt template dans le building du prompt pour analyse
      const progressContext: AnalysisProgressContext = {
        onProgress: options?.onProgress,
        currentAttempt: i + 1,
        totalAttempts,
      };

      console.log(`📁 Analyse directe du document complet avec GPT-5.2`);
      clauses = await analyzeDirectlyWithGPT52(
        content,
        context,
        retryState,
        progressContext,
      );

      if (clauses.length > 0) break;
    }

    // si clauses est toujours vide, contrat considéré parfait
    if (clauses.length === 0) {
      console.log("✅ Contrat parfait, aucune clause à risque détectée.");
    }

    saveAnalysisToCache(content, clauses, context);

    const timeEnd = Date.now();
    const timeProcess = (timeEnd - timeStart) / 1000;
    console.log(
      "temps de process de l'analyse des clauses : ",
      timeProcess,
      "s",
    );

    return clauses;
  } catch (error) {
    console.error("❌ Erreur lors de l'analyse OpenAI:", error);
    console.log("🔄 Fallback vers analyse locale...");
    return analyzeContractLocally(content);
  }
}

/**
 * 🚀 ANALYSE DIRECTE - Document complet avec GPT-5.2
 */
async function analyzeDirectlyWithGPT52(
  content: string,
  context?: AnalysisContext,
  retryState?: boolean,
  progressContext?: AnalysisProgressContext,
): Promise<ClauseRisk[]> {
  console.log("🎯 Analyse directe avec GPT-5.2");
  const reasoning = "none";
  const verbosity = "low";
  emitAnalysisProgress(progressContext?.onProgress, {
    mode: "direct",
    state: "running",
    currentAttempt: progressContext?.currentAttempt ?? 1,
    totalAttempts: progressContext?.totalAttempts ?? 1,
    totalChunks: 1,
    completedChunks: 0,
    successfulChunks: 0,
    failedChunks: 0,
    message: "Analyse du document en cours.",
  });

  const analysisPrompt = buildClauseExtractionPromptForAI(
    "CONTRAT À ANALYSER:",
    content,
    context,
    retryState,
  );

  const responseText = await callOpenAi52(
    analysisPrompt,
    reasoning,
    verbosity,
  );
  const clauses = parseAIResponse(responseText);
  emitAnalysisProgress(progressContext?.onProgress, {
    mode: "direct",
    state: "completed",
    currentAttempt: progressContext?.currentAttempt ?? 1,
    totalAttempts: progressContext?.totalAttempts ?? 1,
    totalChunks: 1,
    completedChunks: 1,
    successfulChunks: 1,
    failedChunks: 0,
    message: `Analyse terminée : ${clauses.length} clause(s).`,
  });
  return clauses;
}

/**
 * 🔄 ANALYSE LOCALE (Fallback)
 * En cas d'echec de l'analayse déclanchement de ce fallback qui utilise des patterns pour detecter des clauses à risque
 *
 * @param { string } content - Le contrat en texte brut
 * @returns {Promise<ClauseRisk[]>} Liste des clauses à risque détectées
 */
async function analyzeContractLocally(content: string): Promise<ClauseRisk[]> {
  console.log("🏠 Analyse locale de secours...");

  const localClauses: ClauseRisk[] = [];
  const riskPatterns = [
    {
      pattern: /pénalité|pénalités/gi,
      type: "Clause pénale",
      category: "penalty" as const,
      riskScore: 4,
    },
    {
      pattern: /résiliation|résilie|résilier/gi,
      type: "Résiliation",
      category: "termination" as const,
      riskScore: 3,
    },
    {
      pattern: /responsabilité|responsable/gi,
      type: "Responsabilité",
      category: "responsibility" as const,
      riskScore: 3,
    },
    {
      pattern: /confidentialité|confidentiel/gi,
      type: "Confidentialité",
      category: "confidentiality" as const,
      riskScore: 2,
    },
  ];

  riskPatterns.forEach((risk, index) => {
    if (content.match(risk.pattern)) {
      localClauses.push({
        id: `local-${index}-${Date.now()}`,
        type: risk.type,
        content: `Clause ${risk.type.toLowerCase()} détectée`,
        riskScore: risk.riskScore,
        category: risk.category,
        justification: "Détection par analyse locale",
        suggestion: "Révision recommandée",
        page: 1,
        keywords: [risk.type.toLowerCase()],
      });
    }
  });

  console.log(`✅ Analyse locale terminée: ${localClauses.length} clauses`);
  return localClauses;
}

function emitAnalysisProgress(
  onProgress: ((progress: AnalysisProgress) => void) | undefined,
  progress: AnalysisProgress,
) {
  onProgress?.(progress);
}
