import type { Request, Response, Router } from "express";
import express from "express";
import Parser from "rss-parser";

const routerVeille: Router = express.Router();
const parser = new Parser({ timeout: 8000 });

type Tag = "Rupture" | "Discipline" | "Temps de travail" | "Rémunération" | "Santé/Sécurité";

interface VeilleArticle {
  tag: Tag;
  date: string;
  title: string;
  summary: string;
  impact: string;
  source: string;
  link?: string;
}

// Flux RSS à agréger — certains filtrés côté URL, d'autres par mots-clés
const RSS_FEEDS: { url: string; label: string; filterKeywords?: string[] }[] = [
  {
    url: "https://legifrss.org/latest?nature=loi&q=salarié",
    label: "Légifrance",
  },
  {
    url: "https://legifrss.org/latest?nature=loi&q=emploi",
    label: "Légifrance",
  },
  {
    url: "https://legifrss.org/latest?nature=decret&q=travail",
    label: "Légifrance",
  },
  {
    url: "https://www.senat.fr/rss/textes.rss",
    label: "Sénat",
    filterKeywords: ["travail", "emploi", "licenciement", "salarié", "retraite", "social"],
  },
  {
    url: "http://www2.assemblee-nationale.fr/feeds/detail/documents-parlementaires",
    label: "Assemblée nationale",
    filterKeywords: ["travail", "emploi", "licenciement", "salarié", "retraite", "social"],
  },
  {
    url: "https://juricaf.org/recherche/+/facet_pays:France?format=rss",
    label: "Juricaf",
    filterKeywords: ["travail", "emploi", "licenciement", "salarié", "disciplin", "rupture"],
  },
];

const IMPACT_BY_TAG: Record<Tag, string> = {
  "Rupture": "Vérifiez vos procédures de rupture de contrat",
  "Discipline": "Revoyez vos procédures disciplinaires internes",
  "Temps de travail": "Contrôlez la conformité de vos accords de temps de travail",
  "Rémunération": "Vérifiez vos éléments de rémunération et bulletins de paie",
  "Santé/Sécurité": "Mettez à jour votre DUERP et procédures de prévention",
};

function classifyTag(text: string): Tag | null {
  const t = text.toLowerCase();
  if (/licenci|rupture conventionnel|démission|prud.homm|départ négocié/.test(t)) return "Rupture";
  if (/disciplin|sanction|faute|avertissement/.test(t)) return "Discipline";
  if (/temps de travail|durée du travail|heures supplément|forfait.jours?|congé|rtt|télétravail|déconnexion/.test(t)) return "Temps de travail";
  if (/salaire|rémunération|smic|prime|paie|indemnité/.test(t)) return "Rémunération";
  if (/santé|sécurité au travail|accident du travail|maladie professionnelle|inaptitude|duerp|médecin du travail/.test(t)) return "Santé/Sécurité";
  return null;
}

function formatDate(raw: string | undefined): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Cache simple en mémoire — 30 minutes
let cache: { articles: VeilleArticle[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

async function fetchAllFeeds(): Promise<VeilleArticle[]> {
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async ({ url, label, filterKeywords }) => {
      const feed = await parser.parseURL(url);
      const items: VeilleArticle[] = [];

      for (const item of feed.items ?? []) {
        const title = item.title ?? "";
        const description = stripHtml(item.contentSnippet ?? item.content ?? item.summary ?? "");
        const combined = `${title} ${description}`.toLowerCase();

        // Filtrage par mots-clés si le flux n'est pas pré-filtré
        if (filterKeywords) {
          const matches = filterKeywords.some((kw) => combined.includes(kw));
          if (!matches) continue;
        }

        const tag = classifyTag(combined);
        if (!tag) continue;

        items.push({
          tag,
          date: formatDate(item.pubDate ?? item.isoDate),
          title: title.trim(),
          summary: description.slice(0, 300) || "Consultez le texte complet pour plus de détails.",
          impact: IMPACT_BY_TAG[tag],
          source: `${label}${feed.title && feed.title !== label ? ` — ${feed.title}` : ""}`,
          link: item.link ?? undefined,
        });
      }

      return items;
    }),
  );

  const articles: VeilleArticle[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const article of result.value) {
        const key = article.title.toLowerCase().slice(0, 80);
        if (!seen.has(key)) {
          seen.add(key);
          articles.push(article);
        }
      }
    }
  }

  // Tri anti-chronologique (les plus récents d'abord)
  articles.sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return isNaN(da) || isNaN(db) ? 0 : db - da;
  });

  return articles.slice(0, 60);
}

routerVeille.get("/", async (_req: Request, res: Response) => {
  try {
    const now = Date.now();
    if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
      return res.json({ success: true, data: cache.articles, cached: true });
    }

    const articles = await fetchAllFeeds();
    cache = { articles, fetchedAt: now };

    return res.json({ success: true, data: articles, cached: false });
  } catch (err) {
    console.error("[veille] fetch error:", err);
    return res.status(500).json({ success: false, message: "Erreur lors de la récupération des flux RSS." });
  }
});

export default routerVeille;
