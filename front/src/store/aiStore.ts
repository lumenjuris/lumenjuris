import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ClauseRisk } from '../types';
import { callAssistant, type OpenAIModelId } from '../utils/aiClient';



/* ---------- TYPES ---------- */
export interface AltProposal {
  clause: string; // nouvelle rédaction complète
  benefits: string; // +valeur pour le client
  riskReduction: string; // ex. "35 %"
}

export interface ClauseAI {
  summary: string; // 2 lignes
  riskLevel: 'High' | 'Medium' | 'Low'; // badge
  riskScore: number; // 0-100
  litigation: string; // type de litige potentiel
  issues: string[]; // liste
  advice: string; // conseil global
  alternatives: AltProposal[]; // 2 propositions
  error?: string;
}

interface AIState {
  map: Record<string, ClauseAI>;
  fetch: (clause: ClauseRisk, model?: OpenAIModelId) => Promise<void>;
}

export const getClauseAIKey = (clauseId: string, model: OpenAIModelId) => `${clauseId}:${model}`;
const pendingClauseAIRequests = new Map<string, Promise<ClauseAI>>();



const parseClauseAI = (txt: string): ClauseAI => JSON.parse(
  (txt || '{}')
    .trim()
    .replace(/^[\s\S]*?({)/, '$1')
    .replace(/```(?:json)?|```/gi, '')
);

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      map: {},

      async fetch(clause, model = 'gpt-4o') {
        const cacheKey = getClauseAIKey(clause.id, model);
        if (get().map[cacheKey]) return; // cache
        if (pendingClauseAIRequests.has(cacheKey)) {
          await pendingClauseAIRequests.get(cacheKey);
          return;
        }

        const request = (async (): Promise<ClauseAI> => {
          try {
            // Prompt construit par le proxy (services/assistant/assistantPrompts.ts).
            const txt = await callAssistant('clause-analysis', { clauseText: clause.content, model });
            return parseClauseAI(txt);
          } catch (e) {
            console.error('OpenAI error:', e);
            return {
              summary: 'Analyse indisponible.',
              riskLevel: 'Medium',
              riskScore: 50,
              litigation: '',
              issues: [],
              advice: '',
              alternatives: [],
              error: 'Analyse IA indisponible pour ce modèle.',
            };
          }
        })();

        pendingClauseAIRequests.set(cacheKey, request);

        try {
          const obj = await request;
          set((s) => ({ map: { ...s.map, [cacheKey]: obj } }));
        } finally {
          pendingClauseAIRequests.delete(cacheKey);
        }
      },
    }),
    // v3 : invalide les analyses en cache produites avec l'ancien prompt
    // (énumérations romaines « (i) (ii) (iii) » et persona « avocat canadien »).
    { name: 'justiclause-ai-cache-v3' }
  )
);
