/* src/utils/getRecommendedClauses.ts */
import { ClauseRisk } from '../types';
import { AnalysisContext } from '../types/contextualAnalysis';
import { callOpenAI, callOpenAi52, type OpenAIModelId } from './aiClient';
import { buildEnterpriseContextBlockFromAnalysisContext } from './aiAnalyser/buildingPrompt';

// Interface améliorée pour les recommandations de clauses
export interface ClauseRecommendation {
  title: string;
  clauseText: string;
  benefits: string;
  riskReduction: string;
  legalBasis?: string;
  negotiationTips?: string[];
  adaptationLevel?: 'simple' | 'moderate' | 'complex';
}

const DEFAULT_MODEL: OpenAIModelId = 'gpt-4o';
const usesResponsesApi = (
  model: OpenAIModelId,
): model is Extract<OpenAIModelId, 'gpt-5.2' | 'gpt-5.4-nano'> => model === 'gpt-5.2' || model === 'gpt-5.4-nano';

function safeJSON(txt: string) {
  try {
    return JSON.parse(
      txt
        .trim()
        .replace(/^[\s\S]*?([{[])/, '$1')
        .replace(/```(?:json)?|```/gi, '')
    );
  } catch (e) {
    console.error("Erreur de parsing JSON:", e);
    console.error("Contenu brut:", txt);
    return []; // Retourner un tableau vide en cas d'erreur
  }
}

/**
 * 🎯 GÉNÈRE UN PROMPT ADAPTATIF SELON LA COMPLEXITÉ DE LA CLAUSE
 */
function generateAdaptivePrompt(clause: ClauseRisk, context?: AnalysisContext): string {
  const clauseLength = clause.content.length;
  const isComplex = clauseLength > 500;
  const isModerate = clauseLength > 200 && clauseLength <= 500;
  
  // Informations contextuelles si disponibles
  const contextualInfo = context ? `
🎯 CONTEXTE UTILISATEUR :
- Rôle : ${context.userRole}
- Mission : ${context.missionContext || context.mission || 'Analyse contractuelle'}
- Type de contrat : ${context.contractType || 'Contrat non précisé'}
- Régime juridique : ${context.legalRegime || 'Non renseigné pour le moment'}
- Objectif du contrat : ${context.contractObjective || 'Non renseigné pour le moment'}
- Orientation : ${context.interestOrientation === 'defensive' ? 'Protection maximale' : 
                context.interestOrientation === 'assertive' ? 'Optimisation avantages' : 'Équilibre contractuel'}
${buildEnterpriseContextBlockFromAnalysisContext(context)}
` : '';

  const basePrompt = `
Tu es un avocat expert français spécialisé en rédaction contractuelle. 
${contextualInfo}

📋 CLAUSE À AMÉLIORER :
Type : ${clause.type}
Risque actuel : ${clause.riskScore}/5
Justification : ${clause.justification}
Contenu complet :
"""
${clause.content}
"""

🎯 MISSION : Rédiger ${isComplex ? '2' : '1'} alternatives concises et juridiquement solides

CONTRAINTES DE LONGUEUR :
- Clause alternative : 200-400 mots maximum
- Benefits : 50-80 mots maximum  
- Risk reduction : 30-50 mots maximum
- Legal basis : 20-30 mots maximum
- Negotiation tips : 2-3 conseils de 10-15 mots chacun
`;

  if (isComplex) {
    return basePrompt + `
⚡ NIVEAU COMPLEXE détecté (${clauseLength} caractères)
- Analyser les mécanismes juridiques principaux uniquement
- Proposer 1 alternative structurée et concise
- Inclure les garde-fous essentiels
- Références légales principales uniquement

FORMAT JSON attendu :
[
  {
    "title": "Alternative optimisée - [Nom descriptif court]",
    "clauseText": "[Clause concise max 300 mots]",
    "benefits": "[Avantages en 50-70 mots]",
    "riskReduction": "[Réduction risque en 30-40 mots]",
    "legalBasis": "[Référence légale principale]",
    "negotiationTips": ["Conseil 1 (max 15 mots)", "Conseil 2 (max 15 mots)"],
    "adaptationLevel": "complex"
  }
]`;
  } else if (isModerate) {
    return basePrompt + `
⚖️ NIVEAU MODÉRÉ détecté (${clauseLength} caractères)
- Améliorer les termes essentiels
- Équilibrer droits/obligations principaux
- Simplifier sans perdre la précision

FORMAT JSON attendu :
[
  {
    "title": "Version équilibrée - [Nom]",
    "clauseText": "[Clause révisée max 200 mots]",
    "benefits": "[Améliorations en 40-60 mots]",
    "riskReduction": "[Réduction risque en 25-35 mots]",
    "legalBasis": "[Base légale principale]",
    "negotiationTips": ["Point clé 1 (max 12 mots)", "Point clé 2 (max 12 mots)"],
    "adaptationLevel": "moderate"
  }
]`;
  } else {
    return basePrompt + `
🎯 NIVEAU SIMPLE détecté (${clauseLength} caractères)
- Reformuler clairement et simplement
- Éliminer les ambiguïtés principales
- Protections essentielles uniquement

FORMAT JSON attendu :
[
  {
    "title": "Version claire et sécurisée",
    "clauseText": "[Clause claire max 150 mots]",
    "benefits": "[Clarté améliorée en 30-50 mots]",
    "riskReduction": "[Réduction risque en 20-30 mots]",
    "legalBasis": "[Principe légal principal]",
    "negotiationTips": ["Argument principal (max 10 mots)"],
    "adaptationLevel": "simple"
  }
]`;
  }
}

/**
 * 🔧 GÉNÈRE DES RECOMMANDATIONS ADAPTATIVES POUR UNE CLAUSE
 */
export async function getRecommendedClauses(
  clause: ClauseRisk,
  context?: AnalysisContext,
  model: OpenAIModelId = DEFAULT_MODEL
): Promise<ClauseRecommendation[]> {
  try {
    console.log(`🤖 Appel API OpenAI ${model} pour "${clause.type}" (${clause.content.length} caractères)`);

    const prompt = generateAdaptivePrompt(clause, context);
    const systemPrompt = 'Tu es un avocat expert français spécialisé en rédaction contractuelle et optimisation des clauses.';

    const rawContent = usesResponsesApi(model)
      ? await callOpenAi52(`${systemPrompt}\n\n${prompt}`, 'medium', 'medium', model)
      : await callOpenAI(
        [
          {
            role: 'system',
            content: systemPrompt,
          },
          { role: 'user', content: prompt },
        ],
        { model, temperature: 0.3, max_tokens: 2000 }
      );

    const recommendations = safeJSON(rawContent);

    console.log(`✅ ${recommendations.length} recommandations générées par l'API pour "${clause.type}"`);

    return recommendations;
  } catch (error) {
    console.error('❌ Erreur lors de la génération des recommandations via API:', error);
    console.log('🛡️ Utilisation du fallback de recommandations locales');
    return generateFallbackRecommendations(clause);
  }
}

/**
 * 🛡️ GÉNÈRE DES RECOMMANDATIONS DE FALLBACK LOCALES QUAND L'API ÉCHOUE
 * Intègre une logique adaptative pour les types de clauses courants.
 */
function generateFallbackRecommendations(clause: ClauseRisk): ClauseRecommendation[] {
  const recommendations: ClauseRecommendation[] = [];
  const clauseLength = clause.content.length;
  console.log(`🛡️ Utilisation du fallback local pour "${clause.type}" (${clauseLength} caractères)`);

  // Définir la stratégie en fonction de la longueur
  let strategy: 'full' | 'condensed' | 'summary';
  if (clauseLength <= 300) {
    strategy = 'full';
  } else if (clauseLength <= 800) {
    strategy = 'condensed';
  } else {
    strategy = 'summary';
  }

  switch (clause.type.toLowerCase()) {
    case 'résiliation':
      if (strategy === 'summary') {
        recommendations.push({
          title: "Clause de résiliation (Version Résumée)",
          clauseText: `Chaque partie peut résilier ce contrat moyennant un préavis de [X] mois, notifié par lettre recommandée avec accusé de réception. En cas de manquement grave par l'une des parties à ses obligations, l'autre partie pourra résilier le contrat de plein droit, 15 jours après une mise en demeure restée sans effet.`,
          benefits: "Version concise et équilibrée qui protège les deux parties en cas de faute grave tout en permettant une sortie négociée.",
          riskReduction: "Risque faible. Procédure claire pour faute grave et sécurité juridique accrue.",
          negotiationTips: ["Définir la durée du préavis", "Préciser les cas de faute grave"],
          adaptationLevel: 'simple'
        });
      } else { // 'full' ou 'condensed'
        recommendations.push({
          title: "Clause de résiliation équilibrée",
          clauseText: `Le présent contrat pourra être résilié par l'une ou l'autre des parties, à tout moment, par lettre recommandée avec accusé de réception, moyennant le respect d'un préavis de [DUREE, ex: trois mois].\nEn cas de manquement par l'une des parties à l'une de ses obligations contractuelles, non réparé dans un délai de trente (30) jours à compter de la réception d'une mise en demeure, l'autre partie pourra résilier le contrat de plein droit, sans préjudice de tous dommages et intérêts.`,
          benefits: "Cette clause établit un équilibre clair entre une sortie négociée (avec préavis) et une sanction en cas de faute (résiliation de plein droit).",
          riskReduction: "Risque faible. Préavis réciproque, procédure de mise en demeure, et protection contre les manquements.",
          negotiationTips: ["Négocier la durée du préavis", "Définir les obligations essentielles"],
          adaptationLevel: 'moderate'
        });
      }
      break;

    case 'dépôt de garantie':
      const depositAmount = extractDepositAmount(clause.content);
      recommendations.push({
        title: "Dépôt de garantie conforme (Loi 89)",
        clauseText: `Le dépôt de garantie, fixé à ${depositAmount || '[1 mois]'} de loyer hors charges, sera restitué dans un délai maximal de 1 mois à compter de la remise des clés si l'état des lieux de sortie est conforme à celui d'entrée, ou de 2 mois en cas de différences. Toute retenue devra être dûment justifiée.`,
        benefits: "Cette formulation est conforme à la loi du 6 juillet 1989, protégeant le locataire contre les retenues abusives et les délais excessifs.",
        riskReduction: "Risque faible. Montant légal, délais de restitution clairs, et obligation de justification des retenues.",
        legalBasis: "Loi n° 89-462 du 6 juillet 1989",
        negotiationTips: ["Vérifier le montant du dépôt", "Exiger un état des lieux précis"],
        adaptationLevel: 'simple'
      });
      break;
    
    default:
      // Fallback générique pour les autres clauses
      recommendations.push({
        title: `Révision recommandée - ${clause.type}`,
        clauseText: `Clause révisée nécessitant une consultation juridique spécialisée pour adapter "${clause.type}" selon vos besoins spécifiques.`,
        benefits: 'Protection juridique renforcée et clarification des termes',
        riskReduction: `Réduction potentielle du risque de ${clause.riskScore}/5 vers 2-3/5 avec révision appropriée`,
        legalBasis: 'Code civil français et jurisprudence applicable',
        negotiationTips: [
          'Consulter un avocat spécialisé',
          'Négocier les termes les plus contraignants',
          'Ajouter des clauses de sauvegarde'
        ],
        adaptationLevel: clause.content.length > 500 ? 'complex' : 
                        clause.content.length > 200 ? 'moderate' : 'simple'
      });
  }
  
  console.log(`✅ ${recommendations.length} recommandations locales générées pour "${clause.type}"`);
  return recommendations;
}

// Fonction helper pour extraire le montant du dépôt
function extractDepositAmount(content: string): string | null {
  const match = content.match(/(\d+\s*(?:mois|€|euros?))/i);
  return match ? match[1] : null;
}
