import FEATURE_FLAGS from "../config/features";

export interface TrigramHit {
  pos: number;
}
export interface TrigramIndex {
  map: Map<string, number[]>;
  text: string;
  createdAt: number;
}

export function buildTrigramIndex(text: string): TrigramIndex | null {
  if (!FEATURE_FLAGS.ENABLE_TRIGRAM_INDEX) return null;
  const map = new Map<string, number[]>();
  for (let i = 0; i < text.length - 2; i++) {
    const tri = text.slice(i, i + 3);
    let arr = map.get(tri);
    if (!arr) {
      arr = [];
      map.set(tri, arr);
    }
    arr.push(i);
  }
  return { map, text, createdAt: Date.now() };
}

export function approximateLocate(
  index: TrigramIndex | null,
  snippet: string,
  maxCandidates = 30,
): number | null {
  if (!index || snippet.length < 12) return null;
  // Collect trigram positions
  const scores = new Map<number, number>();
  let trigrams = 0;
  for (let i = 0; i < snippet.length - 2; i++) {
    const tri = snippet.slice(i, i + 3);
    trigrams++;
    const positions = index.map.get(tri);
    if (!positions) continue;
    for (const p of positions) {
      // candidate anchor at p - i
      const anchor = p - i;
      if (anchor < 0) continue;
      scores.set(anchor, (scores.get(anchor) || 0) + 1);
    }
  }
  if (!scores.size) return null;
  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCandidates);
  const target = snippet;
  let best: { anchor: number; distance: number } | null = null;
  for (const [anchor] of ranked) {
    if (anchor + target.length > index.text.length) continue;
    const window = index.text.slice(anchor, anchor + target.length);
    const distance = roughDistance(window, target);
    if (!best || distance < best.distance) {
      best = { anchor, distance };
      if (distance === 0) break;
    }
  }
  if (best && best.distance <= Math.max(2, Math.floor(target.length * 0.05))) {
    return best.anchor;
  }
  return null;
}

function roughDistance(a: string, b: string): number {
  // Borne supérieure simple (early exit) - Hamming-like with length diff penalty
  const lenDiff = Math.abs(a.length - b.length);
  const len = Math.min(a.length, b.length);
  let diff = lenDiff;
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) diff++;
  return diff;
}
