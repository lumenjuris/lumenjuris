import { ClauseRisk } from '../types';
import { findStableMatch } from './stableMatching';
import Fuse from 'fuse.js';

interface HighlightResult {
  success: boolean;
  method: string;
  confidence: number;
  message: string;
}

type MatchPos = { found: true; start: number; end: number } | { found: false };



class ModernHighlighter {
  private isSupported: boolean;
  private readonly highlightName = 'clause-highlight';
  private readonly styleId = 'clause-highlight-style';
  // Helpers de scroll (déclarés pour TS, implémentés plus bas)
  public scrollRangeIntoCenter!: (container: HTMLElement, range: Range) => void;
  public scrollElementIntoCenter!: (container: HTMLElement, element: HTMLElement) => void;

  constructor() {
    this.isSupported = !!(window.CSS && (CSS as any).highlights);
    console.log(this.isSupported ? '✅ CSS Custom Highlights supported' : '⚠️ Fallback mode');
    this.ensureHighlightStyle(); // <-- injection auto
  }

  // Méthode de test pour vérifier le surlignement
  testHighlighting(clause: ClauseRisk, container: HTMLElement): void {
    console.log('🧪 === TEST DE SURLIGNEMENT ===');
    console.log('🧪 Clause:', clause.type);
    console.log('🧪 Contenu:', clause.content.substring(0, 100) + '...');
    console.log('🧪 Mots-clés:', clause.keywords);

    const result = this.highlightClause(clause, container);
    console.log('🧪 Résultat:', result);
    console.log('🧪 === FIN DU TEST ===');
  }

  highlightClause(clause: ClauseRisk, container: HTMLElement): boolean {
    try {
      console.log(`🎯 Highlighting clause: ${clause.type}`);
      console.log(`🎯 Contenu: "${clause.content.substring(0, 50)}..."`);

      // Clear previous highlights
      this.clearHighlights();

      // Stratégie moderne précise
      const result = this.attemptModernHighlighting(clause, container);

      if (result.success) {
        console.log(`✅ ${result.method} - ${result.message}`);
        return true;
      }

      // Essai final: matching robuste par séquence de mots (insensible aux espaces/ponctuation)
      const stable = this.attemptStableWordSequenceHighlighting(clause, container);
      if (stable.success) {
        console.log(`✅ ${stable.method} - ${stable.message}`);
        return true;
      }

      // Fallback par blocs si tout a échoué
      console.log(`⚠️ Modern highlighting failed, using UX-friendly fallback`);
      return this.uxFriendlyFallback(clause, container);

    } catch (error) {
      console.error('❌ Erreur de surlignement:', error);
      return this.uxFriendlyFallback(clause, container);
    }
  }

  // Nouvelle méthode pour surligner toutes les clauses d'un coup
  highlightAllClauses(clauses: ClauseRisk[], container: HTMLElement): number {
    console.log(`🎯 Highlighting all ${clauses.length} clauses`);

    // Clear tous les highlights précédents
    this.clearAllHighlights();

    let successCount = 0;

    // Grouper les clauses par niveau de risque
    const clausesByRisk = {
      high: clauses.filter(c => c.riskScore === 5),
      medium: clauses.filter(c => c.riskScore >= 3 && c.riskScore < 5),
      low: clauses.filter(c => c.riskScore < 3)
    };

    if (this.isSupported && (CSS as any).highlights) {
      // Traiter chaque groupe de risque
      for (const [riskLevel, riskClauses] of Object.entries(clausesByRisk)) {
        if (riskClauses.length === 0) continue;

        const ranges: Range[] = [];

        for (const clause of riskClauses) {
          let rangeFound = false;
          try {
            // MÉTHODE 1: Recherche sémantique (on ignore les offsets pour l’auto-highlight)
            const result = this.findRangesForClause(clause, container);
            if (result.ranges.length > 0) {
              ranges.push(...result.ranges);
              successCount++;
              rangeFound = true;
              console.log(`✅ [Semantic] Found ranges for ${riskLevel} risk clause: ${clause.type}`);
            }

            // MÉTHODE 2: Matching stable
            if (!rangeFound) {
              const stableRange = this.findStableRange(clause, container);
              if (stableRange) {
                ranges.push(stableRange);
                successCount++;
                rangeFound = true;
                console.log(`✅ [Stable] Stable match range for ${riskLevel} risk clause: ${clause.type}`);
              }
            }

            // MÉTHODE 3: Fuse.js (fallback)
            if (!rangeFound) {
              const fuseRange = this.findRangeWithFuse(clause, container);
              if (fuseRange) {
                ranges.push(fuseRange);
                successCount++;
                console.log(`✅ [Fuse.js] Fuzzy match for ${riskLevel} risk clause: ${clause.type}`);
              }
            }

          } catch (error) {
            console.error(`❌ Error highlighting clause ${clause.type}:`, error);
          }
        }

        // Appliquer le highlight pour ce niveau de risque
        if (ranges.length > 0) {
          const highlight = new (window as any).Highlight(...ranges);
          const highlightName = `clause-${riskLevel}-risk`;
          (CSS as any).highlights.set(highlightName, highlight);
          console.log(`✅ Applied ${ranges.length} ${riskLevel} risk highlights`);
        }
      }
    } else {
      // Fallback pour tous les clauses
      console.log(`⚠️ Using fallback for all clauses`);
      for (const clause of clauses) {
        this.uxFriendlyFallback(clause, container);
      }
    }

    return successCount;
  }









