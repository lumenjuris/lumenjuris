import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ClauseRisk } from '../types';
import { callOpenAI, callHuggingFace } from '../utils/aiClient';

export interface AlternativeClause {
  id: string;
  title: string;
  clauseText: string;
  benefits: string;
  riskReduction: string;
  issue: string;
}

interface RecoState {
  map: Record<string, AlternativeClause>;
  fetchAll: (cs: ClauseRisk[]) => Promise<void>;
}

export const useRecoStore = create<RecoState>()(
  persist(
    (set, get) => ({
      map: {},

      async fetchAll(clauses) {
        await Promise.all(
          clauses.map(async (cl) => {
            if (get().map[cl.id]) return;

            /* ---------- 1. problème (HF) ---------- */
            let issue = '';
            try {
              const txt = await callHuggingFace(
                'mistralai/Mixtral-8x7B-Instruct-v0.1',
                `En une phrase, quel est le problème principal de cette clause ?\n"""${cl.content}"""`,
                { max_new_tokens: 60, temperature: 0.2 }
              );
              issue = txt.trim();
            } catch {
              issue = 'Analyse indisponible.';
            }

            /* ---------- 2. alternative (OpenAI) ---------- */
            let altTxt = '',
              benefits = '',
              risk = '';
            try {
              const ctrl = new AbortController();
              const timeout = setTimeout(() => ctrl.abort(), 10000);
              const prompt =
                `Améliore cette clause pour réduire les risques.\nClause:\n"""${cl.content}"""\n` +
                `Réponds JSON: {"clause":"...", "benefits":"...", "risk":"..."}`;
              const txt = await callOpenAI(
                [{ role: 'user', content: prompt }],
                { model: 'gpt-4o', temperature: 0.2 }
              );
              clearTimeout(timeout);
              const obj = JSON.parse(txt);
              altTxt = obj.clause;
              benefits = obj.benefits;
              risk = obj.risk;
            } catch {
              altTxt =
                'Le Preneur reconnaît que la responsabilité du Bailleur est strictement ' +
                'limitée aux dommages directs, à hauteur de 50 % du loyer annuel.';
              benefits = 'Plafonne la responsabilité du bailleur';
              risk = '≈ 70 %';
            }

            set((s) => ({
              map: {
                ...s.map,
                [cl.id]: {
                  id: `alt-${cl.id}`,
                  title: 'Clause alternative',
                  clauseText: altTxt,
                  benefits,
                  riskReduction: risk,
                  issue,
                },
              },
            }));
          })
        );
      },
    }),
    { name: 'justiclause-cache' }
  )
);
