import { JurisprudenceCase, Recommendation } from '../../../types';

export const altCache: Record<string, Recommendation[]> = {};
export const altCacheTime: Record<string, number> = {};
export const jurisprudenceCache: Record<string, JurisprudenceCase[]> = {};

export function clearEnhancedClauseCaches() {
  Object.keys(altCache).forEach((key) => delete altCache[key]);
  Object.keys(altCacheTime).forEach((key) => delete altCacheTime[key]);
  Object.keys(jurisprudenceCache).forEach((key) => delete jurisprudenceCache[key]);
}
