/* eslint-disable no-console */
import { callOpenAI } from "./openaiClient.js";

const IS_PROD = process.env.NODE_ENV === "production";
const LEGIFRANCE_PROXY_URL = IS_PROD
  ? process.env.LEGIFRANCE_PROXY_URL || "http://localhost:4000"
  : "http://localhost:4000";

export interface JurisprudenceCase {
  id: string;
  title: string;
  citation: string;
  court: string;
  year: number;
  relevanceScore: number;
  summary: string;
  url: string;
  keyPrinciples?: string[];
  date?: string;
}

const summarizeCache = new Map<string, string>();

function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function withTimeout<T>(
  p: Promise<T>,
  ms = 4000,
  onTimeout?: () => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      onTimeout?.();
      reject(new Error("timeout"));
    }, ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

function extractJuriIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (
      !/legifrance\.gouv\.fr$/i.test(u.hostname) &&
      !/\.legifrance\.gouv\.fr$/i.test(u.hostname)
    )
      return null;
    const m = u.pathname.match(/\/id\/(JURITEXT\w+)/i);
    return m ? m[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

async function consultLegifranceJuriText(juriId: string): Promise<unknown> {
  try {
    const res = await withTimeout(
      fetch(`${LEGIFRANCE_PROXY_URL}/api/legi-consult-juri`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textId: juriId }),
      }),
      12000,
    );
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

export async function fetchDecisionTextIfPossible(
  url: string,
): Promise<string> {
  const id = extractJuriIdFromUrl(url);
  if (!id) return "";
  const data = await consultLegifranceJuriText(id);
  if (!data) return "";

  const candidates = [
    (data as any).texteHtml,
    (data as any).texte,
    (data as any).resultat,
    (data as any).contenu,
    (data as any).body,
    data,
  ].filter(Boolean);

  for (const c of candidates) {
    if (typeof c === "string" && c.length > 100)
      return stripHtml(c).slice(0, 5000);
    if (typeof c === "object") {
      const html = ((c as any).texteHtml ||
        (c as any).html ||
        (c as any).content ||
        "") as string;
      if (typeof html === "string" && html.length > 100)
        return stripHtml(html).slice(0, 5000);
      const plain = ((c as any).texte ||
        (c as any).text ||
        (c as any).resume ||
        "") as string;
      if (typeof plain === "string" && plain.length > 100)
        return stripHtml(plain).slice(0, 5000);
    }
  }
  return "";
}

export async function summarizeCaseInline(
  item: JurisprudenceCase,
): Promise<string> {
  const cacheKey = item.url || item.id;
  const cached = summarizeCache.get(cacheKey);
  if (cached) return cached;

  let context = "";
  try {
    context = await withTimeout(
      fetchDecisionTextIfPossible(item.url),
      3500,
      () => {
        console.log(
          "summarizeCaseInline: texte décision timeout, fallback au titre.",
        );
      },
    );
  } catch {
    // ignore
  }

  const trimmed = (context || "").replace(/\s+/g, " ").slice(0, 5000);
  const ctxForPrompt = trimmed.slice(0, 1800);

  const prompt = `Tu es un juriste français. Résume en 2 phrases claires et neutres la décision ci-dessous (si le texte est vide, résume uniquement d'après le titre):
Titre: ${item.title}
Contexte: ${ctxForPrompt || "N/A"}
Réponds en 2 phrases max, sans mise en forme, en français.`;

  try {
    const out = await callOpenAI([{ role: "user", content: prompt }], {
      model: "gpt-4o",
      temperature: 0.2,
      max_tokens: 120,
    });
    summarizeCache.set(cacheKey, out);
    return out;
  } catch (e) {
    console.log("summarizeCaseInline error:", e);
    return "";
  }
}