  // NOUVELLE MÉTHODE avec Fuse.js
  private findRangeWithFuse(clause: ClauseRisk, container: HTMLElement): Range | null {
    const text = container.textContent || '';
    if (!text) return null;

    const fuse = new Fuse([text], {
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: Math.min(20, clause.content.length - 1),
      threshold: 0.4, // Tolérance (0 = parfait, 1 = tout)
      ignoreLocation: true, // Cherche partout
    });

    const results = fuse.search(clause.content);

    if (results.length > 0 && results[0].matches && results[0].matches.length > 0) {
      const match = results[0].matches[0];
      const start = match.indices[0][0];
      const end = match.indices[0][1] + 1;

      console.log(`[Fuse.js] Match found for "${clause.type}" with score ${results[0].score}`);
      return this.createRangeByOffsets(container, start, end);
    }

    return null;
  }

  // Nouvelle méthode pour nettoyer tous les highlights
  clearAllHighlights(): void {
    if (this.isSupported && (CSS as any).highlights) {
      // Nettoyer tous les highlights par niveau de risque
      (CSS as any).highlights.delete('clause-high-risk');
      (CSS as any).highlights.delete('clause-medium-risk');
      (CSS as any).highlights.delete('clause-low-risk');
      (CSS as any).highlights.delete(this.highlightName);
      console.log('🧹 All modern highlights cleared');
    }

    // Nettoyer les fallbacks comme avant
    const highlighted = document.querySelectorAll('[data-highlighted="true"]');
    highlighted.forEach(el => {
      const htmlEl = el as HTMLElement;
      htmlEl.removeAttribute('data-highlighted');
      htmlEl.removeAttribute('data-confidence');
      htmlEl.removeAttribute('data-type');
      htmlEl.style.backgroundColor = '';
      htmlEl.style.border = '';
      htmlEl.style.borderRadius = '';
      htmlEl.style.padding = '';
      htmlEl.style.margin = '';
      htmlEl.style.position = '';

      // Supprimer les indicateurs
      const indicators = htmlEl.querySelectorAll('div[style*="position: absolute"]');
      indicators.forEach(indicator => indicator.remove());
    });
  }

  // Méthode helper pour trouver les ranges sans appliquer le highlight
  private findRangesForClause(clause: ClauseRisk, container: HTMLElement): { ranges: Range[] } {
    const ranges: Range[] = [];

    if (!this.isSupported) {
      return { ranges };
    }

    const strategies = this.createSearchStrategies(clause);

    for (const strategy of strategies) {
      const match = this.findLooseMatch(strategy.searchText, container);
      if (match.found) {
        const range = this.createRangeByOffsets(container, match.start, match.end);
        if (range) {
          ranges.push(range);
          break; // Une seule stratégie par clause
        }
      }
    }

    // Si rien trouvé, tenter une plage via matching stable
    if (ranges.length === 0) {
      const stableRange = this.findStableRange(clause, container);
      if (stableRange) {
        ranges.push(stableRange);
      }
    }

    return { ranges };
  }

