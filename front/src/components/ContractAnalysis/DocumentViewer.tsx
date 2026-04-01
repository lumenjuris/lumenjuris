import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { motion } from "framer-motion";
import { ClauseRisk } from "../../types";
import { ClausesSidebar } from "./ClausesSidebar";
import { isFeatureEnabled } from "../../config/features";
import { useDocumentTextStore } from "../../store/documentTextStore";
import { ContractAnalysisSummary } from "./ContractAnalysisSummary";
import { AnalysisContext } from "../../types/contextualAnalysis";
import { findBestClauseSpan } from "../../utils/textPatchLocator";
//import { useClauseHighlight } from '../hooks/useClauseHighlight'; Momentanément desactivé
// import { formatContent } from "../../utils/documentViewerTools/formatContent";
import { formatContentToHtml } from "../../utils/documentViewerTools/formatContentToHtml";
import { modernHighlighter } from "../../utils/modernHighlighter";

import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css"; // thème

//import { escapeHtml } from '../utils/documentViewerTools/escapeHtml';

interface DocumentViewerProps {
  content: string;
  clauses: ClauseRisk[];
  onClauseClick: (clauseId: string) => void;
  fileName: string;
  contractSummary?: AnalysisContext;
  recommendationIndex: number;
  setRecommendationIndex: (number: number) => void;
}

