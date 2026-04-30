/* ------------------------------------------------------------------
   Analyse comparative des contrats avec les standards du marché
   ------------------------------------------------------------------ */

import { ClauseRisk } from '../types';
import { logCost } from './costEstimator';
import { callOpenAI } from './aiClient';

export interface MissingClause {
  nom: string;
  importance: 'obligatoire' | 'recommandé' | 'utile';
  explicationAbsence: string;
  standardMarche: string;
  suggestionAjout: string;
  priorite: 'critique' | 'important' | 'mineur';
}

export interface MarketDeviation {
  clause: string;
  votreContrat: string;
  standard: string;
  ecart: 'favorable' | 'défavorable' | 'neutre';
  recommandation: string;
  impact: 'faible' | 'moyen' | 'élevé';
}

export interface ContextualQuestion {
  question: string;
  contexte: string;
  urgence: 'haute' | 'moyenne' | 'basse';
  categorie: 'risque' | 'manque' | 'clarification' | 'negociation';
}

export interface MarketAnalysisResult {
  clausesManquantes: MissingClause[];
  ecartAuxStandards: MarketDeviation[];
  questionsProposees: ContextualQuestion[];
  scoreConformite: number;
}

/**
 * Analyse spécialisée : Détection des clauses manquantes
 */
export async function detectMissingClauses(
  contractText: string,
  contractType: string,
  existingClauses: string[]
): Promise<MissingClause[]> {

  // Limiter l'extrait pour prompt (utilisation directe suffit pour lint)
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
      { model: 'gpt-4o', temperature: 0.1, max_tokens: 1500, response_format: { type: 'json_object' } }
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
 * Analyse spécialisée : Comparaison aux standards du marché
 */
export async function compareToMarketStandards(
  contractText: string,
  contractType: string,
  detectedClauses: ClauseRisk[]
): Promise<MarketDeviation[]> {

  // Utiliser un petit extrait du contrat pour aider le modèle (et éviter warning)
  const excerpt = contractText ? contractText.substring(0, 800) : '';

  const clausesSummary = detectedClauses.map(clause =>
    `${clause.type}: ${clause.content.substring(0, 200)}...`
  ).join('\n');

  const prompt = `Tu es un expert juridique spécialisé dans la comparaison de contrats aux standards du marché.

MISSION: Compare les clauses de ce contrat aux pratiques standard du marché.

EXTRAIT CONTRAT (contexte limité):
${excerpt}

CONTEXTE:
- Type de contrat: ${contractType}
- Clauses détectées dans le contrat analysé:

${clausesSummary}

INSTRUCTIONS:
1. Pour CHAQUE clause détectée, compare-la aux standards du marché
2. Identifie les ÉCARTS significatifs (favorables ou défavorables)
3. Évalue l'impact de chaque écart
4. Propose des recommandations concrètes

CRITÈRES D'ÉVALUATION:
- Conformité légale
- Équilibre contractuel
- Pratiques du secteur
- Protection des intérêts

FORMAT DE RÉPONSE JSON:
{
  "ecartAuxStandards": [
    {
      "clause": "Nom de la clause analysée",
      "votreContrat": "Ce qui est écrit dans le contrat",
      "standard": "Ce qui est standard dans le marché",
      "ecart": "favorable|défavorable|neutre",
      "recommandation": "Action concrète recommandée",
      "impact": "faible|moyen|élevé"
    }
  ]
}

Réponds UNIQUEMENT avec le JSON.`;

  try {
    const txt = await callOpenAI(
      [{ role: 'user', content: prompt }],
      { model: 'gpt-4o', temperature: 0.1, max_tokens: 1500, response_format: { type: 'json_object' } }
    );
    const result = JSON.parse(txt);

    console.log('🤖 Comparaison aux standards effectuée:', result.ecartAuxStandards);
    return result.ecartAuxStandards || [];

  } catch (error) {
    console.error("❌ Erreur lors de la comparaison aux standards:", error);
    return [];
  }
}

/**
 * Génération de questions contextuelles pertinentes
 */
export async function generateContextualQuestions(
  contractText: string,
  clausesManquantes: MissingClause[],
  clausesRisque: ClauseRisk[],
  contractType: string
): Promise<ContextualQuestion[]> {

  const manquesSummary = clausesManquantes.map(c => c.nom).join(', ');
  const risquesSummary = clausesRisque.map(c => c.type).join(', ');
  const excerpt = contractText ? contractText.substring(0, 1200) : '';

  const prompt = `Tu es un expert juridique. Génère 5 questions PERTINENTES que l'utilisateur devrait se poser sur ce contrat.

CONTEXTE:
- Type de contrat: ${contractType}
- Clauses manquantes détectées: ${manquesSummary}
- Clauses à risque identifiées: ${risquesSummary}

INSTRUCTIONS:
1. Les questions doivent être basées sur les LACUNES et RISQUES détectés
2. Elles doivent être ACTIONNABLES (commencer par "Que se passe-t-il si...", "Comment...", "Puis-je...")
3. Priorise les questions liées aux clauses manquantes et aux risques
4. Adapte les questions au type de contrat spécifique

FORMAT DE RÉPONSE JSON:
{
  "questionsProposees": [
    {
      "question": "Question complète et précise",
      "contexte": "Pourquoi cette question est pertinente",
      "urgence": "haute|moyenne|basse",
      "categorie": "risque|manque|clarification|negociation"
    }
  ]
}

Extrait du contrat pour contexte:
"""
${excerpt}
"""

Réponds UNIQUEMENT avec le JSON.`;

  try {
    const txt = await callOpenAI(
      [{ role: 'user', content: prompt }],
      { model: 'gpt-4o', temperature: 0.3, max_tokens: 800, response_format: { type: 'json_object' } }
    );
    const result = JSON.parse(txt);

    console.log('🤖 Questions contextuelles générées:', result.questionsProposees);
    return result.questionsProposees || [];

  } catch (error) {
    console.error("❌ Erreur lors de la génération des questions:", error);
    return [];
  }
}

/**
 * Analyse complète du marché (orchestration des analyses spécialisées)
 */
export async function performCompleteMarketAnalysis(
  contractText: string,
  contractType: string,
  detectedClauses: ClauseRisk[]
): Promise<MarketAnalysisResult> {

  console.log('🔍 Début de l\'analyse comparative complète en parallèle...');

  // Optimisation: Exécuter les appels API en parallèle pour gagner du temps
  const [clausesManquantes, ecartAuxStandards, questionsProposees] = await Promise.all([
    detectMissingClauses(
      contractText,
      contractType,
      detectedClauses.map(c => c.type)
    ),
    compareToMarketStandards(
      contractText,
      contractType,
      detectedClauses
    ),
    generateContextualQuestions(
      contractText,
      [], // On ne peut pas encore fournir les clauses manquantes ici, mais l'IA peut se baser sur le contrat
      detectedClauses,
      contractType
    )
  ]);

  // Le coût total est la somme des coûts loggués dans chaque fonction.
  // Pour l'afficher ici, il faudrait que chaque fonction retourne [result, cost].
  // Pour la simplicité, nous nous contentons des logs individuels.

  // Calcul du score de conformité
  const scoreConformite = calculateConformityScore(clausesManquantes, ecartAuxStandards);

  const result: MarketAnalysisResult = {
    clausesManquantes,
    ecartAuxStandards,
    questionsProposees,
    scoreConformite,
  };

  console.log('✅ Analyse comparative complète terminée:', {
    manques: clausesManquantes.length,
    ecarts: ecartAuxStandards.length,
    questions: questionsProposees.length,
    score: scoreConformite
  });

  return result;
}

/**
 * Calcul du score de conformité global
 */
function calculateConformityScore(
  clausesManquantes: MissingClause[],
  ecartAuxStandards: MarketDeviation[]
): number {
  let score = 100;

  // Pénalités pour les clauses manquantes
  clausesManquantes.forEach(clause => {
    switch (clause.importance) {
      case 'obligatoire':
        score -= 15;
        break;
      case 'recommandé':
        score -= 8;
        break;
      case 'utile':
        score -= 3;
        break;
    }
  });

  // Pénalités pour les écarts défavorables
  ecartAuxStandards.forEach(ecart => {
    if (ecart.ecart === 'défavorable') {
      switch (ecart.impact) {
        case 'élevé':
          score -= 12;
          break;
        case 'moyen':
          score -= 6;
          break;
        case 'faible':
          score -= 2;
          break;
      }
    }
  });

  return Math.max(0, Math.min(100, score));
}
