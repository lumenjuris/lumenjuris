/* src/utils/detectLegalReferences.ts
 * Retourne une LISTE de références d'articles pertinentes
 * pour une clause donnée (ex.: ["CCQ art. 1474", "C.civ. art. 1229"]).
 */

import { ClauseRisk } from '../types';
import { callOpenAI } from './aiClient';

const MODEL = 'gpt-4o';

export async function detectLegalReferences(
  clause: ClauseRisk
): Promise<string[]> {
  const prompt = `
Clause:
"""
${clause.content}
"""

Donne UNIQUEMENT la liste (JSON array) des références légales les plus
pertinentes (articles de lois ou codes) pour comprendre ou interpréter
cette clause. Pas d’explication, pas de doublon. Format:
["REF 1", "REF 2", ...]`.trim();

  try {
    const txt = await callOpenAI(
      [{ role: 'user', content: prompt }],
      { model: MODEL, temperature: 0 }
    );
    return JSON.parse(txt);
  } catch (e) {
    console.error('OpenAI legalRef error', e);
    return [];
  }
}
