import { ClauseRisk, JurisprudenceCase } from '../types';
import { fetchProxy } from './fetchProxy';
/**
 * Appelle la route /jurisprudence du backend Python avec une requête simple.
 */
async function fetchDecisionsFromBackend(query: string): Promise<JurisprudenceCase[] | null> {


  const backendUrl = `/jurisprudence`;

  // Le backend attend un objet avec une clé "queries" qui est une liste de strings.
  const payload = { 
    queries: [query],
  };

  try {
    console.log(`🚀 [API Auto] Appel du backend avec la requête: "${query}"`);
    const response = await fetchProxy(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Le backend a répondu avec le statut ${response.status}: ${errorText}`);
    }
    
    // Le backend retourne maintenant directement un tableau de cas.
    return await response.json();
  } catch (error) {
    console.error("❌ [API Auto] Échec de l'appel au backend:", error);
    return null;
  }
}

/**
 * Transforme la réponse de l'API en notre format interne (JurisprudenceCase).
 * NOTE: Cette fonction n'est plus strictement nécessaire si le backend retourne déjà le bon format,
 * mais nous la gardons pour valider et nettoyer les données.
 */
function mapApiResponseToJurisprudence(apiResponse: any[]): JurisprudenceCase[] {
  if (!Array.isArray(apiResponse)) {
    return [];
  }
  return apiResponse.map((item: any) => ({
    id: item.url || `case-${Math.random()}`,
    title: item.title || '', // Laisser vide, le composant gérera le fallback
    url: item.url,
    summary: item.summary || '',
    court: item.court || '', // Laisser vide, le composant gérera l'affichage
    year: item.year,
    relevanceScore: item.relevanceScore || 0.8,
    citation: item.citation,
    date: item.date,
    keyPrinciples: item.keyPrinciples,
  }));
}




/**
 * Fonction principale qui récupère les décisions de jurisprudence pertinentes
 * de manière automatique pour une clause donnée.
 */
export async function getAutomaticDecisions(clause: ClauseRisk | null): Promise<JurisprudenceCase[]> {
  
  if (!clause || !clause.keywords || clause.keywords.length === 0) {
    return [];
  }

  // On crée une requête simple et propre pour l'API.
  // On prend le type de la clause et le premier mot-clé le plus pertinent.
  const apiQuery = `${clause.type} ${clause.keywords?.[0] || ''}`.trim();

  const apiResponse = await fetchDecisionsFromBackend(apiQuery);
  
  if (apiResponse) {
    const cases = mapApiResponseToJurisprudence(apiResponse);
    if (cases.length > 0) {
      console.log(`✅ [API Auto] ${cases.length} décisions pertinentes reçues du backend.`);
    }
    return cases;
  }

  return [];
}