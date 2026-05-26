/**
 * 🧹 NETTOYEUR DE TEXTE ULTRA-ROBUSTE
 * Corrige les problèmes d'extraction PDF.js
 */

/**
 * Nettoie et remet en forme le texte extrait d'un PDF
 */
export function cleanExtractedText(rawText: string): string {
  if (!rawText || typeof rawText !== "string") {
    return "";
  }

  let cleanedText = rawText;

  // 1. Supprimer les marqueurs de page
  cleanedText = cleanedText.replace(/=== PAGE \d+ ===/g, "");

  // 2. Corriger les espaces multiples et les retours à la ligne excessifs
  cleanedText = cleanedText.replace(/\s+/g, " ");
  cleanedText = cleanedText.replace(/\n\s*\n/g, "\n\n");

  // 3. Corriger les mots coupés (trait d'union en fin de ligne)
  cleanedText = cleanedText.replace(
    /([a-zàâäéèêëïîôöùûüÿç])-\s+([a-zàâäéèêëïîôöùûüÿç])/gi,
    "$1$2",
  );

  // 4. Corriger les espaces avant la ponctuation
  cleanedText = cleanedText.replace(/\s+([,.;:!?])/g, "$1");

  // 5. Corriger les espaces après les parenthèses ouvrantes et avant les fermantes
  cleanedText = cleanedText.replace(/\(\s+/g, "(");
  cleanedText = cleanedText.replace(/\s+\)/g, ")");

  // 6. Corriger les guillemets
  cleanedText = cleanedText.replace(/\s*"\s*/g, '"');
  cleanedText = cleanedText.replace(/\s*«\s*/g, "« ");
  cleanedText = cleanedText.replace(/\s*»\s*/g, " »");

  // 7. Corriger les apostrophes
  cleanedText = cleanedText.replace(/\s*'\s*/g, "'");
  cleanedText = cleanedText.replace(/\s*'\s*/g, "'");

  // 8. Supprimer les caractères de contrôle et débris
  cleanedText = cleanedText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // 9. Corriger les doubles espaces restants
  cleanedText = cleanedText.replace(/  +/g, " ");

  // 10. Nettoyer le début et la fin
  cleanedText = cleanedText.trim();

  // 11. Restructurer les paragraphes
  cleanedText = cleanedText.replace(/\n\s*/g, "\n\n");

  return cleanedText;
}

/**
 * Améliore la mise en forme pour la recherche de clauses
 */
export function formatForClauseMatching(text: string): string {
  let formatted = cleanExtractedText(text);

  // 1. Identifier et séparer les articles
  formatted = formatted.replace(/(ARTICLE\s+\d+[^\n]*)/gi, "\n\n$1\n\n");

  // 2. Identifier et séparer les clauses importantes
  const clausePatterns = [
    /(?:Le\s+(?:Client|Prestataire|Contractant))/gi,
    /(?:En\s+cas\s+de)/gi,
    /(?:Il\s+est\s+convenu)/gi,
    /(?:Les\s+parties\s+conviennent)/gi,
    /(?:Toute\s+(?:résiliation|modification))/gi,
  ];

  clausePatterns.forEach((pattern) => {
    formatted = formatted.replace(pattern, "\n\n$&");
  });

  // 3. Nettoyer les espaces multiples créés
  formatted = formatted.replace(/\n\n+/g, "\n\n");
  formatted = formatted.trim();

  return formatted;
}

/**
 * Normalise le texte pour la comparaison
 */
export function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[''`]/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[àâä]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[ïî]/g, "i")
    .replace(/[ôö]/g, "o")
    .replace(/[ùûü]/g, "u")
    .replace(/[ÿ]/g, "y")
    .replace(/[ç]/g, "c")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
