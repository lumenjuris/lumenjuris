import { useState } from "react";
import { Bookmark, Filter } from "lucide-react";

type Tag = "Tous" | "Rupture" | "Discipline" | "Temps de travail" | "Rémunération" | "Santé/Sécurité";

const TAGS: Tag[] = ["Tous", "Rupture", "Discipline", "Temps de travail", "Rémunération", "Santé/Sécurité"];

const TAG_COLORS: Record<string, string> = {
  "Temps de travail": "bg-green-100 text-green-700",
  "Rupture":          "bg-orange-100 text-orange-700",
  "Discipline":       "bg-purple-100 text-purple-700",
  "Rémunération":     "bg-blue-100 text-blue-700",
  "Santé/Sécurité":   "bg-red-100 text-red-700",
};

const articles = [
  {
    tag: "Temps de travail" as Tag,
    date: "28 fév. 2026",
    title: "Nouvelle obligation d'information des salariés en CDD à partir du 1er mars 2026",
    summary: "Les employeurs doivent désormais informer les salariés en CDD des postes en CDI disponibles au sein de l'entreprise.",
    impact: "Mise à jour de vos modèles de CDD recommandée",
    source: "Décret n°2026-xxx",
  },
  {
    tag: "Rupture" as Tag,
    date: "25 fév. 2026",
    title: "Réforme des indemnités prud'homales : barème Macron actualisé au 1er janvier 2026",
    summary: "Le barème des indemnités prud'homales a été revalorisé. Les plafonds et planchers sont ajustés pour tenir compte de l'inflation.",
    impact: "Vérifiez vos provisions pour litiges en cours",
    source: "Décret n°2025-1432",
  },
  {
    tag: "Discipline" as Tag,
    date: "22 fév. 2026",
    title: "Procédure disciplinaire : clarification des délais de prescription par la Cour de cassation",
    summary: "La Cour de cassation précise que le délai de 2 mois court à compter du jour où l'employeur a eu connaissance exacte de l'étendue des faits.",
    impact: "Révision des procédures disciplinaires internes conseillée",
    source: "Cass. soc., 19 fév. 2026",
  },
  {
    tag: "Rémunération" as Tag,
    date: "18 fév. 2026",
    title: "Télétravail : nouvelles obligations de prise en charge des frais professionnels",
    summary: "L'employeur doit prendre en charge les frais liés au télétravail selon un forfait minimum révisé.",
    impact: "Mise à jour de votre accord télétravail nécessaire",
    source: "ANI du 12 fév. 2026",
  },
  {
    tag: "Santé/Sécurité" as Tag,
    date: "14 fév. 2026",
    title: "Inaptitude professionnelle : obligation de reclassement renforcée",
    summary: "La jurisprudence renforce l'obligation de proposer des postes de reclassement adaptés en cas d'inaptitude déclarée par le médecin du travail.",
    impact: "Revoyez vos procédures de gestion de l'inaptitude",
    source: "Cass. soc., 8 fév. 2026",
  },
  {
    tag: "Temps de travail" as Tag,
    date: "10 fév. 2026",
    title: "Forfait jours : la clause de déconnexion doit fixer des plages horaires précises",
    summary: "Le Conseil d'État confirme que toute convention de forfait en jours doit prévoir des modalités concrètes et mesurables de droit à la déconnexion.",
    impact: "Vérifiez la conformité de vos conventions individuelles",
    source: "Conseil d'État, 5 fév. 2026",
  },
];

export function Veille() {
  const [activeTag, setActiveTag] = useState<Tag>("Tous");
  const [bookmarked, setBookmarked] = useState<Set<number>>(new Set());

  const filtered = articles.filter((a) => activeTag === "Tous" || a.tag === activeTag);

  const toggleBookmark = (i: number) => {
    setBookmarked((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Title */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Veille information</h1>
          <p className="text-sm text-gray-500 mt-1">Actualités juridiques impactant votre entreprise</p>
        </div>
        <button className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-2 hover:border-gray-300 transition-colors shrink-0">
          <Filter className="h-3.5 w-3.5" />
          Filtrer
        </button>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => setActiveTag(tag)}
            className={`text-sm px-4 py-1.5 rounded-full border font-medium transition-colors ${
              activeTag === tag
                ? "bg-lumenjuris text-white border-lumenjuris"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Articles */}
      <div className="space-y-3">
        {filtered.map((article, i) => (
          <article key={i} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0 space-y-2">
                {/* Tag + date */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${TAG_COLORS[article.tag] ?? "bg-gray-100 text-gray-600"}`}>
                    {article.tag}
                  </span>
                  <span className="text-xs text-gray-400">{article.date}</span>
                </div>

                {/* Title */}
                <h2 className="text-sm font-semibold text-gray-900 leading-snug">{article.title}</h2>

                {/* Summary */}
                <p className="text-sm text-gray-500 leading-relaxed">{article.summary}</p>

                {/* Impact banner */}
                <div className="bg-lumenjuris/5 border border-lumenjuris/15 rounded-lg px-3 py-2">
                  <span className="text-xs font-semibold text-lumenjuris">Impact pour votre entreprise : </span>
                  <span className="text-xs text-lumenjuris/80 italic">{article.impact}</span>
                </div>

                {/* Source */}
                <p className="text-xs text-gray-400">Source : {article.source}</p>
              </div>

              {/* Bookmark */}
              <button
                onClick={() => toggleBookmark(i)}
                className={`shrink-0 mt-0.5 transition-colors ${bookmarked.has(i) ? "text-lumenjuris" : "text-gray-300 hover:text-gray-400"}`}
              >
                <Bookmark className={`h-5 w-5 ${bookmarked.has(i) ? "fill-current" : ""}`} />
              </button>
            </div>
          </article>
        ))}

        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 shadow-sm text-center">
            <p className="text-gray-400 text-sm">Aucun article dans cette catégorie.</p>
          </div>
        )}
      </div>
    </div>
  );
}