  // Méthode helper pour créer un range sans l'appliquer
  private createRangeByOffsets(container: HTMLElement, start: number, end: number): Range | null {
    try {
      if (start < 0 || end <= start) return null;

      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
      let node: Node | null;
      let consumed = 0;
      let startNode: Node | null = null;
      let startOffset = 0;
      let endNode: Node | null = null;
      let endOffset = 0;

      while ((node = walker.nextNode())) {
        const t = node.textContent || '';
        const nodeStart = consumed;
        const nodeEnd = consumed + t.length;

        if (!startNode && nodeEnd > start) {
          startNode = node;
          startOffset = start - nodeStart;
        }

        if (nodeEnd >= end) {
          endNode = node;
          endOffset = end - nodeStart;
          break;
        }

        consumed = nodeEnd;
      }

      if (startNode && endNode) {
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        return range;
      }
    } catch (error) {
      console.error('Error creating range:', error);
    }

    return null;
  }

  private attemptModernHighlighting(clause: ClauseRisk, container: HTMLElement): HighlightResult {
    if (!this.isSupported) {
      return { success: false, method: 'CSS Custom Highlight', confidence: 0, message: 'API non supportée' };
    }

    const strategies = this.createSearchStrategies(clause);

    for (const strategy of strategies) {
      const match = this.findLooseMatch(strategy.searchText, container);
      if (match.found) {
        // surlignage exact : pas d'expansion artificielle
        const ok = this.createModernHighlightByOffsets(container, match.start, match.end);
        if (ok) {
          const len = match.end - match.start;
          return {
            success: true,
            method: strategy.name,
            confidence: strategy.confidence ?? 90,
            message: `Surligné ${len} caractères (offsets exacts)`
          };
        }
      }
    }

    return { success: false, method: 'CSS Custom Highlight', confidence: 0, message: 'Aucune correspondance trouvée' };
  }

  // Nouvelle stratégie: matching robuste par séquence de mots français
  private attemptStableWordSequenceHighlighting(clause: ClauseRisk, container: HTMLElement): HighlightResult {
    try {
      const result = findStableMatch(clause.content, container);
      if (!result || !result.found || !result.startPosition || !result.endPosition) {
        return { success: false, method: 'Stable word sequence', confidence: 0, message: 'Aucune séquence fiable trouvée' };
      }

      const range = this.createRangeFromWordPositions(result.startPosition.node as unknown as Text, result.startPosition.start, result.endPosition.node as unknown as Text, result.endPosition.end);
      if (!range) {
        return { success: false, method: 'Stable word sequence', confidence: 0, message: 'Impossible de créer la plage' };
      }

      const highlight = new (window as any).Highlight(range);
      (CSS as any).highlights.set(this.highlightName, highlight);

      // Scroll précis au centre dans le conteneur
      this.scrollRangeIntoCenter(container, range);

      return { success: true, method: 'Stable word sequence', confidence: 92, message: `Surligné via séquence stable` };
    } catch (e) {
      console.warn('Stable matching failed:', e);
      return { success: false, method: 'Stable word sequence', confidence: 0, message: 'Erreur matching stable' };
    }
  }

  // --- Stratégies (sans expandBy) ------------------------------------------------

