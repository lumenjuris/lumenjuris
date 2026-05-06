import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ClauseRisk } from '../types';
import { callOpenAI, callOpenAi52, type OpenAIModelId } from '../utils/aiClient';
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

const usesResponsesApi = (
  model: OpenAIModelId,
): model is Extract<OpenAIModelId, 'gpt-5.2' | 'gpt-5.4-nano'> => model === 'gpt-5.2' || model === 'gpt-5.4-nano';

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
          const prompt = `Tu es un avocat canadien spécialisé.
Analyse la clause suivante:
"""${clause.content}"""

Réponds STRICTEMENT en JSON:
{
  "summary":"résumé 2 lignes",
  "riskLevel":"High|Medium|Low",
  "riskScore":"0-100",
  "litigation":"type de litige potentiel",
  "issues":["problème1","problème2"],
  "advice":"conseil global (1-2 phrases)",
  "alternatives":[
    {
      "clause":"réécriture intégrale (Proposition 1)",
      "benefits":"bénéfices de cette version",
      "riskReduction":"%"
    },
    {
      "clause":"réécriture intégrale (Proposition 2)",
      "benefits":"bénéfices de cette version",
      "riskReduction":"%"
    }
  ]
}`;

          try {
            const txt = usesResponsesApi(model)
              ? await callOpenAi52(prompt, 'medium', 'medium', model)
              : await callOpenAI([
                { role: 'user', content: prompt }
              ], { model, temperature: 0.2, response_format: { type: 'json_object' } });
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
    { name: 'justiclause-ai-cache-v2' }
  )
);
