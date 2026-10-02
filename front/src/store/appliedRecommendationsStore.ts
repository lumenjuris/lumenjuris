import { create } from "zustand";
import { ClauseRecommendation, ClauseRisk } from "../types";
import { downloadTextAsDocx, downloadTextAsPdf, toExportBaseName } from "../utils/exportContract";

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
  generateWordDocument: (originalContent?: string, fileName?: string, htmlContent?: string) => void;
  generatePDFDocument: (originalContent?: string, fileName?: string, htmlContent?: string) => void;
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

// Texte d'un contenu HTML : un bloc (paragraphe, titre, élément de liste) par paragraphe.
function htmlToPlainText(html: string): string {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  const blocks = Array.from(parsed.body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,tr"))
    .filter((el) => !el.parentElement?.closest("h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,tr"))
    .map((el) => (el.textContent || "").trim())
    .filter(Boolean);
  return blocks.length ? blocks.join("\n\n") : (parsed.body.textContent || "").trim();
}

/** Texte à exporter : le contenu affiché (HTML), ou l'original avec les recommandations appliquées. */
function exportTextOf(
  appliedRecommendations: AppliedRecommendation[],
  originalContent?: string,
  htmlContent?: string,
): string | null {
  if (appliedRecommendations.length > 0 && originalContent) {
    return applyRecommendationsToContent(originalContent, appliedRecommendations);
  }
  if (htmlContent) return htmlToPlainText(htmlContent);
  return originalContent || null;
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

    // Word et PDF : même texte (recommandations appliquées, clauses ajoutées) et
    // même mise en forme (titres, paragraphes, listes reconstruits par textToBlocks).
    generateWordDocument: async (originalContent, fileName, htmlContent) => {
      const exportText = exportTextOf(get().appliedRecommendations, originalContent, htmlContent);
      if (exportText) await downloadTextAsDocx("", exportText, toExportBaseName(fileName));
    },

    generatePDFDocument: async (originalContent, fileName, htmlContent) => {
      const exportText = exportTextOf(get().appliedRecommendations, originalContent, htmlContent);
      if (exportText) downloadTextAsPdf("", exportText, toExportBaseName(fileName));
    },
  }));