  private createSearchStrategies(clause: ClauseRisk) {
    const strategies: Array<{ name: string; searchText: string; confidence?: number }> = [];

    // 1) Exact (tolérant espaces/ponctuation/casse)
    strategies.push({
      name: 'Exact (loose)',
      searchText: clause.content,
      confidence: 95
    });

    // 2) Fragments progressifs (tête / milieu / fin) pour mieux tolérer des divergences locales
    const fragmentSizes = [400, 300, 200, 120, 80];
    const len = clause.content.length;
    fragmentSizes.forEach((size, idx) => {
      if (len >= size) {
        // Tête
        strategies.push({
          name: `Head ${size}`,
          searchText: clause.content.substring(0, size),
          confidence: 85 - idx * 4
        });
        // Milieu (seulement tailles raisonnables pour perfs)
        if (size <= 200) {
          const midStart = Math.max(0, Math.floor(len / 2) - Math.floor(size / 2));
          const midFrag = clause.content.substring(midStart, midStart + size);
          strategies.push({
            name: `Mid ${size}`,
            searchText: midFrag,
            confidence: 80 - idx * 4
          });
        }
        // Fin (petites tailles)
        if (size <= 200) {
          const tailFrag = clause.content.substring(len - size);
          strategies.push({
            name: `Tail ${size}`,
            searchText: tailFrag,
            confidence: 78 - idx * 4
          });
        }
      }
    });

    // 3) Groupes de mots-clés (si présents)
    if (clause.keywords && clause.keywords.length) {
      const groups = this.createKeywordGroups(clause.keywords);
      groups.forEach((g, i) => strategies.push({
        name: `Keywords group ${i + 1}`,
        searchText: g,
        confidence: 75 - i * 5
      }));
    }

    return strategies;
  }

  // --- Recherche précise : normalisation "mirroir" avec table de correspondance ----

  /**
   * Normalise une chaîne en
   *   - minuscule
   *   - remplaçant toute séquence "non lettre/chiffre" par UN espace
   *   - en conservant les lettres accentuées
   * Retourne aussi, pour le texte d'origine, une table `map[iNorm] = iOrig` qui dit
   * d'où vient chaque caractère normalisé (utile pour remonter aux offsets exacts).
   */
  private normalizeWithMap(s: string): { norm: string; map: number[] } {
    const map: number[] = [];
    let norm = '';
    let lastWasSpace = false;

    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (this.isAlphaNum(ch)) {
        norm += ch.toLowerCase();
        map.push(i);
        lastWasSpace = false;
      } else {
        if (!lastWasSpace) {
          norm += ' ';
          map.push(i); // on attache l'espace à cette position d'origine
          lastWasSpace = true;
        }
      }
    }

    // trim de fin si besoin
    if (norm.endsWith(' ')) {
      norm = norm.trimEnd();
      // pas nécessaire d'ajuster map pour l'espace final supprimé dans nos usages
    }

