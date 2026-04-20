/* ------------------------------------------------------------------
   🧠 AI ANALYZER V2.4 - ANALYSE CONTEXTUELLE AUTOMATIQUE
   ------------------------------------------------------------------ 
*/

import { ClauseRisk } from "../../types";
import { AnalysisContext } from "../../types/contextualAnalysis";
import { callOpenAI, callOpenAi52 } from "../aiClient";

import { saveAnalysisToCache, loadAnalysisFromCache } from "./cachedAnalysis";
import { parseAIResponse, createSmartChunks } from "./parsingData";
import { buildClauseExtractionPromptForAI } from "./buildingPrompt";

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
      },
    );
  }

  const estimatedTokens = Math.ceil(content.length / 4);
  console.log(`📊 Estimation tokens: ~${estimatedTokens} tokens`);

  if (content.length > 30000) {
    console.warn(
      "⚠️ ATTENTION: Contrat très long, analyse en sections multiples",
    );
  }

  const cached = loadAnalysisFromCache(content, context);
  if (cached && cached.length > 0) {
    console.log("🗂️ Analyse servie depuis le cache (sessionStorage)");
    return cached;
  }

  try {
    console.log(`📄 Taille du contenu: ${content.length} caractères`);
    const timeStart = Date.now();
    let clauses: ClauseRisk[] = [];

    for (let i = 0; i < 3; i++) {
      const retryState: boolean = i > 1; //=> declanche le changement de prompt template dans le building du prompt pour analyse

      if (content.length >= 25000) {
        console.log(
          `🔄 Document long détecté - Analyse par sections intelligentes`,
        );
        clauses = await analyzeLongContractIntelligently(
          content,
          context,
          retryState,
        );
      } else if (content.length > 12000) {
        console.log(
          `⚠️ Document moyen - Division en chunks optimisés avec retry automatique`,
        );
        clauses = await analyzeWithOptimizedChunking(
          content,
          8000,
          context,
          retryState,
        );
      } else {
        console.log(`📁 Document court - Analyse directe avec GPT-4o`);
        clauses = await analyzeDirectlyWithGPT4(content, context, retryState);
      }

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
 * 🚀 ANALYSE DIRECTE - Document court avec GPT-4o length < 12000
 */
async function analyzeDirectlyWithGPT4(
  content: string,
  context?: AnalysisContext,
  retryState?: boolean,
): Promise<ClauseRisk[]> {
  console.log("🎯 Analyse directe avec GPT-4o (haute capacité)");

  const analysisPrompt = buildClauseExtractionPromptForAI(
    "CONTRAT À ANALYSER:",
    content,
    context,
    retryState,
  );

  const responseText = await callOpenAI(
    [
      {
        role: "system",
        content:
          "Vous êtes un expert juridique. Identifiez toutes les clauses à risque. Terminez toujours vos phrases complètement.",
      },
      { role: "user", content: analysisPrompt },
    ],
    {
      model: "gpt-4o",
      max_tokens: 8192,
      temperature: 0.25,
      response_format: { type: "json_object" },
    },
  );
  return parseAIResponse(responseText);
}

async function analyzeWithOptimizedChunking(
  content: string,
  chunkSize: number,
  context?: AnalysisContext,
  retryState?: boolean,
): Promise<ClauseRisk[]> {
  console.log("Lancement de l'analyse avec gpt-5.2");
  const reasoning = "none";
  const verbosity = "low";
  const chunks = createSmartChunks(content, chunkSize);

  const promises = chunks.map(async (chunk, i) => {
    const chunkPrompt = buildClauseExtractionPromptForAI(
      `PARTIE ${i + 1}/${chunks.length}`,
      chunk,
      context,
      retryState,
    );
    return callOpenAi52(chunkPrompt, reasoning, verbosity)
      .then((r) => {
        return parseAIResponse(r);
      })
      .catch((err) => {
        console.warn(
          `Une erreur est survenue lors de l'analyse des clauses par l'ia sur le chunk ${i + 1}, error : ${err}`,
        );
        return [];
      });
  });

  const result = await Promise.all(promises);
  if (!result) return [];
  const allClauses: ClauseRisk[] = result.flat();
  console.log("Fin de l'analyse, les clauses récupérés : ", allClauses);
  return allClauses;
}

/**
 * 🎯 ANALYSE LONGUE - Document très long
 */
async function analyzeLongContractIntelligently(
  content: string,
  context?: AnalysisContext,
  retryState?: boolean,
): Promise<ClauseRisk[]> {
  console.log("🎯 Analyse intelligente de document long");
  const clauses = await analyzeWithOptimizedChunking(
    content,
    20000,
    context,
    retryState,
  );

  const uniqueClausesMap = new Map<string, ClauseRisk>();
  for (const clause of clauses) {
    const key = `${clause.type}:${clause.content.substring(0, 50)}`;
    if (!uniqueClausesMap.has(key)) {
      uniqueClausesMap.set(key, clause);
    }
  }
  return Array.from(uniqueClausesMap.values()).sort(
    (a, b) => b.riskScore - a.riskScore,
  );
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
