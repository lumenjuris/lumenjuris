/* src/components/EnhancedClauseDetail.tsx
 * Affiche le détail d'une clause (aperçu, jurisprudence, alternatives).
 */
import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { motion } from 'framer-motion';
import { ClauseRisk, JurisprudenceCase, Recommendation } from '../../../types';
import { AnalysisContext } from '../../../types/contextualAnalysis';
import { getClauseAIKey, useAIStore } from '../../../store/aiStore';
import { useDocumentTextStore } from '../../../store/documentTextStore';
import { useChatStore } from '../../../store/chatStore';
import { type OpenAIModelId } from '../../../utils/aiClient';
const ChatUI = React.lazy(() => import('../../ContractAnalysis/EnhancedClauseDetail/ChatUI'));



//refactor en cour
import { useRun } from './useRun';
import { useGetRecommendation } from './useGetRecommendation';
import { renderTabs } from './renderTabs';
import { renderHeader } from './renderHeader';
import { RenderTabCases } from './RenderTabCases';
import { RenderTabOverview } from './RenderTabOverview';
import {
  altCache,
  altCacheTime,
  jurisprudenceCache,
} from './enhancedClauseCaches';
//fin de refactor

const CLAUSE_AI_MODEL_OPTIONS: { value: OpenAIModelId; label: string }[] = [
  { value: 'gpt-4o', label: '4o' },
  { value: 'gpt-4o-mini', label: '4o mini' },
  { value: 'gpt-5.2', label: '5.2' },
  { value: 'gpt-5.4-nano', label: '5.4 nano' },
];


// util
export const copyToClipboard = (txt: string) => navigator.clipboard.writeText(txt).catch(console.error);
export type Tab = 'overview' | 'cases' | 'chat';







// Lightweight perf helpers (no-op if Performance API absent)
export const perfMark = (name: string) => {
  if (typeof performance !== 'undefined' && performance.mark) {
    try { performance.mark(name); } catch { /* ignore */ }
  }
};




export const perfMeasure = (name: string, start: string, end: string) => {
  if (typeof performance !== 'undefined' && performance.measure) {
    try {
      performance.measure(name, start, end);
      const entries = performance.getEntriesByName(name);
      const last = entries[entries.length - 1];
      if (last) console.log(`[Perf] ${name}: ${Math.round(last.duration)} ms`);
    } catch { /* ignore */ }
  }
};





interface Props {
  clause: ClauseRisk | null;
  context?: AnalysisContext;
  onClose: () => void;
  recommendationIndex: number;
  setRecommendationIndex: (number: number) => void
}
export const EnhancedClauseDetail: React.FC<Props> = ({ clause, context, onClose, recommendationIndex, setRecommendationIndex }) => {
  if (!clause) return


  const [tab, setTab] = useState<Tab>('overview');
  const [expanded, setExpanded] = useState(false);
  const [clauseAiModel, setClauseAiModel] = useState<OpenAIModelId>('gpt-4o');
  const [alternatives, setAlternatives] = useState<Recommendation[] | null>(null);
  const setContextClause = useChatStore(s => s.setContextClause);

  // Track current clause id for perf measurements
  const currentClauseIdRef = useRef<string | null>(null);

  useEffect(() => {
    clause
      ? setContextClause({ id: clause.id, text: clause.content })
      : setContextClause(null);
  }, [clause, setContextClause]);



  const ai = useAIStore(s => (clause ? s.map[getClauseAIKey(clause.id, clauseAiModel)] : undefined));
  const fetchAI = useAIStore(s => s.fetch);
  useEffect(() => { if (clause && !ai) fetchAI(clause, clauseAiModel); }, [clause, ai, fetchAI, clauseAiModel]);


  // Perf: mark clause open & analysis readiness
  useEffect(() => {
    if (!clause) return;
    if (currentClauseIdRef.current !== clause.id) {
      currentClauseIdRef.current = clause.id;
      perfMark(`clause:${clause.id}:open`);
    }
  }, [clause]);

  useEffect(() => {
    if (clause && ai?.issues) {
      const start = `clause:${clause.id}:open`;
      const end = `clause:${clause.id}:ai_ready`;
      perfMark(end);
      perfMeasure(`clause:${clause.id}:time_to_ai`, start, end);
    }
  }, [ai, clause]);



  const originalTextGlobal = useDocumentTextStore(s => s.originalText);



  useGetRecommendation(clause, setAlternatives, altCache, altCacheTime, context, clauseAiModel)






  const [keywordSearches, setKeywordSearches] = useState<{ query: string; url: string }[]>([]);
  const [isLoadingDecisions, setIsLoadingDecisions] = useState(true);
  const [automaticDecisions, setAutomaticDecisions] = useState<JurisprudenceCase[]>([]);
  useRun(clause, setKeywordSearches, setIsLoadingDecisions, setAutomaticDecisions, jurisprudenceCache)


  const longText = useMemo(() => clause.content.trim(), [clause]);
  const shortText = useMemo(() => {
    if (!expanded && longText.length > 800) return longText.slice(0, 750) + '...';
    return longText;
  }, [expanded, longText]);




  return (
    <>
      {/* Mobile */}
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:hidden">
        <motion.section
          className="relative w-full max-w-full rounded-t-lg bg-white shadow-xl mx-2 flex flex-col"
          style={{ height: '85vh' }}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          {renderHeader(longText, clause, onClose)}
          {renderTabs(tab, setTab)}
          {renderBody('calc(85vh - 120px)')}
        </motion.section>
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose}>
          <motion.section
            className="absolute right-0 top-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 overflow-hidden flex flex-col"
            initial={{ x: 384, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 384, opacity: 0 }}
            transition={{ type: 'tween', duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
          >
            {renderHeader(longText, clause, onClose)}
            {renderTabs(tab, setTab)}
            {renderBody('calc(100vh - 120px)')}
          </motion.section>
        </div>
      </div>
    </>
  );



  function renderTabContent() {
    if (!clause) return null;


    if (tab === 'overview') {
      return (
        <RenderTabOverview
          longText={longText}
          shortText={shortText}
          expanded={expanded}
          setExpanded={setExpanded}
          ai={ai}
          alternatives={alternatives}
          clause={clause}
          originalTextGlobal={originalTextGlobal}
          recommendationIndex={recommendationIndex}
          setRecommendationIndex={setRecommendationIndex}
          clauseAiModel={clauseAiModel}
          clauseAiModelOptions={CLAUSE_AI_MODEL_OPTIONS}
          onClauseAiModelChange={(model) => {
            setAlternatives(null);
            setClauseAiModel(model);
          }}
        />
      )
    }

    if (tab === 'cases') {
      return (
        <RenderTabCases
          keywordSearches={keywordSearches}
          isLoadingDecisions={isLoadingDecisions}
          automaticDecisions={automaticDecisions}
        />
      )
    }

    if (tab === 'chat') return (
      <Suspense fallback={<div className="p-4 text-sm text-slate-500">Chargement du module de questions…</div>}>
        <ChatUI
          clauseAiModel={clauseAiModel}
          clauseAiModelOptions={CLAUSE_AI_MODEL_OPTIONS}
          onClauseAiModelChange={setClauseAiModel}
        />
      </Suspense>
    );

    return null;
  }

  function renderBody(height: string) {
    return (
      <div className="flex-1 bg-white" style={{ height, overflow: 'hidden' }}>
        <div className="h-full overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="p-4 space-y-4 min-h-full font-sans">
            {renderTabContent()}
          </div>
        </div>
      </div>
    );
  }
};