    return { norm, map };
  }

  private normalizeOnly(s: string): string {
    return this.normalizeWithMap(s).norm;
  }

  private isAlphaNum(ch: string): boolean {
    // Lettres/chiffres unicode (inclut accents)
    return /[\p{L}\p{N}]/u.test(ch);
  }

  /**
   * Trouve la position d'un motif "normalisé" dans le conteneur, puis
   * rejoue la correspondance pour récupérer les offsets d'origine EXACTS.
   */
  private findLooseMatch(searchText: string, container: HTMLElement): MatchPos {
    const original = container.textContent || '';
    if (!original) return { found: false };

    const { norm: normContainer, map } = this.normalizeWithMap(original);
    const normSearch = this.normalizeOnly(searchText);

    if (!normSearch) return { found: false };

    const k = normContainer.indexOf(normSearch);
    if (k === -1) return { found: false };

    // Offsets originaux : start via map[k], end via rejouage depuis start
    const startApprox = map[Math.max(0, k)];
    const end = this.replayEndOffset(original, startApprox, normSearch);
    if (end <= startApprox) return { found: false };

    return { found: true, start: startApprox, end };
  }




  /**
   * À partir d'un index `start` dans le texte original, on "rejoue" la normalisation
   * jusqu'à avoir produit `normTarget`, pour obtenir l'offset de fin original exact.
   */
  private replayEndOffset(original: string, start: number, normTarget: string): number {
    let i = start;
    let built = '';
    let lastWasSpace = false;

    while (i < original.length && built.length < normTarget.length) {
      const ch = original[i];
      if (this.isAlphaNum(ch)) {
        built += ch.toLowerCase();
        lastWasSpace = false;
      } else {
        if (!lastWasSpace) {
          built += ' ';
          lastWasSpace = true;
        }
      }
      i++;
    }


    //Recherche le dernier caractère, si c'est de la ponctuation à conserver dans le phrase on l'ajoute à l'index de fin
    //arrayLastCaracAccept est extensible
    const arrayLastCaracAccept = [".", ")"];
    const maxLoop = 3
    let maxLoopCount = 0;

    if (arrayLastCaracAccept.includes(original[i])) {
      while (arrayLastCaracAccept.includes(original[i]) && maxLoopCount < maxLoop) {
        console.log(
          `%c[HIGHLIGHT - replayEndOffset]`,
          "color:black; background:#20E5E6; font-weight:bold; padding:3px 6px; border-radius:4px;",
          `- The last character to be keep on highlight : "${original[i]}"`
        )
        i++
        maxLoopCount++
        if (maxLoop === maxLoopCount) {
          console.warn(
            "%c[HIGHTLIGHT - replayEndOffset WARNING]",
            "color:black; background:#EA4327; font-weight:blod, padding:5px",
            `Stopped after ${maxLoop} iterations to prevent infinite loop`
          )
        }
      }
    }

    return i; // index exclusif
  }





  // --- Création des ranges par offsets globaux ------------------------------------
  private createModernHighlightByOffsets(container: HTMLElement, start: number, end: number): boolean {
    try {
      if (start < 0 || end <= start) return false;

      const ranges: Range[] = [];
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);

      let node: Node | null;
      let consumed = 0; // nombre de caractères cumulés parcourus
      while ((node = walker.nextNode())) {
        const t = node.textContent || '';
        const nodeStart = consumed;
        const nodeEnd = consumed + t.length;

        if (nodeEnd <= start) {
          // pas encore au début
          consumed = nodeEnd;
          continue;
        }
        if (nodeStart >= end) {
          // déjà passé la fin
          break;
        }

        // On est sur un nœud chevauchant [start, end)
        const range = new Range();
        const startOffset = Math.max(0, start - nodeStart);
        const endOffset = Math.min(t.length, end - nodeStart);

        range.setStart(node, startOffset);
        range.setEnd(node, endOffset);
        ranges.push(range);

        consumed = nodeEnd;
        // started
      }

      if (!ranges.length) {
        console.error('❌ Aucune plage trouvée pour le surlignement (mapping offsets)');
        return false;
      }

      // Appliquer le highlight
      const highlight = new (window as any).Highlight(...ranges);
      (CSS as any).highlights.set(this.highlightName, highlight);

      // Scroll précis au centre dans le conteneur
      const first = ranges[0];
      this.scrollRangeIntoCenter(container, first);

      console.log(`✅ Highlight créé (${ranges.length} plage(s), ${end - start} car.)`);
      return true;
    } catch (e) {
      console.error('❌ Erreur createModernHighlightByOffsets:', e);
      return false;
    }
  }

  // Crée un Range à partir de positions de mots (Text node + offsets)
  private createRangeFromWordPositions(startNode: Text, startOffset: number, endNode: Text, endOffset: number): Range | null {
    try {
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      return range;
    } catch (e) {
      console.error('Error createRangeFromWordPositions:', e);
      return null;
    }
  }

  // Helper pour trouver une plage via matching stable (sans appliquer)
  private findStableRange(clause: ClauseRisk, container: HTMLElement): Range | null {
    try {
      const res = findStableMatch(clause.content, container);
      if (!res || !res.found || !res.startPosition || !res.endPosition) return null;
      return this.createRangeFromWordPositions(
        res.startPosition.node as unknown as Text,
        res.startPosition.start,
        res.endPosition.node as unknown as Text,
        res.endPosition.end
      );
    } catch (e) {
      return null;
    }
  }

  // --- Fallbacks (inchangés, à part micro-hygiène) --------------------------------

  private uxFriendlyFallback(clause: ClauseRisk, container: HTMLElement): boolean {
    console.log('🔄 Using UX-friendly fallback highlighting');

    const strategies = this.createSearchStrategies(clause);
    for (const strategy of strategies) {
      const ok = this.executeFallbackStrategy(strategy, container);
      if (ok.success) return true;
    }

    return this.createProbableZone(clause, container);
  }

  private executeFallbackStrategy(strategy: any, container: HTMLElement): { success: boolean } {
    const elements = container.querySelectorAll('div, p, h1, h2, h3, span, li, td, th, article, section');

    for (const element of elements) {
      const elementText = element.textContent || '';
      const normalizedElementText = this.smartNormalize(elementText);
      const normalizedSearchText = this.smartNormalize(strategy.searchText);

      if (normalizedElementText.includes(normalizedSearchText)) {
        const htmlElement = element as HTMLElement;

        const confidence = strategy.confidence ?? 70;
        const confidenceColor = confidence > 80 ? '#ffeb3b' : confidence > 60 ? '#fff3cd' : '#ffeaa7';
        const borderColor = confidence > 80 ? '#ff9800' : confidence > 60 ? '#ffc107' : '#f39c12';

        htmlElement.style.backgroundColor = confidenceColor;
        htmlElement.style.border = `2px solid ${borderColor}`;
        htmlElement.style.borderRadius = '6px';
        htmlElement.style.padding = '12px';
        htmlElement.style.margin = '8px 0';
        htmlElement.style.position = 'relative';
        htmlElement.setAttribute('data-highlighted', 'true');
        htmlElement.setAttribute('data-confidence', String(confidence));

        const confidenceIndicator = document.createElement('div');
        confidenceIndicator.style.cssText = `
          position: absolute;
          top: -8px;
          right: -8px;
          background: ${borderColor};
          color: white;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: bold;
        `;
        confidenceIndicator.textContent = `${confidence}%`;
        htmlElement.appendChild(confidenceIndicator);

        this.scrollElementIntoCenter(container, htmlElement);
        console.log(`✅ Fallback highlighting applied: ${strategy.name} (${confidence}%)`);
        return { success: true };
      }
    }

    return { success: false };
  }

  private createProbableZone(clause: ClauseRisk, container: HTMLElement): boolean {
    const probableKeywords = this.extractProbableKeywords(clause);
    if (!probableKeywords.length) return false;

    const elements = container.querySelectorAll('div, p, h1, h2, h3, span, li, td, th, article, section');

    for (const element of elements) {
      const elementText = element.textContent || '';
      const normalizedElementText = this.smartNormalize(elementText);

      const matchingKeywords = probableKeywords.filter(keyword =>
        normalizedElementText.includes(this.smartNormalize(keyword))
      );

      if (matchingKeywords.length >= Math.ceil(probableKeywords.length / 2)) {
        const htmlElement = element as HTMLElement;

        htmlElement.style.backgroundColor = '#fff8e1';
        htmlElement.style.border = '2px dashed #ffb74d';
        htmlElement.style.borderRadius = '6px';
        htmlElement.style.padding = '12px';
        htmlElement.style.margin = '8px 0';
        htmlElement.style.position = 'relative';
        htmlElement.setAttribute('data-highlighted', 'true');
        htmlElement.setAttribute('data-type', 'probable-zone');

        const probableIndicator = document.createElement('div');
        probableIndicator.style.cssText = `
          position: absolute;
          top: -8px;
          right: -8px;
          background: #ffb74d;
          color: white;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: bold;
        `;
        probableIndicator.textContent = 'Zone probable';
        htmlElement.appendChild(probableIndicator);

        this.scrollElementIntoCenter(container, htmlElement);
        console.log('✅ Probable zone created');
        return true;
      }
    }

    return false;
  }

  // --- Utils existants (stabilisés) ------------------------------------------------

  private smartNormalize(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[☐☑✓✔]/g, ' ')
      .replace(/[…]/g, ' ')
      .replace(/\.{2,}/g, ' ')
      .replace(/[^\w\sàâäåãéèêëẽïîìĩôöòõùûüũç]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private createKeywordGroups(keywords: string[]): string[] {
    const groups: string[] = [];
    if (keywords.length >= 3) groups.push(keywords.slice(0, 3).join(' '));
    if (keywords.length >= 2) groups.push(keywords.slice(0, 2).join(' '));
    return groups;
  }

  private extractProbableKeywords(clause: ClauseRisk): string[] {
    const keywords: string[] = [];
    if (clause.keywords) keywords.push(...clause.keywords);
    keywords.push(...this.getTypeKeywords(clause.type));
    keywords.push(...this.getCategoryKeywords(clause.category));
    return [...new Set(keywords)];
  }

  private getTypeKeywords(type: string): string[] {
    const typeMap: Record<string, string[]> = {
      penalty: ['pénalité', 'amende', 'sanction', 'penalty'],
      termination: ['résiliation', 'terminaison', 'fin', 'termination'],
      responsibility: ['responsabilité', 'responsibility', 'obligation'],
      confidentiality: ['confidentialité', 'secret', 'confidentiality'],
      nonCompete: ['concurrence', 'non-compete', 'exclusivité'],
      warranty: ['garantie', 'warranty', 'assurance'],
      other: ['clause', 'disposition', 'article']
    };
    return typeMap[type] || [];
  }

  private getCategoryKeywords(category: string): string[] {
    const categoryMap: Record<string, string[]> = {
      penalty: ['pénalité', 'amende', 'sanction'],
      termination: ['résiliation', 'terminaison', 'fin'],
      responsibility: ['responsabilité', 'obligation', 'devoir'],
      confidentiality: ['confidentialité', 'secret', 'privé'],
      nonCompete: ['concurrence', 'exclusivité', 'restriction'],
      warranty: ['garantie', 'assurance', 'engagement'],
      other: ['clause', 'disposition', 'article']
    };
    return categoryMap[category] || [];
  }

  clearHighlights(): void {
    // Utiliser la nouvelle méthode qui nettoie tous les highlights
    this.clearAllHighlights();
  }

  // --- Style ::highlight -----------------------------------------------------------

  private ensureHighlightStyle(): void {
    if (!this.isSupported) return;
    if (document.getElementById(this.styleId)) return;

    const style = document.createElement('style');
    style.id = this.styleId;
    style.textContent = `
      ::highlight(${this.highlightName}) {
        background-color: rgba(255, 235, 59, 0.8); /* jaune "surbrillance" */
        border-radius: 2px;
      }
      ::highlight(clause-high-risk) {
        background-color: rgba(255, 99, 71, 0.3); /* rouge clair */
        border-radius: 2px;
      }
      ::highlight(clause-medium-risk) {
        background-color: rgba(255, 165, 0, 0.3); /* orange clair */
        border-radius: 2px;
      }
      ::highlight(clause-low-risk) {
        background-color: rgba(144, 238, 144, 0.3); /* vert clair */
        border-radius: 2px;
      }
    `;
    document.head.appendChild(style);
  }
}





