import { ClauseRisk, KeywordSearchLink } from "../types";

/**
 * Génère une liste de liens de recherche Légifrance à partir des mots-clés d'une clause.
 */
export function getKeywordSearchLinks(
  clause: ClauseRisk | null,
): KeywordSearchLink[] {
  if (!clause || !clause.keywords || clause.keywords.length === 0) {
    console.log(
      "🟡 [Liens] Pas de mots-clés trouvés dans la clause. La liste de recherche sera vide.",
    );
    return [];
  }

  console.log(
    `✅ [Liens] Génération des liens pour les mots-clés:`,
    clause.keywords,
  );

  return clause.keywords.slice(0, 3).map((keyword) => ({
    query: keyword,
    url: `https://www.legifrance.gouv.fr/search/juri?tab_selection=juri&searchField=ALL&query=${encodeURIComponent(keyword)}&page=1&init=true`,
  }));
}
