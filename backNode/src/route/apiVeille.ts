import type { Request, Response, Router } from "express";
import express from "express";
import Parser from "rss-parser";
import iconv from "iconv-lite";

const routerVeille: Router = express.Router();
const parser = new Parser({ timeout: 10000 });

const PROXY_URL = process.env.PROXY_URL || "http://localhost:3000";

// ── Catégories RH ────────────────────────────────────────────────────────────
export type VeilleTag =
  | "Rupture"
  | "Temps de travail"
  | "Rémunération"
  | "Santé/Sécurité"
  | "Discipline"
  | "Relations collectives"
  | "Protection sociale"
  | "Recrutement";

const ALL_TAGS: VeilleTag[] = [
  "Rupture",
  "Temps de travail",
  "Rémunération",
  "Santé/Sécurité",
  "Discipline",
  "Relations collectives",
  "Protection sociale",
  "Recrutement",
];

const IMPACT_BY_TAG: Record<VeilleTag, string> = {
  Rupture: "Vérifiez vos procédures de rupture de contrat",
  "Temps de travail":
    "Contrôlez la conformité de vos accords de temps de travail",
  Rémunération: "Vérifiez vos éléments de rémunération et bulletins de paie",
  "Santé/Sécurité": "Mettez à jour votre DUERP et procédures de prévention",
  Discipline: "Revoyez vos procédures disciplinaires internes",
  "Relations collectives":
    "Suivez l'évolution des négociations et accords collectifs",
  "Protection sociale": "Vérifiez la conformité de vos obligations sociales",
  Recrutement: "Adaptez vos pratiques de recrutement aux nouvelles règles",
};

// ── Feeds ────────────────────────────────────────────────────────────────────
interface FeedConfig {
  url: string;
  label: string;
  filterKeywords?: string[]; // uniquement pour Sénat, AN, Juricaf
}

const RSS_FEEDS: FeedConfig[] = [
  // ── Légifrance – textes législatifs ─────────────────────────────────────────
  {
    url: "https://legifrss.org/latest?nature=loi&q=salari%C3%A9",
    label: "Légifrance",
  },
  {
    url: "https://legifrss.org/latest?nature=loi&q=emploi",
    label: "Légifrance",
  },
  {
    url: "https://legifrss.org/latest?nature=loi&q=licenciement",
    label: "Légifrance",
  },
  {
    url: "https://legifrss.org/latest?nature=decret&q=travail",
    label: "Légifrance",
  },
  {
    url: "https://legifrss.org/latest?nature=decret&q=salaire",
    label: "Légifrance",
  },
  // ── Légifrance – jurisprudence sociale ──────────────────────────────────────
  {
    url: "https://legifrss.org/latest?nature=jurisprudence&q=salaire",
    label: "Légifrance – Jurisprudence",
  },
  {
    url: "https://legifrss.org/latest?nature=jurisprudence&q=emploi",
    label: "Légifrance – Jurisprudence",
  },
  {
    url: "https://legifrss.org/latest?nature=jurisprudence&q=salari%C3%A9",
    label: "Légifrance – Jurisprudence",
  },
  {
    url: "https://legifrss.org/latest?nature=jurisprudence&q=travail",
    label: "Légifrance – Jurisprudence",
  },
  {
    url: "https://legifrss.org/latest?nature=jurisprudence&q=licenciement",
    label: "Légifrance – Jurisprudence",
  },
  // ── Parlement ────────────────────────────────────────────────────────────────
  {
    url: "https://www.senat.fr/rss/textes.rss",
    label: "Sénat",
    filterKeywords: [
      "travail",
      "emploi",
      "licenciement",
      "salarié",
      "retraite",
      "social",
      "prud",
      "convention collective",
    ],
  },
  {
    url: "http://www2.assemblee-nationale.fr/feeds/detail/documents-parlementaires",
    label: "Assemblée nationale",
    filterKeywords: [
      "travail",
      "emploi",
      "licenciement",
      "salarié",
      "retraite",
      "social",
      "prud",
      "convention collective",
    ],
  },
  // ── Ministère du Travail ─────────────────────────────────────────────────────
  {
    url: "https://travail-emploi.gouv.fr/spip.php?page=backend",
    label: "Ministère du Travail",
  },
  // ── Service-public.fr ────────────────────────────────────────────────────────
  {
    url: "https://www.service-public.fr/rss/particuliers/travail.rss",
    label: "Service-public.fr",
  },
  // ── Juricaf ──────────────────────────────────────────────────────────────────
  {
    url: "https://juricaf.org/recherche/+/facet_pays:France?format=rss",
    label: "Juricaf",
    filterKeywords: [
      "travail",
      "emploi",
      "licenciement",
      "salarié",
      "disciplin",
      "rupture",
      "prud",
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(raw: string | undefined): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Collecte brute d'un flux ─────────────────────────────────────────────────
interface RawArticle {
  title: string;
  description: string;
  date: string;
  source: string;
  link?: string;
}

const ISO_FEEDS = new Set(["https://www.senat.fr/rss/textes.rss"]);

async function parseFeed(url: string) {
  if (!ISO_FEEDS.has(url)) return parser.parseURL(url);
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const xml = iconv.decode(buf, "iso-8859-15");
  return parser.parseString(xml);
}

async function fetchFeedRaw(config: FeedConfig): Promise<RawArticle[]> {
  const { url, label, filterKeywords } = config;
  const feed = await parseFeed(url);
  const items: RawArticle[] = [];

  for (const item of feed.items ?? []) {
    const title = item.title ?? "";
    const description = stripHtml(
      item.contentSnippet ?? item.content ?? item.summary ?? "",
    );
    const combined = `${title} ${description}`.toLowerCase();

    if (filterKeywords) {
      if (!filterKeywords.some((kw) => combined.includes(kw))) continue;
    }

    items.push({
      title: title.trim(),
      description: description.slice(0, 400),
      date: formatDate(item.pubDate ?? item.isoDate),
      source: `${label}${feed.title && feed.title !== label ? ` — ${feed.title}` : ""}`,
      link: item.link ?? undefined,
    });
  }

  return items;
}

// ── Classification via backend Python ────────────────────────────────────────
async function classifyBatch(
  articles: RawArticle[],
): Promise<(VeilleTag | null)[]> {
  if (articles.length === 0) return [];

  const payload = articles.map((a) => ({
    title: a.title,
    description: a.description,
  }));
  const r = await fetch(`${PROXY_URL}/classify-veille`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ articles: payload }),
  });
  if (!r.ok) throw new Error(`classify-veille ${r.status}`);
  const raw: (string | null)[] = await r.json();
  const results: (VeilleTag | null)[] = raw.map((v) =>
    v && (ALL_TAGS as string[]).includes(v) ? (v as VeilleTag) : null,
  );

  return results;
}

