import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
  useEffect,
} from "react";
import { motion } from "framer-motion";
import { Info } from "lucide-react";
import { ClauseRisk } from "../../types";
import { ClausesSidebar } from "./ClausesSidebar";
import { isFeatureEnabled } from "../../config/features";
import { useDocumentTextStore } from "../../store/documentTextStore";
import { AnalysisContext } from "../../types/contextualAnalysis";
import { findBestClauseSpan } from "../../utils/textPatchLocator";
import { formatContentToHtml } from "../../utils/documentViewerTools/formatContentToHtml";
import { injectClausesIntoHtml } from "../../utils/documentViewerTools/injectClausesIntoHtml";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Mark, mergeAttributes } from "@tiptap/core";

// Extension TipTap personnalisée pour les spans de clauses
// Elle préserve <span data-clause-risk-id="..."> à travers le schéma ProseMirror
const ClauseMark = Mark.create({
  name: "clauseMark",

  addAttributes() {
    return {
      clauseId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-clause-risk-id"),
        renderHTML: (attrs) =>
          attrs.clauseId ? { "data-clause-risk-id": attrs.clauseId } : {},
      },
      style: {
        default: null,
        parseHTML: (el) => el.getAttribute("style"),
        renderHTML: (attrs) => (attrs.style ? { style: attrs.style } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-clause-risk-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
});

interface DocumentViewerProps {
  content: string;
  clauses: ClauseRisk[];
  onClauseClick: (clauseId: string) => void;
  fileName: string;
  contractSummary?: AnalysisContext;
  recommendationIndex: number;
  setRecommendationIndex: (number: number) => void;
  activeClauseId: string | null;
}

export interface DocumentViewerRef {
  scrollToClause: (clauseId: string) => void;
}

export const DocumentViewer = forwardRef<
  DocumentViewerRef,
  DocumentViewerProps
>(
  (
    {
      content,
      clauses,
      onClauseClick,
      fileName,
      contractSummary,
      recommendationIndex: _recommendationIndex,
      setRecommendationIndex: _setRecommendationIndex,
      activeClauseId,
    },
    ref,
  ) => {
    const documentRef = useRef<HTMLDivElement>(null);
    const showSidebar = isFeatureEnabled("ENABLE_CLAUSES_SIDEBAR");
    const originalText = useDocumentTextStore((s) => s.originalText);
    const patches = useDocumentTextStore((s) => s.patches);
    const htmlContent = useDocumentTextStore((s) => s.htmlContent);
    const setHtmlContent = useDocumentTextStore((s) => s.setHtmlContent);
    const resetAll = useDocumentTextStore((s) => s.resetAll);
    const activePatchCount = useMemo(
      () => patches.filter((p) => p.active).length,
      [patches],
    );
    const effectiveOriginal =
      originalText && originalText.length > 0 ? originalText : content;
    const displayedText = effectiveOriginal;
    const analysisContextRows = useMemo(() => {
      if (!contractSummary) return [];

      const rows = [
        ["Le type du contrat", contractSummary.contractType],
        ["Secteur d'activité", contractSummary.industry],
        ["Votre rôle", contractSummary.userRole],
        [
          "Contexte de la mission",
          contractSummary.mission || contractSummary.missionContext,
        ],
      ];

      return rows.filter((row): row is [string, string] =>
        Boolean(row[1]?.trim()),
      );
    }, [contractSummary]);

    const [_editingClauseId, setEditingClauseId] = useState<string | null>(
      null,
    );

    const lastClick = useRef(0);

    const handleClickSpanClause = (clauseId: string) => {
      const delayDoubleClick = 250;
      const now = Date.now();
      const diff = now - lastClick.current;
      lastClick.current = now;

      const targetClause = clauses.find((c) => c.id === clauseId);
      if (!targetClause) return;

      if (diff < delayDoubleClick) {
        console.log("Activation de l'édition d'une clause dans le texte");
        setEditingClauseId(clauseId);
        return;
      }

      setTimeout(() => {
        if (Date.now() - lastClick.current >= delayDoubleClick) {
          onClauseClick(clauseId);
        }
      }, delayDoubleClick);
    };

    const scrollAndHighlightClause = (clause: ClauseRisk) => {
      if (!documentRef.current || !clause.id) return;
      const span = documentRef.current.querySelector(`[data-clause-risk-id="${clause.id}"]`);
      if (span) {
        span.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    useImperativeHandle(ref, () => ({
      scrollToClause: (clauseId: string) => {
        const clause = clauses.find((c) => c.id === clauseId);
        if (clause) scrollAndHighlightClause(clause);
      },
    }));

    const handleSidebarClauseClick = (clause: ClauseRisk, _index: number) => {
      onClauseClick(clause.id);
    };


    
    // Construction du HTML à rendre dans TipTap
    const htmlFormattedContent = useMemo(() => {
      if (htmlContent) {
        return injectClausesIntoHtml(htmlContent, clauses, patches);
      }
      // Fallback : construction depuis le texte brut (PDF.js ou OCR)
      const rangeClauseRisk: any[] = [];
      clauses.forEach((clause) => {
        const range = findBestClauseSpan(displayedText, clause);
        rangeClauseRisk.push({ ...range, clauseId: clause.id });
      });
      rangeClauseRisk.sort((a, b) => a.start - b.start);
      return formatContentToHtml({
        text: displayedText,
        clauseRiskRange: rangeClauseRisk,
        patches,
        clauses,
      });
    }, [htmlContent, displayedText, clauses, activePatchCount, patches]);



    // Initialisation de l'éditeur TipTap
    const skipNextEditorSyncRef = useRef(false);

    const editor = useEditor({
      extensions: [StarterKit, ClauseMark],
      content: htmlFormattedContent,
      editable: true,
      onUpdate: ({ editor }) => {
        skipNextEditorSyncRef.current = true;
        setHtmlContent(stripClauseMarkupFromHtml(editor.getHTML()));
      },
    });

    useEffect(() => {
      console.log("HTML", htmlContent);
    }, []);

    // Synchroniser le contenu quand htmlFormattedContent change (nouvelles clauses, patches…)
    useEffect(() => {
      if (!editor || editor.isDestroyed) return;
      const current = editor.getHTML();
      if (current === htmlFormattedContent) {
        skipNextEditorSyncRef.current = false;
        return;
      }
      if (skipNextEditorSyncRef.current) {
        skipNextEditorSyncRef.current = false;
        return;
      }
      editor.commands.setContent(htmlFormattedContent, { emitUpdate: false });
    }, [htmlFormattedContent, editor]);

    // Event delegation pour les clics sur les spans de clauses
    const tiptapWrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const wrapper = tiptapWrapperRef.current;
      if (!wrapper) return;

      const handleClick = (event: Event) => {
        const target = event.target as HTMLElement;
        const span = target.closest("[data-clause-risk-id]");
        if (span) {
          const clauseId = span.getAttribute("data-clause-risk-id");
          if (clauseId) handleClickSpanClause(clauseId);
        }
      };

      wrapper.addEventListener("click", handleClick);
      return () => wrapper.removeEventListener("click", handleClick);
    }, [htmlFormattedContent]);


    return (
      <div
        className={`bg-white rounded-lg shadow-sm border border-gray-200 h-full ${showSidebar ? "flex" : ""}`}
      >
        {/* Document Principal */}
        <div className={`${showSidebar ? "flex-1" : "w-full"} flex flex-col`}>
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex-shrink-0 flex items-center justify-between gap-6">
            <h2 className="min-w-0 text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="truncate">{fileName}</span>
              {analysisContextRows.length > 0 && (
                <span className="relative inline-flex shrink-0 items-center group">
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-gray-500 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    aria-label="Afficher les informations d'analyse"
                    title="Informations d'analyse"
                  >
                    <Info className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <span className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white p-3 text-left text-sm font-normal text-gray-700 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Détails de l'analyse
                    </span>
                    <span className="block space-y-2">
                      {analysisContextRows.map(([label, value]) => (
                        <span key={label} className="block">
                          <span className="block text-xs font-medium text-gray-500">
                            {label}
                          </span>
                          <span className="block text-sm leading-snug text-gray-900">
                            {value}
                          </span>
                        </span>
                      ))}
                    </span>
                  </span>
                </span>
              )}
            </h2>
            <div className="flex items-center gap-4 text-xs">
              <button
                onClick={() => resetAll()}
                disabled={activePatchCount === 0}
                className={`px-2 py-1 rounded-full border text-xs font-medium transition-colors ${activePatchCount === 0 ? "border-gray-200 text-gray-300 cursor-not-allowed" : "border-red-300 text-red-600 hover:bg-red-50"}`}
                title="Réinitialiser toutes les modifications"
              >
                Réinitialiser tout
              </button>
            </div>
          </div>

          {/* Body - Document avec scroll */}
          <div
            ref={documentRef}
            className="flex-1 overflow-y-auto custom-scrollbar"
          >
            <div className="p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <div className="max-w-4xl mx-auto">
                  {activeClauseId && (
                    <style>{`[data-clause-risk-id]:not([data-clause-risk-id="${activeClauseId}"]) {background-color: transparent !important; border-bottom-color: transparent !important; transition: background-color 250, border-bottom-color 250}`}</style>
                  )}
                  {htmlFormattedContent.length > 0 ? (
                    <div ref={tiptapWrapperRef}>
                      <EditorContent editor={editor} />
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-6xl mb-4">📄</div>
                      <p>Aucun contenu à afficher</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        {showSidebar && (
          <div>
            <ClausesSidebar
              clauses={clauses}
              onClauseClick={handleSidebarClauseClick}
              isVisible={true}
              recommandationApplied={patches}
            />
          </div>
        )}
      </div>
    );
  },
);

DocumentViewer.displayName = "DocumentViewer";

function stripClauseMarkupFromHtml(html: string): string {
  if (typeof DOMParser === "undefined") return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  doc.body.querySelectorAll("[data-clause-risk-id]").forEach((element) => {
    const parent = element.parentNode;
    if (!parent) return;

    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    parent.removeChild(element);
  });

  return doc.body.innerHTML;
}
