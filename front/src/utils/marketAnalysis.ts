/* ------------------------------------------------------------------
   Détection des clauses suggérées (manquantes) par rapport aux standards
   ------------------------------------------------------------------ */

import { callOpenAI } from './aiClient';

export interface MissingClause {
  nom: string;
  importance: 'obligatoire' | 'recommandé' | 'utile';
  explicationAbsence: string;
  standardMarche: string;
  suggestionAjout: string;
  priorite: 'critique' | 'important' | 'mineur';
}

export interface MarketAnalysisResult {
  clausesManquantes: MissingClause[];
  scoreConformite: number;
}

/**
 * Détection des clauses manquantes par rapport aux standards du marché
 */
export async function detectMissingClauses(
  contractText: string,
  contractType: string,
  existingClauses: string[]
): Promise<MissingClause[]> {

  const contractExcerpt = contractText ? contractText.substring(0, 4000) : '';

  const prompt = `Tu es un expert juridique senior spécialisé dans l'analyse de ${contractType}.
Ta mission est d'identifier UNIQUEMENT les clauses ABSENTES mais ESSENTIELLES.

CONTEXTE:
- Type de contrat: ${contractType}
- Clauses déjà présentes dans le contrat: ${existingClauses.join(', ')}

INSTRUCTIONS CRITIQUES:
1. Compare ce contrat aux STANDARDS DU MARCHÉ pour ce type précis
2. Identifie les clauses qui MANQUENT mais qui devraient y être
3. Base-toi sur:
   - La législation applicable
   - Les usages du secteur
   - La jurisprudence récente
   - Les bonnes pratiques contractuelles

CRITÈRES DE SÉLECTION:
- Clauses OBLIGATOIRES par la loi
- Clauses RECOMMANDÉES par les standards du marché
- Clauses UTILES pour protéger les intérêts

FORMAT DE RÉPONSE JSON:
{
  "clausesManquantes": [
    {
      "nom": "Nom précis de la clause manquante",
      "importance": "obligatoire|recommandé|utile",
      "explicationAbsence": "Pourquoi cette absence est problématique",
      "standardMarche": "Ce qui existe dans 90% des contrats similaires",
      "suggestionAjout": "Proposition de formulation concrète",
      "priorite": "critique|important|mineur"
    }
  ]
}

Contrat à analyser:
"""
${contractExcerpt}
"""

Réponds UNIQUEMENT avec le JSON.`;

  try {
    const txt = await callOpenAI(
      [{ role: 'user', content: prompt }],
      { model: 'gpt-5.4-nano', temperature: 0.1, max_tokens: 1500, response_format: { type: 'json_object' } }
    );
    const result = JSON.parse(txt);

    console.log('🤖 Clauses manquantes détectées:', result.clausesManquantes);
    return result.clausesManquantes || [];

  } catch (error) {
    console.error("❌ Erreur lors de la détection des clauses manquantes:", error);
    return [];
  }
}

/**
 * Analyse complète : détection des clauses suggérées
 */
export async function performCompleteMarketAnalysis(
  contractText: string,
  contractType: string,
  detectedClauses: { type: string }[]
): Promise<MarketAnalysisResult> {

  console.log('🔍 Détection des clauses suggérées...');

  const clausesManquantes = await detectMissingClauses(
    contractText,
    contractType,
    detectedClauses.map(c => c.type)
  );

  const scoreConformite = calculateConformityScore(clausesManquantes);

  const result: MarketAnalysisResult = {
    clausesManquantes,
    scoreConformite,
  };

  console.log('✅ Clauses suggérées détectées:', {
    manques: clausesManquantes.length,
    score: scoreConformite
  });

  return result;
}

function calculateConformityScore(clausesManquantes: MissingClause[]): number {
  let score = 100;

  clausesManquantes.forEach(clause => {
    switch (clause.importance) {
      case 'obligatoire': score -= 15; break;
      case 'recommandé':  score -= 8;  break;
      case 'utile':       score -= 3;  break;
    }
  });

  return Math.max(0, Math.min(100, score));
}
