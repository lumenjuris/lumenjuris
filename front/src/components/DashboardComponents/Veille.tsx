import { useEffect, useRef, useState } from "react";
import { Bookmark, RefreshCw, Settings2 } from "lucide-react";
import { fetchProxy } from "../../utils/fetchProxy";

type VeilleTag =
  | "Rupture"
  | "Discipline"
  | "Temps de travail"
  | "Rémunération"
  | "Santé/Sécurité"
  | "Relations collectives"
  | "Protection sociale"
  | "Recrutement";

interface VeilleArticle {
  tag: VeilleTag;
  date: string;
  title: string;
  summary: string;
  impact: string;
  source: string;
  link?: string;
}

const ALL_TAGS: VeilleTag[] = [
  "Rupture",
  "Discipline",
  "Temps de travail",
  "Rémunération",
  "Santé/Sécurité",
  "Relations collectives",
  "Protection sociale",
  "Recrutement",
];

const TAG_COLORS: Record<VeilleTag, string> = {
  "Temps de travail": "bg-green-100 text-green-700",
  Rupture: "bg-orange-100 text-orange-700",
  Discipline: "bg-purple-100 text-purple-700",
  Rémunération: "bg-blue-100 text-blue-700",
  "Santé/Sécurité": "bg-red-100 text-red-700",
  "Relations collectives": "bg-yellow-100 text-yellow-700",
  "Protection sociale": "bg-teal-100 text-teal-700",
  Recrutement: "bg-indigo-100 text-indigo-700",
};

function ArticleSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm animate-pulse">
      <div className="flex items-start gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex gap-2">
            <div className="h-5 w-28 bg-gray-100 rounded-full" />
            <div className="h-5 w-20 bg-gray-100 rounded-full" />
          </div>
          <div className="h-4 w-3/4 bg-gray-100 rounded" />
          <div className="h-3 w-full bg-gray-100 rounded" />
          <div className="h-3 w-5/6 bg-gray-100 rounded" />
          <div className="h-8 bg-gray-50 rounded-lg" />
        </div>
        <div className="h-5 w-5 bg-gray-100 rounded shrink-0 mt-0.5" />
      </div>
    </div>
  );
}

export function Veille() {
  const [activeTags, setActiveTags] = useState<Set<VeilleTag>>(
    new Set(ALL_TAGS),
  );
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set());
  const [articles, setArticles] = useState<VeilleArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prefLoaded, setPrefLoaded] = useState(false);
  const [managing, setManaging] = useState(false);
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Charger les préférences puis les articles
  useEffect(() => {
    fetchProxy("/api/user/preferences", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return;
        const payload = (await res.json()) as {
          success: boolean;
          data?: { preferenceUI?: { veilleActiveTags?: string[] } };
        };
        const saved = payload.data?.preferenceUI?.veilleActiveTags;
        if (Array.isArray(saved) && saved.length > 0) {
          setActiveTags(
            new Set(
              saved.filter((t): t is VeilleTag =>
                (ALL_TAGS as string[]).includes(t),
              ),
            ),
          );
        }
      })
      .catch(() => {})
      .finally(() => setPrefLoaded(true));
  }, []);

  useEffect(() => {
    if (prefLoaded) loadArticles();
  }, [prefLoaded]);

  // Fermer le panneau au clic extérieur
  useEffect(() => {
    if (!managing) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setManaging(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [managing]);

  const loadArticles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchProxy("/api/veille", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as {
        success: boolean;
        data?: VeilleArticle[];
      };
      setArticles(payload.success && payload.data ? payload.data : []);
    } catch {
      setArticles([]);
      setError("Impossible de charger les flux RSS.");
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = async (tag: VeilleTag) => {
    const next = new Set(activeTags);
    next.has(tag) ? next.delete(tag) : next.add(tag);
    if (next.size === 0) return; // toujours au moins un tag actif
    setActiveTags(next);
    setSaving(true);
    try {
      await fetchProxy("/api/user/preferences", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferenceUI: { veilleActiveTags: [...next] } }),
      });
    } catch {}
    setSaving(false);
  };

  const filtered = articles.filter((a) => activeTags.has(a.tag));

  const toggleBookmark = (i: number) => {
    setBookmarked((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Veille information
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Actualités juridiques impactant votre entreprise
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={loadArticles}
            disabled={loading}
            className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-2 hover:border-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Actualiser
          </button>

          {/* Gérer */}
          <div className="relative" ref={panelRef}>
            <button
              onClick={() => setManaging((v) => !v)}
              className={`flex items-center gap-1.5 text-sm border rounded-lg px-3 py-2 transition-colors ${managing ? "bg-lumenjuris text-white border-lumenjuris" : "text-gray-600 border-gray-200 hover:border-gray-300"}`}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Gérer
              {saving && (
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
              )}
            </button>

            {managing && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Thématiques suivies
                </p>
                <div className="space-y-2">
                  {ALL_TAGS.map((tag) => (
                    <label
                      key={tag}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={activeTags.has(tag)}
                        onChange={() => toggleTag(tag)}
                        disabled={activeTags.size === 1 && activeTags.has(tag)}
                        className="w-4 h-4 rounded accent-lumenjuris cursor-pointer"
                      />
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_COLORS[tag]}`}
                      >
                        {tag}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tags actifs (pills résumé) */}
      {activeTags.size < ALL_TAGS.length && (
        <div className="flex flex-wrap gap-1.5">
          {[...activeTags].map((tag) => (
            <span
              key={tag}
              className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${TAG_COLORS[tag]}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Erreur */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-700">
          {error}
        </div>
      )}

      {/* Articles */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <ArticleSkeleton key={i} />)
        ) : (
          <>
            {filtered.map((article, i) => (
              <article
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${TAG_COLORS[article.tag] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {article.tag}
                      </span>
                      <span className="text-xs text-gray-400">
                        {article.date}
                      </span>
                    </div>

                    {article.link ? (
                      <a
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm font-semibold text-gray-900 leading-snug hover:text-lumenjuris transition-colors"
                      >
                        {article.title}
                      </a>
                    ) : (
                      <h2 className="text-sm font-semibold text-gray-900 leading-snug">
                        {article.title}
                      </h2>
                    )}

                    <p className="text-sm text-gray-500 leading-relaxed">
                      {article.summary}
                    </p>

                    <div className="bg-lumenjuris/5 border border-lumenjuris/15 rounded-lg px-3 py-2">
                      <span className="text-xs font-semibold text-lumenjuris">
                        Impact pour votre entreprise :{" "}
                      </span>
                      <span className="text-xs text-lumenjuris/80 italic">
                        {article.impact}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400">
                      Source : {article.source}
                    </p>
                  </div>

                  <button
                    onClick={() => toggleBookmark(i)}
                    className={`shrink-0 mt-0.5 transition-colors ${bookmarked.has(i) ? "text-lumenjuris" : "text-gray-300 hover:text-gray-400"}`}
                  >
                    <Bookmark
                      className={`h-5 w-5 ${bookmarked.has(i) ? "fill-current" : ""}`}
                    />
                  </button>
                </div>
              </article>
            ))}

            {filtered.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 shadow-sm text-center">
                <p className="text-gray-400 text-sm">
                  Aucun article dans les thématiques sélectionnées.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
