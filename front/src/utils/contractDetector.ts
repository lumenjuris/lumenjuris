import type { AnalysisContext } from "../types/contextualAnalysis";
import { fetchProxy } from "./fetchProxy";

<<<<<<< HEAD
export async function detectContractWithAI(
  text: string,
): Promise<AnalysisContext> {
  const res = await fetchProxy("/api/detect-contract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`detect-contract error ${res.status}`);
  return (await res.json()) as AnalysisContext;
=======
import { AnalysisContext } from '../types/contextualAnalysis';
import { callOpenAI } from './aiClient';


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
>>>>>>> main
}
