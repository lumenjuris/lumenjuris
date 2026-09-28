import { create } from "zustand";
import { ClauseRecommendation, ClauseRisk } from "../types";
import { downloadTextAsPdf, toExportBaseName } from "../utils/exportContract";

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

    generateWordDocument: async (
      originalContent?: string,
      fileName?: string,
      htmlContent?: string,
    ) => {
      if (!originalContent && !htmlContent) return;

      const appliedRecommendations = get().appliedRecommendations;
      const baseName = fileName ? fileName.replace(/\.[^/.]+$/, "") : "document";

      try {
        const docx = await import("docx");
        const { saveAs } = await import("file-saver");
        const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;

        const BLOCK_TAGS = new Set(["h1","h2","h3","h4","h5","h6","p","li","blockquote","pre","hr","table","tr","td","th"]);
        const INLINE_TAGS = new Set(["span","a","strong","b","em","i","u","s","mark","code","small","sup","sub","label"]);
        const CONTAINER_TAGS = new Set(["div","section","article","main","header","footer","ul","ol","body","figure","figcaption"]);

        // Collecte tous les runs inline d'un nœud (récursif)
        function nodeToRuns(node: Node, bold = false, italic = false, underline = false): InstanceType<typeof TextRun>[] {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = (node.textContent || "").replace(/\n/g, " ").replace(/\s{2,}/g, " ");
            if (!text.trim()) return [];
            return [new TextRun({ text, bold, italic, underline: underline ? {} : undefined })];
          }
          if (node.nodeType !== Node.ELEMENT_NODE) return [];
          const el = node as HTMLElement;
          const tag = el.tagName.toLowerCase();
          const isBold = bold || tag === "strong" || tag === "b";
          const isItalic = italic || tag === "em" || tag === "i";
          const isUnderline = underline || tag === "u";
          return Array.from(el.childNodes).flatMap((c) => nodeToRuns(c, isBold, isItalic, isUnderline));
        }

        // Vérifie si un élément contient au moins un enfant block-level
        function hasBlockChild(el: HTMLElement): boolean {
          return Array.from(el.children).some((c) => BLOCK_TAGS.has(c.tagName.toLowerCase()) || CONTAINER_TAGS.has(c.tagName.toLowerCase()));
        }

        function htmlToDocxParagraphs(html: string): InstanceType<typeof Paragraph>[] {
          const parser = new DOMParser();
          const parsed = parser.parseFromString(html, "text/html");
          const paragraphs: InstanceType<typeof Paragraph>[] = [];

          function pushParagraph(el: HTMLElement, opts?: { heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]; bullet?: boolean }): void {
            const runs = nodeToRuns(el);
            const text = el.textContent?.replace(/\n/g, " ").replace(/\s{2,}/g, " ").trim() || "";
            if (!text) return;
            if (opts?.heading !== undefined) {
              paragraphs.push(new Paragraph({ text, heading: opts.heading, spacing: { before: 200, after: 100 } }));
            } else if (opts?.bullet) {
              paragraphs.push(new Paragraph({ children: runs.length ? runs : [new TextRun({ text })], bullet: { level: 0 }, spacing: { after: 80 } }));
            } else {
              paragraphs.push(new Paragraph({ children: runs.length ? runs : [new TextRun({ text })], spacing: { after: 120 } }));
            }
          }

          function processNode(node: Node): void {
            if (node.nodeType === Node.TEXT_NODE) {
              const text = (node.textContent || "").replace(/\n/g, " ").trim();
              if (text) paragraphs.push(new Paragraph({ children: [new TextRun({ text })], spacing: { after: 80 } }));
              return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const el = node as HTMLElement;
            const tag = el.tagName.toLowerCase();

            if (tag === "h1") { pushParagraph(el, { heading: HeadingLevel.HEADING_1 }); }
            else if (tag === "h2") { pushParagraph(el, { heading: HeadingLevel.HEADING_2 }); }
            else if (tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") { pushParagraph(el, { heading: HeadingLevel.HEADING_3 }); }
            else if (tag === "p") { pushParagraph(el); }
            else if (tag === "li") { pushParagraph(el, { bullet: true }); }
            else if (tag === "hr") { paragraphs.push(new Paragraph({ text: "", spacing: { before: 100, after: 100 } })); }
            else if (CONTAINER_TAGS.has(tag)) {
              // Si le div/section contient des blocs enfants, on descend dedans
              if (hasBlockChild(el)) {
                Array.from(el.childNodes).forEach(processNode);
              } else {
                // Div avec uniquement du texte/spans inline → un seul paragraphe
                pushParagraph(el);
              }
            } else if (INLINE_TAGS.has(tag)) {
              // Span/a orphelin au niveau racine → paragraphe simple
              pushParagraph(el);
            }
          }

          Array.from(parsed.body.childNodes).forEach(processNode);
          return paragraphs;
        }

        // Texte brut → paragraphes en respectant les doubles sauts de ligne
        function textToDocxParagraphs(text: string): InstanceType<typeof Paragraph>[] {
          return text
            .split(/\n{2,}/)
            .map((block) => block.replace(/\n/g, " ").replace(/\s{2,}/g, " ").trim())
            .filter(Boolean)
            .map((line) => new Paragraph({ children: [new TextRun({ text: line })], spacing: { after: 160 } }));
        }

        let children: InstanceType<typeof Paragraph>[];

        if (htmlContent) {
          if (appliedRecommendations.length > 0 && originalContent) {
            const modifiedText = applyRecommendationsToContent(originalContent, appliedRecommendations);
            children = textToDocxParagraphs(modifiedText);
          } else {
            children = htmlToDocxParagraphs(htmlContent);
          }
        } else if (originalContent) {
          const exportText = appliedRecommendations.length > 0
            ? applyRecommendationsToContent(originalContent, appliedRecommendations)
            : originalContent;
          children = textToDocxParagraphs(exportText);
        } else {
          return;
        }

        const wordDoc = new Document({
          styles: {
            default: {
              document: {
                run: { font: "Calibri", size: 22 },
                paragraph: { spacing: { line: 276 } },
              },
            },
          },
          sections: [{
            properties: {
              page: {
                margin: { top: 1440, bottom: 1440, left: 1800, right: 1800 },
              },
            },
            children,
          }],
        });

        const blob = await docx.Packer.toBlob(wordDoc);
        saveAs(blob, `${baseName}.docx`);
      } catch (error) {
        console.error("Erreur lors de la génération du document Word:", error);
        const fallbackText = originalContent || "";
        const blob = new Blob([fallbackText], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseName}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    },

    // Même contenu que l'export Word (recommandations appliquées, clauses ajoutées),
    // mis en page comme le PDF envoyé en signature.
    generatePDFDocument: async (
      originalContent?: string,
      fileName?: string,
      htmlContent?: string,
    ) => {
      const appliedRecommendations = get().appliedRecommendations;
      let exportText: string;
      if (htmlContent && !(appliedRecommendations.length > 0 && originalContent)) {
        exportText = htmlToPlainText(htmlContent);
      } else if (originalContent) {
        exportText = appliedRecommendations.length > 0
          ? applyRecommendationsToContent(originalContent, appliedRecommendations)
          : originalContent;
      } else {
        return;
      }

      const baseName = toExportBaseName(fileName);
      downloadTextAsPdf(baseName, exportText, baseName);
    },
  }));
