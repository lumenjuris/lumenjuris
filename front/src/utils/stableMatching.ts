/* src/utils/stableMatching.ts
 * Système de matching stable entre texte analysé et DOM pour highlighting fiable
 * Utilise séquences de mots français uniquement, indépendant des espaces/positions
 */

interface WordPosition {
  word: string;
  node: Text;
  start: number;
  end: number;
}

interface MatchResult {
  found: boolean;
  confidence: number;
  startPosition?: WordPosition;
  endPosition?: WordPosition;
  pivotPosition?: WordPosition;
}

/* src/utils/stableMatching.ts
 * Système de matching stable entre texte analysé et DOM pour highlighting fiable
 * Utilise séquences de mots français uniquement, indépendant des espaces/positions
 */

interface WordPosition {
  word: string;
  node: Text;
  start: number;
  end: number;
}

interface MatchResult {
  found: boolean;
  confidence: number;
  startPosition?: WordPosition;
  endPosition?: WordPosition;
  pivotPosition?: WordPosition;
}

/**
 * Extrait UNIQUEMENT les mots français (avec accents) d'un texte
 * Ignore complètement ponctuation, espaces, chiffres, symboles
 */
function extractFrenchWords(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-záàâäéèêëïîôöùûüÿç]+/g);
  return matches ? matches.filter((word) => word.length > 2) : [];
}

/**
 * Trouve une séquence de mots dans le DOM avec TreeWalker
 */
function findWordSequenceInDOM(
  wordSequence: string[],
  container: Element,
  afterPosition?: WordPosition,
): WordPosition[] | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;

      const tagName = parent.tagName.toLowerCase();
      if (["script", "style", "noscript"].includes(tagName)) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  // Créer une liste linéaire de tous les mots français dans le DOM
  const allWords: WordPosition[] = [];
  let startSearchIndex = 0;

  textNodes.forEach((textNode) => {
    const text = textNode.textContent || "";
    const words = extractFrenchWords(text);
    let currentIndex = 0;

    words.forEach((word) => {
      const wordIndex = text.toLowerCase().indexOf(word, currentIndex);
      if (wordIndex !== -1) {
        const position: WordPosition = {
          word,
          node: textNode,
          start: wordIndex,
          end: wordIndex + word.length,
        };

        allWords.push(position);
        currentIndex = wordIndex + word.length;
      }
    });
  });

  // Si on a une position de départ, commencer la recherche après celle-ci
  if (afterPosition) {
    const afterIndex = allWords.findIndex(
      (pos) =>
        pos.node === afterPosition.node && pos.start >= afterPosition.end,
    );
    if (afterIndex !== -1) {
      startSearchIndex = afterIndex;
    }
  }

  // Chercher la séquence de mots
  for (
    let i = startSearchIndex;
    i <= allWords.length - wordSequence.length;
    i++
  ) {
    let matches = true;

    for (let j = 0; j < wordSequence.length; j++) {
      if (allWords[i + j].word !== wordSequence[j]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return allWords.slice(i, i + wordSequence.length);
    }
  }

  return null;
}

/**
 * Approche robuste : Recherche par début + fin + pivot central
 */
export function findStableMatch(
  clauseContent: string,
  domElement?: Element,
): MatchResult {
  const targetElement = domElement || document.body;

  // 1. Extraire mots français de la clause
  const clauseWords = extractFrenchWords(clauseContent);

  // 2. Vérifier que c'est une phrase complète (minimum 8 mots)
  if (clauseWords.length < 8) {
    return {
      found: false,
      confidence: 0,
    };
  }

  // 3. Définir séquences de début, fin et pivot
  const startSequence = clauseWords.slice(0, 3);
  const endSequence = clauseWords.slice(-3);
  const pivotWord = clauseWords[Math.floor(clauseWords.length / 2)];

  // 4. Rechercher séquence de début
  const startPositions = findWordSequenceInDOM(startSequence, targetElement);
  if (!startPositions) {
    return { found: false, confidence: 0 };
  }

  // 5. Rechercher mot pivot après le début
  const pivotPositions = findWordSequenceInDOM(
    [pivotWord],
    targetElement,
    startPositions[startPositions.length - 1],
  );
  if (!pivotPositions) {
    return { found: false, confidence: 50 };
  }

  // 6. Rechercher séquence de fin après le pivot
  const endPositions = findWordSequenceInDOM(
    endSequence,
    targetElement,
    pivotPositions[0],
  );
  if (!endPositions) {
    return { found: false, confidence: 70 };
  }

  // 7. Succès complet
  return {
    found: true,
    confidence: 100,
    startPosition: startPositions[0],
    endPosition: endPositions[endPositions.length - 1],
    pivotPosition: pivotPositions[0],
  };
}

/**
 * Crée le highlight entre deux positions DOM
 */
export function highlightClauseRange(
  matchResult: MatchResult,
  riskLevel: "High" | "Medium" | "Low",
): boolean {
  if (
    !matchResult.found ||
    !matchResult.startPosition ||
    !matchResult.endPosition
  ) {
    return false;
  }

  const colors = {
    High: "#ffebee",
    Medium: "#fff3e0",
    Low: "#e8f5e8",
  };

  const borders = {
    High: "#f44336",
    Medium: "#ff9800",
    Low: "#4caf50",
  };

  try {
    const range = document.createRange();
    range.setStart(
      matchResult.startPosition.node,
      matchResult.startPosition.start,
    );
    range.setEnd(matchResult.endPosition.node, matchResult.endPosition.end);

    // Créer le span de highlight
    const span = document.createElement("span");
    span.className = `clause-highlight clause-${riskLevel.toLowerCase()}`;
    span.style.backgroundColor = colors[riskLevel];
    span.style.borderLeft = `3px solid ${borders[riskLevel]}`;
    span.style.paddingLeft = "4px";
    span.style.paddingRight = "2px";
    span.style.borderRadius = "2px";
    span.title = `Clause à risque ${riskLevel} (confiance: ${matchResult.confidence}%)`;

    // Entourer le contenu
    try {
      range.surroundContents(span);
      return true;
    } catch (e) {
      // Fallback : extraire et recréer
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
      return true;
    }
  } catch (error) {
    console.warn("Erreur lors du highlighting:", error);
    return false;
  }
}

/**
 * Supprime tous les highlights existants
 */
export function clearAllHighlights(container?: Element): void {
  const target = container || document.body;
  const highlights = target.querySelectorAll(".clause-highlight");

  highlights.forEach((highlight) => {
    const parent = highlight.parentNode;
    if (parent) {
      // Replacer le contenu sans le span
      while (highlight.firstChild) {
        parent.insertBefore(highlight.firstChild, highlight);
      }
      parent.removeChild(highlight);

      // Normaliser les nœuds texte adjacents
      parent.normalize();
    }
  });
}
