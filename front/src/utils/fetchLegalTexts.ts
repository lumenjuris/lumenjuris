/* Récupère le texte intégral d’un article – filtré FR / CA.
   ->  clause est OPTIONNEL : si absent, on suppose France. */

import { LegalText, ClauseRisk } from '../types';
import { callOpenAI } from './aiClient';

const MODEL = 'gpt-4o';

/* ---------- helpers ---------- */
const safeJSON = (txt: string) => {
  try {
    // Nettoyage plus robuste du texte
    let cleaned = txt
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    // Trouver le début du JSON
    const startIndex = cleaned.indexOf('{');
    if (startIndex === -1) {
      throw new Error('Aucun objet JSON trouvé');
    }
    
    // Extraire à partir du premier {
    cleaned = cleaned.substring(startIndex);
    
    // Vérifier si le JSON est complet (compte des accolades)
    let braceCount = 0;
    let endIndex = -1;
    
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i] === '{') braceCount++;
      if (cleaned[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
    
    if (endIndex > 0) {
      cleaned = cleaned.substring(0, endIndex);
    }
    
    return JSON.parse(cleaned);
  } catch (error) {
    console.warn('⚠️ Erreur de parse JSON dans fetchLegalTexts:', error);
    console.warn('📄 Texte problématique:', txt.substring(0, 300) + '...');
    return null;
  }
};

function guessJurisdiction(clause?: ClauseRisk | null): 'FR' | 'CA' {
  if (!clause) return 'FR'; // <— sécurité anti-undefined
  if (clause.jurisdictionSpecific?.province) return 'CA';
  if (/CCQ|Québec|Canada/i.test(clause.content)) return 'CA';
  return 'FR';
}

async function fetchOne(
  ref: string,
  juris: 'FR' | 'CA',
  attempt: number = 1
): Promise<LegalText | null> {
  const prompt = `
   JURIDICTION: ${juris === 'FR' ? 'France' : 'Canada'}
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
    const content = await callOpenAI(
      [{ role: 'user', content: prompt }],
      { model: MODEL, temperature: 0, max_tokens: 2048 }
    );
    
    if (!content) {
      console.warn('⚠️ Contenu vide reçu pour la référence:', ref);
      return null;
    }

    const obj = safeJSON(content);
    
    // Vérifier que l'objet parsé est valide et complet
    if (!obj || !obj.title || !obj.fullText) {
      console.warn(`⚠️ Objet JSON invalide pour la référence: ${ref} (tentative ${attempt})`);
      
      // Retry une fois avec un prompt plus simple si c'est la première tentative
      if (attempt === 1) {
        console.log(`🔄 Nouvelle tentative pour: ${ref}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchOne(ref, juris, 2);
      }
      
      return null;
    }
    
    console.log(`✅ Texte récupéré avec succès: ${obj.title}`);
    return { 
      id: ref, 
      title: obj.title, 
      fullText: obj.fullText, 
      url: obj.url || `https://legifrance.gouv.fr` 
    };
    
  } catch (error) {
    console.error(`❌ Erreur lors de la récupération de ${ref}:`, error);
    return null;
  }
}

export async function fetchLegalTexts(
  refs: string | string[],
  clause?: ClauseRisk | null
): Promise<LegalText[]> {
  const juris = guessJurisdiction(clause);
  const list = Array.isArray(refs) ? refs : [refs];
  const out: LegalText[] = [];
  
  console.log(`🔍 Récupération de ${list.length} référence(s) légale(s) (${juris})`);
  
  for (const r of list) {
    try {
      const t = await fetchOne(r, juris);
      if (t) {
        out.push(t);
      } else {
        console.warn(`⚠️ Impossible de récupérer: ${r}`);
      }
      
      // Pause entre les requêtes pour éviter la limitation de taux
      if (list.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`❌ Erreur fatale pour ${r}:`, error);
    }
  }
  
  console.log(`✅ ${out.length}/${list.length} textes récupérés avec succès`);
  return out;
}
