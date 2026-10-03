import { create } from "zustand";
import { ClauseRecommendation, ClauseRisk } from "../types";
import { downloadBlocksAsDocx, downloadBlocksAsPdf, toExportBaseName } from "../utils/exportContract";
import { htmlToBlocks, textToBlocks, type ContractBlock } from "../utils/contractBlocks";

export interface AppliedRecommendation {
  clauseId: string;
  recommendationIndex: number;
  recommendation: ClauseRecommendation;
  appliedAt: Date;
  originalClause: ClauseRisk;
}

interface AppliedRecommendationsState {
  appliedRecommendations: AppliedRecommendation[];

  getAllRecommendation: () => AppliedRecommendation[];
  setAppliedRecommendations: (items: AppliedRecommendation[]) => void;

  applyRecommendation: (
    clauseId: string,
    recommendationIndex: number,
    recommendation: ClauseRecommendation,
    originalClause: ClauseRisk,
  ) => void;
  removeAppliedRecommendation: (
    clauseId: string,
    recommendationIndex: number,
  ) => void;
  isRecommendationApplied: (
    clauseId: string,
    recommendationIndex: number,
  ) => boolean;
  clearAllAppliedRecommendations: () => void;
  hasAnyAppliedRecommendations: () => boolean;
  generateWordDocument: (originalContent?: string, fileName?: string, htmlContent?: string, displayedHtml?: string | null) => void;
  generatePDFDocument: (originalContent?: string, fileName?: string, htmlContent?: string, displayedHtml?: string | null) => void;
}

// Applique chaque recommandation au contenu via regex tolérante aux espaces multiples/retours ligne.
// Fallback sur remplacement simple si la regex ne matche pas (cas exact unique).
function applyRecommendationsToContent(
  original: string,
  recommendations: AppliedRecommendation[],
): string {
  return recommendations.reduce((content, applied) => {
    const originalClauseText = applied.originalClause.content;
    const newClauseText = applied.recommendation.clauseText;
    if (!originalClauseText) return content;
    const escaped = originalClauseText
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+");
    const re = new RegExp(escaped, "g");
    return re.test(content)
      ? content.replace(re, newClauseText)
      : content.replace(originalClauseText, newClauseText);
  }, original);
}

/**
 * Contenu à exporter, du plus fidèle au moins fidèle : le contrat tel qu'affiché
 * (mise en forme d'origine + recommandations appliquées), sinon le texte d'origine
 * avec les recommandations, sinon le HTML extrait, sinon le texte brut.
 */
function exportBlocksOf(
  appliedRecommendations: AppliedRecommendation[],
  originalContent?: string,
  htmlContent?: string,
  displayedHtml?: string | null,
): ContractBlock[] | null {
  if (displayedHtml) return htmlToBlocks(displayedHtml);
  if (appliedRecommendations.length > 0 && originalContent) {
    return textToBlocks(applyRecommendationsToContent(originalContent, appliedRecommendations));
  }
  if (htmlContent) return htmlToBlocks(htmlContent);
  return originalContent ? textToBlocks(originalContent) : null;
}

export const useAppliedRecommendationsStore =
  create<AppliedRecommendationsState>()((set, get) => ({
    appliedRecommendations: [],

    getAllRecommendation: () => {
      return get().appliedRecommendations;
    },

    setAppliedRecommendations: (items) => {
      set({
        appliedRecommendations: items.map((item) => ({
          ...item,
          appliedAt: new Date(item.appliedAt),
        })),
      });
    },

    /**
     * Ajout dans la collection des appliedRecommendations.
     * @param clauseId - L'id de la clause sur laquelle on applique la modification
     * @param recommendationIndex -Index de la nouvelle recommendation
     * @param recommendation - Le nouveau texte de la clause
     * @param originalClause - Le text d'origine de la clause
     */
    applyRecommendation: (
      clauseId,
      recommendationIndex,
      recommendation,
      originalClause,
    ) => {
      set((state) => ({
        appliedRecommendations: [
          ...state.appliedRecommendations,
          {
            clauseId,
            recommendationIndex,
            recommendation,
            appliedAt: new Date(),
            originalClause,
          },
        ],
      }));
    },

    removeAppliedRecommendation: (clauseId, recommendationIndex) => {
      set((state) => ({
        appliedRecommendations: state.appliedRecommendations.filter(
          (applied) =>
            !(
              applied.clauseId === clauseId &&
              applied.recommendationIndex === recommendationIndex
            ),
        ),
      }));
    },

    isRecommendationApplied: (clauseId, recommendationIndex) => {
      return get().appliedRecommendations.some(
        (applied) =>
          applied.clauseId === clauseId &&
          applied.recommendationIndex === recommendationIndex,
      );
    },

    clearAllAppliedRecommendations: () => {
      set({ appliedRecommendations: [] });
    },

    hasAnyAppliedRecommendations: () => {
      return get().appliedRecommendations.length > 0;
    },

    // Word et PDF : même contenu et même mise en page (utils/exportContract.ts).
    generateWordDocument: async (originalContent, fileName, htmlContent, displayedHtml) => {
      const blocks = exportBlocksOf(get().appliedRecommendations, originalContent, htmlContent, displayedHtml);
      if (blocks) await downloadBlocksAsDocx("", blocks, toExportBaseName(fileName));
    },

    generatePDFDocument: async (originalContent, fileName, htmlContent, displayedHtml) => {
      const blocks = exportBlocksOf(get().appliedRecommendations, originalContent, htmlContent, displayedHtml);
      if (blocks) downloadBlocksAsPdf("", blocks, toExportBaseName(fileName));
    },
  }));