export interface DocumentViewerRef {
  scrollToClause: (clauseId: string) => void;
  //clearHighlight: () => void;
  //reHighlight: () => void;
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
      recommendationIndex,
      setRecommendationIndex,
    },
    ref,
  ) => {
    const documentRef = useRef<HTMLDivElement>(null);
    const showSidebar = isFeatureEnabled("ENABLE_CLAUSES_SIDEBAR");
    const originalText = useDocumentTextStore((s) => s.originalText);
    const patches = useDocumentTextStore((s) => s.patches);
    const resetAll = useDocumentTextStore((s) => s.resetAll);
    const activePatchCount = useMemo(
      () => patches.filter((p) => p.active).length,
      [patches],
    );
    const effectiveOriginal =
      originalText && originalText.length > 0 ? originalText : content;
    const displayedText = effectiveOriginal;

    // Etat pour afficher l'editeur de text de clause
    const [editingClauseId, setEditingClauseId] = useState<string | null>(null);
    // const [quillActiv, setQuillActiv] = useState<boolean>(false);
    // Gestion du click sur un span d'une clause détectée dans le texte
    const lastClick = useRef(0);

    const handleClickSpanClause = (clauseId: string) => {
      const delayDoubleClick: number = 250;
      const now = Date.now();
      const diff = now - lastClick.current;
      lastClick.current = now;

      const targetClause = clauses.find((c) => c.id === clauseId);
      if (!targetClause) return;

      // Double-clic -> activer l'edit d'une clause
      if (diff < delayDoubleClick && targetClause) {
        console.log("Activation de l'édition d'une clause dans le texte");
        setEditingClauseId(clauseId);
        return;
      }

      // Click : ouvrir la modale EnhancedClause
      setTimeout(() => {
        if (Date.now() - lastClick.current >= delayDoubleClick) {
          onClauseClick(clauseId);
        }
      }, delayDoubleClick);
    };

    const scrollAndHighlightClause = (clause: ClauseRisk) => {
      console.log("🎯 Modern Highlighting for clause:", clause.type);
      if (!documentRef.current || !clause.content) {
        console.log("❌ documentRef ou clause.content manquant");
        return;
      }
      try {
        if (!documentRef.current) {
          console.error("❌ documentRef.current is null");
          return;
        }
        console.log("🔍 Attempting modern highlighting...");
        modernHighlighter.highlightClause(clause, documentRef.current);
      } catch (error) {
        console.error("❌ Modern highlighting error:", error);
      }
    };

    useImperativeHandle(ref, () => ({
      scrollToClause: (clauseId: string) => {
        console.log("🔍 scrollToClause appelé avec clauseId:", clauseId);
        const clause = clauses.find((c) => c.id === clauseId);
        if (clause) {
          console.log("🔍 Appel de scrollAndHighlightClause...");
          scrollAndHighlightClause(clause);
        } else {
          console.log("❌ Clause non trouvée pour ID:", clauseId);
        }
      },
    }));

    const handleSidebarClauseClick = (clause: ClauseRisk, index: number) => {
      console.log(
        "🎯 handleSidebarClauseClick appelé avec:",
        clause.type,
        "index:",
        index,
      );
      onClauseClick(clause.id);
    };

    //Construction du texte à render
    // const formattedContent = useMemo(() => {
    //   console.log("Rerender du texte content");
    //   const rangeClauseRisk: any[] = [];

    //   clauses.map((c) => {
    //     const range = findBestClauseSpan(displayedText, c);
    //     rangeClauseRisk.push({ ...range, clauseId: c.id });
    //   });

    //   rangeClauseRisk.sort((a, b) => a.start - b.start);
    //   return formatContent({
    //     text: displayedText,
    //     clauseRiskRange: rangeClauseRisk,
    //     patches,
    //     clauses,
    //     editingClauseId,
    //     setEditingClauseId,
    //     recommendationIndex,
    //     setRecommendationIndex,
    //     handleClickSpanClause,
    //   });
    // }, [displayedText, clauses, activePatchCount, editingClauseId, patches]);

    //Construction du texte à render pour le Quill
    const rangeClauseRisk = useMemo(() => {
      const ranges: any[] = [];
      clauses.map((clause) => {
        const range = findBestClauseSpan(displayedText, clause);
        ranges.push({ ...range, clauseId: clause.id });
      });
      ranges.sort((a, b) => a.start - b.start);
      return ranges;
    }, [displayedText, clauses]);

    const htmlContent = useMemo(() => {
      console.log("Rerender du texte content");
      return formatContentToHtml({
        text: displayedText,
        clauseRiskRange: rangeClauseRisk,
        patches,
        clauses,
      });
    }, [displayedText, rangeClauseRisk, clauses, activePatchCount, patches]);

    /*     
        //Librairie Quill pour l'edit de texte
        const htmlQuill = (str: string) => {
            const arrayStr: string[] = []
            str.split("\n\n")
                .map(l => arrayStr.push(`<p><span onClick="console.log("click")" style="font-size:22px>${escapeHtml(l)}</span></p>`))
    
            return arrayStr.join('')
        }
    */

    // Retour du JSX
    return (
      <div
        className={`bg-white rounded-lg shadow-sm border border-gray-200 h-full ${showSidebar ? "flex" : ""}`}
      >
        {/* Document Principal */}
        <div className={`${showSidebar ? "flex-1" : "w-full"} flex flex-col`}>
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex-shrink-0 flex items-center justify-between gap-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              📄 {fileName}
            </h2>
            <div className="flex items-center gap-4 text-xs">
              {/* <button
                onClick={() => setQuillActiv(!quillActiv)}
                className="px-2 py-1 rounded-full border text-xs font-semibold bg-blue-500 text-white
                            shadow-md hover:shadow-lg transition-all duration-200"
              >
                {!quillActiv ? "Passer en mode Edition" : "Sortir de l'édition"}
              </button> */}

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
                <div className="max-w-4xl mx-auto space-y-2">
                  {htmlContent.length > 0 ? (
                    <div>
                      <ReactQuill
                        theme="bubble"
                        value={htmlContent}
                        onChange={() => console.log("text changed in quill")}
                      />
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
        <div>
          {showSidebar && (
            <ClausesSidebar
              clauses={clauses}
              onClauseClick={handleSidebarClauseClick}
              isVisible={true}
              recommandationApplied={patches}
            />
          )}
          <ContractAnalysisSummary contractSummary={contractSummary} />
        </div>
      </div>
    );
  },
);

DocumentViewer.displayName = "DocumentViewer";
