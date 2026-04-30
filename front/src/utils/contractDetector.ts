/* ------------------------------------------------------------------
   Détection automatique du type de contrat et du rôle utilisateur
   ------------------------------------------------------------------ */

import { AnalysisContext } from '../types/contextualAnalysis';
import { callOpenAI } from './aiClient';


// Types pour la détection
export interface DetectedContractInfo {
  suggestedContractType: string;
  confidence: number;
  detectedKeywords: string[];
  suggestedUserRole: string;
  reasoning: string;
}

// Patterns de détection pour différents types de contrats
export const CONTRACT_PATTERNS = {
  mariage: {
    keywords: ['mariage', 'époux', 'épouse', 'conjoint', 'régime matrimonial', 'communauté', 'séparation de biens', 'contrat de mariage', 'notaire', 'dots', 'apport', 'biens propres'],
    strongIndicators: ['contrat de mariage', 'régime matrimonial', 'séparation de biens', 'communauté réduite aux acquêts'],
    contractType: 'Contrat de mariage',
    possibleRoles: ['Futur époux/épouse', 'Conjoint']
  },
  pacs: {
    keywords: ['pacs', 'pacte civil', 'solidarité', 'partenaires', 'cohabitants', 'concubins', 'vie commune'],
    strongIndicators: ['pacte civil de solidarité', 'pacs', 'partenaires pacsés'],
    contractType: 'PACS',
    possibleRoles: ['Partenaire PACS', 'Cohabitant']
  },
  emploi: {
    keywords: ['travail', 'salarié', 'employeur', 'poste', 'fonction', 'salaire', 'rémunération', 'congés', 'préavis', 'cdi', 'cdd', 'stage', 'embauche', 'recrutement', 'collaborateur', 'équipe'],
    strongIndicators: ['contrat de travail', 'code du travail', 'convention collective', 'embauche'],
    contractType: 'Contrat de travail',
    possibleRoles: ['Employé/Salarié', 'Employeur']
  },
  commercial: {
    keywords: ['vente', 'achat', 'fourniture', 'livraison', 'commande', 'produit', 'marchandises', 'client', 'fournisseur', 'prix', 'facturation', 'commerce', 'commercial', 'acheter', 'vendre'],
    strongIndicators: ['contrat de vente', 'conditions générales de vente', 'bon de commande', 'achat', 'vente'],
    contractType: 'Contrat commercial',
    possibleRoles: ['Acheteur/Client', 'Vendeur/Fournisseur']
  },
  prestation: {
    keywords: ['prestation', 'services', 'mission', 'consultant', 'expertise', 'conseil', 'développement', 'maintenance', 'assistance', 'prestations', 'service', 'coworking', 'espace de travail', 'bureau', 'location d\'espace'],
    strongIndicators: ['contrat de prestation', 'prestations de services', 'cahier des charges', 'prestation de service', 'coworking', 'espace de travail partagé'],
    contractType: 'Contrat de prestation de services',
    possibleRoles: ['Client de services', 'Prestataire de services']
  },
  bail: {
    keywords: ['bail', 'location', 'loyer', 'locataire', 'bailleur', 'propriétaire', 'logement', 'local', 'dépôt de garantie', 'charges', 'louer', 'loué'],
    strongIndicators: ['contrat de bail', 'bail commercial', 'bail d\'habitation', 'location'],
    contractType: 'Contrat de bail',
    possibleRoles: ['Locataire', 'Propriétaire/Bailleur']
  },
  assurance: {
    keywords: ['assurance', 'police', 'prime', 'sinistre', 'couverture', 'garantie', 'assuré', 'assureur', 'indemnisation', 'souscripteur'],
    strongIndicators: ['contrat d\'assurance', 'police d\'assurance', 'conditions générales', 'assurance'],
    contractType: 'Contrat d\'assurance',
    possibleRoles: ['Assuré', 'Assureur']
  },
  pret: {
    keywords: ['prêt', 'crédit', 'emprunt', 'banque', 'taux', 'intérêts', 'remboursement', 'échéances', 'garanties', 'caution', 'financement'],
    strongIndicators: ['contrat de prêt', 'contrat de crédit', 'offre de prêt', 'prêt', 'crédit'],
    contractType: 'Contrat de prêt/crédit',
    possibleRoles: ['Emprunteur', 'Prêteur/Banque']
  },
  franchise: {
    keywords: ['franchise', 'franchisé', 'franchiseur', 'enseigne', 'marque', 'réseau', 'redevance', 'territoire', 'exclusivité'],
    strongIndicators: ['contrat de franchise', 'document d\'information précontractuel', 'franchise'],
    contractType: 'Contrat de franchise',
    possibleRoles: ['Franchisé', 'Franchiseur']
  },
  licence: {
    keywords: ['licence', 'brevet', 'propriété intellectuelle', 'droits', 'utilisation', 'logiciel', 'technologie', 'redevances', 'copyright'],
    strongIndicators: ['contrat de licence', 'licence d\'utilisation', 'propriété intellectuelle', 'licence'],
    contractType: 'Contrat de licence',
    possibleRoles: ['Bénéficiaire de licence', 'Concédant de licence']
  },
  mandat: {
    keywords: ['mandat', 'mandataire', 'mandant', 'représentation', 'pouvoir', 'procuration', 'agent', 'courtier', 'représenter'],
    strongIndicators: ['contrat de mandat', 'mandat de représentation', 'pouvoir', 'mandat'],
    contractType: 'Contrat de mandat',
    possibleRoles: ['Mandant/Donneur d\'ordres', 'Mandataire/Représentant']
  },
  // Nouveau pattern pour des contrats génériques
  general: {
    keywords: ['contrat', 'accord', 'convention', 'partie', 'parties', 'obligation', 'engagement', 'clause', 'article', 'conditions', 'signature', 'signataire'],
    strongIndicators: ['le présent contrat', 'les parties conviennent', 'accord entre', 'convention'],
    contractType: 'Contrat général',
    possibleRoles: ['Partie contractante', 'Cocontractant']
  }
};

