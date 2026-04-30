import { JurisprudenceCase } from '../types';
import { consultLegifranceJuriText, extractJuriIdFromUrl } from './legifranceProxy';
import { callOpenAI } from './aiClient';

// Cache simple (mémoire) pour éviter des appels répétés
const summarizeCache = new Map<string, string>();

function stripHtml(html: string): string {
  if (!html) return '';
  try {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
  } catch {
    return html.replace(/<[^>]+>/g, ' ');
  }
}

// Timeout helper pour éviter d’attendre trop longtemps les textes de décision
function withTimeout<T>(p: Promise<T>, ms = 4000, onTimeout?: () => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      onTimeout?.();
      reject(new Error('timeout'));
    }, ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

export async function fetchDecisionTextIfPossible(url: string): Promise<string> {
  const id = extractJuriIdFromUrl(url);
  if (!id) return '';
  const data = await consultLegifranceJuriText(id);
  if (!data) return '';
  // Try to pick some likely text containers
  const candidates: any[] = [
    data.texteHtml, data.texte, data.resultat, data.contenu, data.body, data
  ].filter(Boolean);
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 100) return stripHtml(c).slice(0, 5000);
    if (typeof c === 'object') {
      const html = (c.texteHtml || c.html || c.content || '') as string;
      if (typeof html === 'string' && html.length > 100) return stripHtml(html).slice(0, 5000);
      const plain = (c.texte || c.text || c.resume || '') as string;
      if (typeof plain === 'string' && plain.length > 100) return stripHtml(plain).slice(0, 5000);
    }
  }
  return '';
}

export async function summarizeCaseInline(item: JurisprudenceCase): Promise<string> {
  // Cache par URL (id unique stable)
  const cacheKey = item.url || item.id;
  const cached = summarizeCache.get(cacheKey);
  if (cached) return cached;

  // OpenAI handled via backend

  const maxPromptText = 1800;
  let context = '';
  try {
    // limite le coût réseau sur Légifrance
    context = await withTimeout(fetchDecisionTextIfPossible(item.url), 3500, () => {
      console.log('summarizeCaseInline: texte décision timeout, fallback au titre.');
    });
  } catch {
    // ignore
  }

  const trimmed = (context || '').replace(/\s+/g, ' ').slice(0, 5000);
  const ctxForPrompt = trimmed.slice(0, maxPromptText);

  const prompt = `Tu es un juriste français. Résume en 2 phrases claires et neutres la décision ci-dessous (si le texte est vide, résume uniquement d'après le titre):
Titre: ${item.title}
Contexte: ${ctxForPrompt || 'N/A'}
Réponds en 2 phrases max, sans mise en forme, en français.`;

  try {
    const out = await callOpenAI(
      [{ role: 'user', content: prompt }],
      { model: 'gpt-4o', temperature: 0.2, max_tokens: 120 }
    );
    summarizeCache.set(cacheKey, out);
    return out;
  } catch (e) {
    console.log('summarizeCaseInline error:', e);
    return '';
  }
}
