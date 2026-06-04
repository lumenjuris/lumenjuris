/* eslint-disable no-console */
import type { ClauseRisk } from "../services/aiAnalyser/types.js";
import { callOpenAI } from "../utils/openaiClient.js";

export interface LegalText {
  id: string;
  title: string;
  fullText: string;
  url?: string;
}

const safeJSON = (
  txt: string,
): { title?: string; fullText?: string; url?: string } | null => {
  try {
    let cleaned = txt
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const startIndex = cleaned.indexOf("{");
    if (startIndex === -1) return null;
    cleaned = cleaned.substring(startIndex);

    let braceCount = 0;
    let endIndex = -1;
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i] === "{") braceCount++;
      if (cleaned[i] === "}") {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
    if (endIndex > 0) cleaned = cleaned.substring(0, endIndex);

    return JSON.parse(cleaned);
  } catch (error) {
    console.warn("⚠️ Erreur de parse JSON dans fetchLegalTexts:", error);
    return null;
  }
};

function guessJurisdiction(clause?: ClauseRisk | null): "FR" | "CA" {
  if (!clause) return "FR";
  if ((clause as any).jurisdictionSpecific?.province) return "CA";
  if (/CCQ|Québec|Canada/i.test(clause.content)) return "CA";
  return "FR";
}

async function fetchOne(
  ref: string,
  juris: "FR" | "CA",
  attempt: number = 1,
): Promise<LegalText | null> {
  const prompt = `
   JURIDICTION: ${juris === "FR" ? "France" : "Canada"}
   Je veux le TEXTE INTÉGRAL de la référence suivante :
   "${ref}"

   IMPORTANT: Réponse JSON complète et valide uniquement:
   {
     "title": "titre exact de l'article",
     "fullText": "texte complet de l'article",
     "url": "https://legifrance.gouv.fr/... ou URL officielle"
   }

   Ne pas tronquer le JSON. Assure-toi que les accolades sont fermées.`.trim();

  try {
    const content = await callOpenAI([{ role: "user", content: prompt }], {
      model: "gpt-4o",
      temperature: 0,
      max_tokens: 2048,
    });

    if (!content) return null;
    const obj = safeJSON(content);

    if (!obj || !obj.title || !obj.fullText) {
      if (attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return fetchOne(ref, juris, 2);
      }
      return null;
    }

    return {
      id: ref,
      title: obj.title,
      fullText: obj.fullText,
      url: obj.url || "https://legifrance.gouv.fr",
    };
  } catch (error) {
    console.error(`❌ Erreur lors de la récupération de ${ref}:`, error);
    return null;
  }
}

export async function fetchLegalTexts(
  refs: string | string[],
  clause?: ClauseRisk | null,
): Promise<LegalText[]> {
  const juris = guessJurisdiction(clause);
  const list = Array.isArray(refs) ? refs : [refs];
  const out: LegalText[] = [];

  for (const r of list) {
    try {
      const t = await fetchOne(r, juris);
      if (t) out.push(t);
      if (list.length > 1)
        await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`❌ Erreur fatale pour ${r}:`, error);
    }
  }

  return out;
}