// Patterns pour détecter le rôle de l'utilisateur dans le texte
const ROLE_DETECTION_PATTERNS = {
  // Indicateurs que l'utilisateur est un acheteur/client
  buyer_client: {
    patterns: ['je souhaite acheter', 'nous achetons', 'en tant qu\'acheteur', 'client', 'acquéreur', 'je commande'],
    roles: ['Acheteur/Client', 'Client de services', 'Locataire', 'Emprunteur', 'Assuré', 'Franchisé']
  },
  // Indicateurs que l'utilisateur est un vendeur/prestataire
  seller_provider: {
    patterns: ['je vends', 'nous vendons', 'en tant que vendeur', 'fournisseur', 'prestataire', 'nous livrons'],
    roles: ['Vendeur/Fournisseur', 'Prestataire de services', 'Propriétaire/Bailleur', 'Prêteur/Banque', 'Assureur', 'Franchiseur']
  },
  // Indicateurs que l'utilisateur est un employé
  employee: {
    patterns: ['je travaille', 'mon emploi', 'en tant qu\'employé', 'salarié', 'mon poste', 'ma fonction'],
    roles: ['Employé/Salarié']
  },
  // Indicateurs que l'utilisateur est un employeur
  employer: {
    patterns: ['nous embauchons', 'en tant qu\'employeur', 'notre entreprise embauche', 'recrutement'],
    roles: ['Employeur']
  }
};

/**
 * Analyse le texte d'un contrat et détecte automatiquement son type et les rôles possibles
 */