// ── Pipeline principal ────────────────────────────────────────────────────────
export interface VeilleArticle {
  tag: VeilleTag;
  date: string;
  title: string;
  summary: string;
  impact: string;
  source: string;
  link?: string;
}

const BATCH_SIZE = 30;

async function fetchAndClassifyAll(): Promise<VeilleArticle[]> {
  // 1. Fetch tous les flux en parallèle
  const feedResults = await Promise.allSettled(RSS_FEEDS.map(fetchFeedRaw));

  const rawArticles: RawArticle[] = [];
  const seen = new Set<string>();

  for (const result of feedResults) {
    if (result.status !== "fulfilled") continue;
    for (const article of result.value) {
      const key = article.title.toLowerCase().slice(0, 80);
      if (!seen.has(key)) {
        seen.add(key);
        rawArticles.push(article);
      }
    }
  }

  // 2. Classifier par batches de BATCH_SIZE
  const classified: VeilleArticle[] = [];

  for (let i = 0; i < rawArticles.length; i += BATCH_SIZE) {
    const batch = rawArticles.slice(i, i + BATCH_SIZE);
    let tags: (VeilleTag | null)[];
    try {
      tags = await classifyBatch(batch);
    } catch (err) {
      console.error("[veille] classify batch error:", err);
      tags = Array(batch.length).fill(null);
    }

    for (let j = 0; j < batch.length; j++) {
      const tag = tags[j];
      if (!tag) continue;
      const a = batch[j];
      classified.push({
        tag,
        date: a.date,
        title: a.title,
        summary:
          a.description || "Consultez le texte complet pour plus de détails.",
        impact: IMPACT_BY_TAG[tag],
        source: a.source,
        link: a.link,
      });
    }
  }

  classified.sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return isNaN(da) || isNaN(db) ? 0 : db - da;
  });

  return classified.slice(0, 120);
}

// ── Cache ────────────────────────────────────────────────────────────────────
let cache: { articles: VeilleArticle[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

// ── Routes ────────────────────────────────────────────────────────────────────
routerVeille.get("/", async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    const nocache = req.query.nocache === "1";

    if (!nocache && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
      return res.json({ success: true, data: cache.articles, cached: true });
    }

    const articles = await fetchAndClassifyAll();
    if (!nocache) cache = { articles, fetchedAt: now };

    return res.json({ success: true, data: articles, cached: false });
  } catch (err) {
    console.error("[veille] fetch error:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des flux RSS.",
    });
  }
});

routerVeille.get("/debug", async (_req: Request, res: Response) => {
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (config) => {
      try {
        const items = await fetchFeedRaw(config);
        return {
          url: config.url,
          label: config.label,
          status: "ok" as const,
          itemCount: items.length,
          items,
        };
      } catch (err) {
        return {
          url: config.url,
          label: config.label,
          status: "error" as const,
          error: (err as Error).message,
          itemCount: 0,
          items: [],
        };
      }
    }),
  );

  return res.json({
    success: true,
    feeds: results.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : { status: "error", error: String(r.reason) },
    ),
  });
});

export default routerVeille;
