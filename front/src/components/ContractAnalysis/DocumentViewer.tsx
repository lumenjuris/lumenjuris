import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
  useEffect,
} from "react";
import { motion } from "framer-motion";
import { Info, X } from "lucide-react";
import { ClauseRisk } from "../../types";
import { ClausesSidebar } from "./ClausesSidebar";
import { ClauseRiskCard } from "./ClauseRiskCard";
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
  isFullscreen?: boolean;
  onSuggestedClauses?: () => void;
  isLoadingSuggested?: boolean;
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
      isFullscreen = false,
      onSuggestedClauses,
      isLoadingSuggested = false,
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
    const [isMobileClausesOpen, setIsMobileClausesOpen] = useState(false);

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
      const span = documentRef.current.querySelector(
        `[data-clause-risk-id="${clause.id}"]`,
      );
      if (span) {
        span.scrollIntoView({ behavior: "smooth", block: "center" });
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

    // Ref stable vers l'éditeur pour éviter les stale closures dans les event handlers
    const editorRef = useRef(editor);
    useEffect(() => { editorRef.current = editor; }, [editor]);

    // Event delegation pour les clics sur les spans de clauses
    const tiptapWrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const wrapper = tiptapWrapperRef.current;
      if (!wrapper) return;

      // Simple clic : bloque ProseMirror pour éviter le placement de curseur
      const handleMouseDown = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (target.closest("[data-clause-risk-id]")) {
          event.preventDefault();
        }
      };

      // Double-clic : intercepté en capture pour passer avant ProseMirror.
      // On empêche la sélection native du mot et on place le curseur manuellement.
      const handleDblClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (target.closest("[data-clause-risk-id]")) {
          event.preventDefault();
          event.stopPropagation();
          const ed = editorRef.current;
          if (ed && !ed.isDestroyed) {
            const pos = ed.view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (pos) {
              ed.commands.focus();
              ed.commands.setTextSelection(pos.pos);
            }
          }
        }
      };

      const handleClick = (event: Event) => {
        const target = event.target as HTMLElement;
        const span = target.closest("[data-clause-risk-id]");
        if (span) {
          const clauseId = span.getAttribute("data-clause-risk-id");
          if (clauseId) handleClickSpanClause(clauseId);
        }
      };

      wrapper.addEventListener("mousedown", handleMouseDown);
      wrapper.addEventListener("dblclick", handleDblClick, { capture: true });
      wrapper.addEventListener("click", handleClick);
      return () => {
        wrapper.removeEventListener("mousedown", handleMouseDown);
        wrapper.removeEventListener("dblclick", handleDblClick, { capture: true });
        wrapper.removeEventListener("click", handleClick);
      };
    }, [htmlFormattedContent, clauses, onClauseClick]);

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
            <div className="flex items-center gap-2 text-xs">
              {clauses.length > 0 &&
                (() => {
                  const maxRisk = Math.max(...clauses.map((c) => c.riskScore));
                  const riskStyle =
                    maxRisk === 5
                      ? {
                          backgroundColor: "#fee2e2",
                          borderColor: "#fecaca",
                          color: "#7f1d1d",
                        }
                      : maxRisk >= 3
                        ? {
                            backgroundColor: "#ffedd5",
                            borderColor: "#fed7aa",
                            color: "#7c2d12",
                          }
                        : {
                            backgroundColor: "#dcfce7",
                            borderColor: "#bbf7d0",
                            color: "#14532d",
                          };
                  return (
                    <button
                      type="button"
                      onClick={() => setIsMobileClausesOpen(true)}
                      style={riskStyle}
                      className="md:hidden flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-opacity shrink-0 hover:opacity-80"
                    >
                      ⚖️ Voir les {clauses.length} clause
                      {clauses.length > 1 ? "s" : ""}
                    </button>
                  );
                })()}
              <button
                onClick={() => resetAll()}
                disabled={activePatchCount === 0}
                className={`px-1.5 py-0.5 md:px-2 md:py-1 rounded-full border text-[10px] md:text-xs font-medium transition-colors ${activePatchCount === 0 ? "border-gray-200 text-gray-300 cursor-not-allowed" : "border-red-300 text-red-600 hover:bg-red-50"}`}
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
                <div className={isFullscreen ? "" : "max-w-4xl mx-auto"}>
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
          <div className="hidden md:block">
            <ClausesSidebar
              clauses={clauses}
              onClauseClick={handleSidebarClauseClick}
              isVisible={true}
              recommandationApplied={patches}
              onSuggestedClauses={onSuggestedClauses}
              isLoadingSuggested={isLoadingSuggested}
            />
          </div>
        )}

        {/* Mobile clause bottom sheet — always mounted for smooth animation */}
        <>
          <div
            className={`fixed inset-0 z-30 bg-black/40 md:hidden transition-opacity duration-200 ${
              isMobileClausesOpen
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none"
            }`}
            onClick={() => setIsMobileClausesOpen(false)}
          />
          <div
            className={`fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white rounded-t-2xl shadow-xl flex flex-col max-h-[75vh] transition-transform duration-300 ease-out ${
              isMobileClausesOpen ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
              <h3 className="font-semibold text-gray-900 text-sm">
                ⚖️ {clauses.length} clause{clauses.length > 1 ? "s" : ""}{" "}
                détectée{clauses.length > 1 ? "s" : ""}
              </h3>
              <button
                type="button"
                onClick={() => setIsMobileClausesOpen(false)}
                className="flex items-center justify-center w-7 h-7 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {clauses.map((clause) => (
                <ClauseRiskCard
                  key={clause.id}
                  clause={clause}
                  onClick={() => {
                    onClauseClick(clause.id);
                    setIsMobileClausesOpen(false);
                  }}
                  recommandationApplied={patches}
                />
              ))}
            </div>
          </div>
        </>
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