export function detectContractInfo(contractText: string): DetectedContractInfo {
  const text = contractText.toLowerCase();
  const results: Array<{
    type: string;
    score: number;
    detectedKeywords: string[];
    reasoning: string;
    possibleRoles: string[];
  }> = [];

  console.log('🔍 Analyse du texte pour détection de type de contrat...');
  
  // Analyse chaque type de contrat
  for (const [key, pattern] of Object.entries(CONTRACT_PATTERNS)) {
    let score = 0;
    const detectedKeywords: string[] = [];
    
    // Points pour les mots-clés normaux (score plus généreux)
    for (const keyword of pattern.keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        // Augmenter le score de base de 1 à 2 points par occurrence
        score += matches.length * 2;
        detectedKeywords.push(keyword);
        console.log(`   🎯 Mot-clé "${keyword}" trouvé ${matches.length} fois dans ${key}`);
      }
    }
    
    // Points bonus pour les indicateurs forts (encore plus généreux)
    for (const indicator of pattern.strongIndicators) {
      const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        // Augmenter le bonus de 5 à 10 points
        score += matches.length * 10;
        detectedKeywords.push(indicator);
        console.log(`   ⭐ Indicateur fort "${indicator}" trouvé ${matches.length} fois dans ${key} (bonus x10)`);
      }
    }
    
    if (score > 0) {
      console.log(`📊 Score total pour ${key}: ${score} points`);
      results.push({
        type: pattern.contractType,
        score,
        detectedKeywords,
        reasoning: `Détecté grâce aux mots-clés: ${detectedKeywords.join(', ')} (score: ${score})`,
        possibleRoles: pattern.possibleRoles
      });
    }
  }

  // Tri par score décroissant
  results.sort((a, b) => b.score - a.score);
  console.log('📈 Résultats triés par score:', results.map(r => ({ type: r.type, score: r.score })));

  if (results.length === 0) {
    console.log('❌ Aucun pattern de contrat détecté');
    return {
      suggestedContractType: 'Autre type de contrat',
      suggestedUserRole: 'Autre rôle',
      confidence: 0,
      detectedKeywords: [],
      reasoning: 'Aucun pattern de contrat spécifique détecté'
    };
  }

  const best = results[0];
  // Changer la normalisation pour être plus sensible : diviser par 5 au lieu de 10
  const confidence = Math.min(best.score / 5, 1);
  console.log(`🏆 Meilleur résultat: ${best.type} avec score ${best.score} => confidence ${confidence}`);

  // Analyse contextuelle pour déterminer le rôle probable
  let suggestedRole = best.possibleRoles[0]; // Par défaut le premier
  
  // Logique pour deviner le rôle le plus probable
  if (best.type.includes('mariage') || best.type.includes('PACS')) {
    suggestedRole = best.possibleRoles[0];
  } else if (best.type.includes('emploi')) {
    // Recherche d'indices sur le rôle
    if (text.includes('embauche') || text.includes('recrute') || text.includes('société')) {
      suggestedRole = 'Employeur';
    } else {
      suggestedRole = 'Employé/Salarié';
    }
  } else if (best.type.includes('commercial')) {
    if (text.includes('vend') || text.includes('fournit') || text.includes('société')) {
      suggestedRole = 'Vendeur/Fournisseur';
    } else {
      suggestedRole = 'Acheteur/Client';
    }
  } else if (best.type.includes('bail')) {
    if (text.includes('loue') || text.includes('baille') || text.includes('propriétaire')) {
      suggestedRole = 'Propriétaire/Bailleur';
    } else {
      suggestedRole = 'Locataire';
    }
  }

  const result = {
    suggestedContractType: best.type,
    suggestedUserRole: suggestedRole,
    confidence,
    detectedKeywords: best.detectedKeywords,
    reasoning: best.reasoning
  };
  
  console.log('✅ Résultat final de détection:', result);
  return result;
}

/**
 * Détecte automatiquement le rôle le plus probable de l'utilisateur
 */
export function detectUserRole(contractText: string, contractType: string): string {
  const text = contractText.toLowerCase();
  const scores: { [role: string]: number } = {};
  
  // Analyser les patterns de rôle
  for (const [, data] of Object.entries(ROLE_DETECTION_PATTERNS)) {
    for (const pattern of data.patterns) {
      if (text.includes(pattern)) {
        // Augmenter le score des rôles correspondants
        for (const role of data.roles) {
          scores[role] = (scores[role] || 0) + 1;
        }
      }
    }
  }
  
  // Trouver le rôle avec le meilleur score qui correspond au type de contrat
  const contractPattern = Object.values(CONTRACT_PATTERNS).find(p => p.contractType === contractType);
  if (contractPattern) {
    let bestRole = contractPattern.possibleRoles[0]; // Par défaut le premier
    let bestScore = 0;
    
    for (const role of contractPattern.possibleRoles) {
      const score = scores[role] || 0;
      if (score > bestScore) {
        bestScore = score;
        bestRole = role;
      }
    }
    
    return bestRole;
  }
  
  return 'Partie contractante';
}

/**
 * Génère des suggestions de questions spécifiques selon le type de contrat détecté
 */