export const modernHighlighter = new ModernHighlighter();

// --- Helpers d'instance ---
ModernHighlighter.prototype.scrollRangeIntoCenter = function (container: HTMLElement, range: Range) {
  try {
    const canScroll = container.scrollHeight > container.clientHeight + 2;
    const rect = range.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    if (!canScroll || rect.height === 0) {
      const el = (range.startContainer as any).parentElement as HTMLElement | undefined;
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const current = container.scrollTop;
    const rangeCenter = rect.top + rect.height / 2;
    const containerCenter = cRect.top + container.clientHeight / 2;
    const delta = rangeCenter - containerCenter;
    let nextTop = current + delta;
    const maxTop = container.scrollHeight - container.clientHeight;
    nextTop = Math.max(0, Math.min(maxTop, nextTop));
    container.scrollTo({ top: nextTop, behavior: 'smooth' });
  } catch (e) {
    const el = (range.startContainer as any).parentElement as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};



ModernHighlighter.prototype.scrollElementIntoCenter = function (container: HTMLElement, element: HTMLElement) {
  try {
    const canScroll = container.scrollHeight > container.clientHeight + 2;
    const rect = element.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    if (!canScroll || rect.height === 0) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const current = container.scrollTop;
    const elCenter = rect.top + rect.height / 2;
    const containerCenter = cRect.top + container.clientHeight / 2;
    const delta = elCenter - containerCenter;
    let nextTop = current + delta;
    const maxTop = container.scrollHeight - container.clientHeight;
    nextTop = Math.max(0, Math.min(maxTop, nextTop));
    container.scrollTo({ top: nextTop, behavior: 'smooth' });
  } catch (e) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
} as any;
