import { ClauseRisk } from "../../types";

/**
 * 📊 Parsing de la réponse IA et création des objets ClauseRisk
 *
 * @param response 
 * @returns { ClauseRisk[]}
 */
export function parseAIResponse(response: string): ClauseRisk[] {
    console.log('[DEBUG] 🔍 Parsing de la réponse IA brute...');
    let cleanedText = response.trim();
    if (cleanedText.startsWith('```json')) { cleanedText = cleanedText.substring(7).trim() }
    if (cleanedText.endsWith('```')) { cleanedText = cleanedText.slice(0, -3).trim() }
    try {
        const parsedResponse = JSON.parse(cleanedText);
        if (!parsedResponse.clauses || !Array.isArray(parsedResponse.clauses)) {
            console.error('❌ [ERREUR] Réponse JSON invalide: la clé "clauses" est manquante ou n\'est pas un tableau.');
            return [];
        }

        const clauses: ClauseRisk[] = [];
        parsedResponse.clauses.forEach((parsed: any, index: number) => {
            if (parsed.type && parsed.text && parsed.riskScore && typeof parsed.startIndex === 'number' && typeof parsed.endIndex === 'number' && Array.isArray(parsed.keywords)) {
                const clause: ClauseRisk = {
                    id: `ai-clause-${Date.now()}-${index}`,
                    type: parsed.type,
                    content: parsed.text,
                    riskScore: Math.min(5, Math.max(1, parsed.riskScore)),
                    category: mapTypeToCategory(parsed.type),
                    justification: parsed.justification || 'Clause identifiée par IA',
                    suggestion: parsed.suggestion || 'Révision recommandée',
                    page: 1,
                    keywords: parsed.keywords,
                    startIndex: parsed.startIndex,
                    endIndex: parsed.endIndex,
                };
                clauses.push(clause);
            } else {
                console.warn(`⚠️ [ATTENTION] Clause ${index + 1} ignorée (champs manquants ou invalides):`, parsed);
            }
        });

        return clauses;

    } catch (error) {
        console.error('❌ [ERREUR] Erreur de parsing JSON:', error);
        console.error('[DEBUG] 📄 Réponse reçue (après nettoyage):', cleanedText);
        return [];
    }
}
/**
 *  Mappage du type vers la catégorie d'une clause
 */
function mapTypeToCategory(type: string): 'termination' | 'penalty' | 'responsibility' | 'confidentiality' | 'nonCompete' | 'warranty' | 'other' {
    const typeMap: Record<string, string> = {
        'résiliation': 'termination',
        'pénalité': 'penalty',
        'responsabilité': 'responsibility',
        'confidentialité': 'confidentiality',
        'non-concurrence': 'nonCompete',
        'garantie': 'warranty'
    };

    const normalizedType = type.toLowerCase();

    for (const [key, category] of Object.entries(typeMap)) {
        if (normalizedType.includes(key)) {
            return category as any;
        }
    }

    return 'other';
}
/**
 * 📊 Calcul du profil de risque
 */
export function calculateRiskProfile(clauses: ClauseRisk[]): {
    overall: 'low' | 'medium' | 'high';
    distribution: { high: number; medium: number; low: number };
} {
    const distribution = {
        high: clauses.filter(c => c.riskScore >= 4).length,
        medium: clauses.filter(c => c.riskScore === 3).length,
        low: clauses.filter(c => c.riskScore < 3).length
    };
    const avgRisk = clauses.length > 0 ? clauses.reduce((sum, c) => sum + c.riskScore, 0) / clauses.length : 0;

    let overall: 'low' | 'medium' | 'high' = 'low';
    if (avgRisk >= 3.5 || distribution.high > 2) overall = 'high';
    else if (avgRisk >= 2.5 || distribution.high > 0 || distribution.medium > 1) overall = 'medium';

    return { overall, distribution };
}