export function generateSpecificQuestions(contractType: string): string[] {
  const questions: Record<string, string[]> = {
    'Contrat de mariage': [
      'Quels sont mes droits en cas de divorce ?',
      'Comment sont protégés mes biens personnels ?',
      'Que devient le patrimoine commun ?',
      'Y a-t-il des clauses de protection particulières ?'
    ],
    'PACS': [
      'Comment se déroule la rupture du PACS ?',
      'Quels sont nos droits respectifs sur les biens ?',
      'Comment sont gérées les dettes communes ?',
      'Puis-je modifier les clauses plus tard ?'
    ],
    'Contrat de travail': [
      'Quelles sont les conditions de rupture ?',
      'Mon salaire est-il garanti ?',
      'Quels sont mes droits aux congés ?',
      'Y a-t-il une clause de non-concurrence ?'
    ],
    'Contrat commercial': [
      'Les prix sont-ils fermes ?',
      'Quelles sont les pénalités de retard ?',
      'Comment sont gérés les litiges ?',
      'Puis-je résilier en cas de problème ?'
    ],
    'Contrat de bail': [
      'Puis-je résilier avant la fin ?',
      'Quand récupérer mon dépôt de garantie ?',
      'Qui paie les réparations ?',
      'Le loyer peut-il augmenter ?'
    ]
  };

  return questions[contractType] || [
    'Quels sont mes principaux droits ?',
    'Quelles sont mes obligations ?',
    'Comment puis-je sortir du contrat ?',
    'Y a-t-il des risques particuliers ?'
  ];
}

/**
 * Détection intelligente avec GPT-4o-mini pour pré-remplir le formulaire.
 * TOUT est déterminé par l'IA, aucune variable statique
 */
export async function detectContractWithAI(text: string): Promise<AnalysisContext> {

  const prompt = `Tu es un expert juridique. Analyse cet extrait de contrat et détermine intelligemment les informations suivantes.

IMPORTANT: Ne te limite pas à des catégories pré-définies. Sois précis et adapte tes réponses au contenu réel du document.

Retourne un JSON avec:
- contractType: Le type EXACT et précis du contrat (ex: "Bail commercial 3-6-9 avec clause de révision triennale", "CDI cadre au forfait jour avec clause de mobilité internationale")
- userRole: Le rôle le plus probable de la personne qui analyse ce contrat (ex: "Locataire commerçant indépendant", "Salarié cadre supérieur")
- specificQuestions: Des questions pertinentes à poser pour cette analyse (ex: "Vérifier la clause de révision du loyer et les conditions de cession du bail")
- mission: Une mission d'analyse suggérée basée sur le contenu (ex: "Protéger les intérêts du locataire face aux clauses de révision et garantir la possibilité de cession")
- legalRegime: Le régime juridique le plus probable applicable au contrat (ex: "Droit privé - bail commercial", "Droit du travail - CDI")
- contractObjective: L'objectif principal et concret du contrat (ex: "Louer un local commercial", "Encadrer une relation de travail durable")
- analysisDepth: "quick", "detailed" ou "expert" selon la complexité détectée
- interestOrientation: "defensive", "balanced" ou "assertive" selon le rôle détecté

Ne te base sur AUCUNE liste pré-définie. Analyse le contenu et déduis tout de manière intelligente.

Extrait du contrat:
"""
${text.substring(0, 4000)}
"""

Réponds UNIQUEMENT avec le JSON, sans explication.`;

  try {
    const txt = await callOpenAI(
      [{ role: 'user', content: prompt }],
      { model: 'gpt-4o-mini', temperature: 0.3, max_tokens: 500, response_format: { type: 'json_object' } }
    );
    const result = JSON.parse(txt);
    
    console.log('🤖 Détection IA 100% dynamique:', result);
    
    // Vérifier que toutes les propriétés requises sont présentes
    return {
      contractType: result.contractType || '',
      userRole: result.userRole || '',
      specificQuestions: result.specificQuestions || '',
      analysisDepth: result.analysisDepth || 'detailed',
      interestOrientation: result.interestOrientation || 'balanced',
      mission: result.mission || '',
      legalRegime: result.legalRegime || '',
      contractObjective: result.contractObjective || '',
    };

  } catch (error) {
    console.error("❌ Erreur lors de la détection par IA:", error);
    // Retour minimal sans valeurs pré-définies
    return {
      contractType: '',
      userRole: '',
      specificQuestions: '',
      analysisDepth: 'detailed',
      interestOrientation: 'balanced',
      mission: '',
      legalRegime: '',
      contractObjective: '',
    };
  }
}
