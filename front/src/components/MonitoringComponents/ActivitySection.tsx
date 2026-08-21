import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LabelList,
} from "recharts";
import { fetchProxy } from "../../utils/fetchProxy";
import { Activity, Zap, Users, TrendingUp, ChevronDown, X, Clock, ShieldAlert, Info, Download } from "lucide-react";

// ─── Métadonnées des features ──────────────────────────────────────────────────

const FEATURE_META: Record<string, { label: string; color: string; llm: boolean; description: string }> = {
  // Fonctionnalités avec coût de traitement IA
  analyze_contract:  { label: "Analyse contrat",      color: "#6366f1", llm: true,  description: "Analyse complète d'un contrat uploadé : détection des clauses à risque et scoring global." },
  detect_contract:   { label: "Détection type",       color: "#8b5cf6", llm: true,  description: "Identification IA du type de document à l'upload (travail, bail, commercial…) — étape préliminaire de l'analyse." },
  market_analysis:   { label: "Analyse de marché",    color: "#14b8a6", llm: true,  description: "Analyse de marché complète : secteur d'activité, positionnement et benchmark." },
  recommend_clause:  { label: "Recomm. clause",       color: "#f59e0b", llm: true,  description: "Suggestions IA de clauses de remplacement ou de reformulation pour une clause à risque." },
  detect_legal_refs: { label: "Réf. légales",         color: "#3b82f6", llm: true,  description: "Détection des références juridiques citées dans un document (articles de loi, codes)." },
  summarize_case:    { label: "Résumé jurispru.",     color: "#ec4899", llm: true,  description: "Résumé IA d'une décision de jurisprudence." },
  generate_contract: { label: "Génération contrat",   color: "#10b981", llm: true,  description: "Génération d'un contrat depuis un template avec ses variables personnalisées." },
  import_template:   { label: "Import template",      color: "#f97316", llm: true,  description: "Import et structuration IA d'un modèle de contrat (compté uniquement si la sauvegarde réussit)." },
  analyze_clause:    { label: "Analyse clause",       color: "#06b6d4", llm: true,  description: "Analyse approfondie d'une clause spécifique sélectionnée par l'utilisateur." },
  chat:              { label: "Chat juridique",        color: "#64748b", llm: true,  description: "Conversations avec le chat juridique principal de l'application." },
  openai_chat:       { label: "Assistant IA",         color: "#a78bfa", llm: true,  description: "Assistant IA généraliste (routes de chat secondaires)." },
  legal_watch_run:   { label: "Actualité juridique — pipeline IA", color: "#a16207", llm: true,  description: "Exécution du pipeline de veille : collecte et enrichissement IA des articles (admin/juriste)." },
  // Fonctionnalités sans coût IA (usage produit)
  legal_watch:       { label: "Actualité juridique",     color: "#84cc16", llm: false, description: "Consultation du digest de veille juridique (articles et alertes publiés)." },
  esignature:        { label: "E-signature",          color: "#0ea5e9", llm: false, description: "Création et envoi d'une enveloppe de signature électronique." },
  contract_library:  { label: "Contrathèque",         color: "#78716c", llm: false, description: "Ajout d'un contrat dans la contrathèque (import ou création)." },
  negotiation:       { label: "Négociation",          color: "#e11d48", llm: false, description: "Ouverture ou entrée dans une session de négociation de contrat." },
  clause_library:    { label: "Bibl. de clauses",     color: "#0d9488", llm: false, description: "Ajout d'une clause dans la bibliothèque de clauses réutilisables." },
};

function featureLabel(key: string): string {
  return FEATURE_META[key]?.label ?? key;
}
function featureColor(key: string): string {
  return FEATURE_META[key]?.color ?? "#94a3b8";
}
function featureLlm(key: string): boolean | undefined {
  return FEATURE_META[key]?.llm;
}

/** Badge distinguant les fonctionnalités avec coût de traitement IA de celles sans. */
function LlmTag({ llm }: { llm: boolean | undefined }) {
  if (llm === undefined) return null;
  return llm ? (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 whitespace-nowrap">
      <Zap className="w-2.5 h-2.5" />
      IA
    </span>
  ) : (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-400 border border-gray-200 whitespace-nowrap">
      sans IA
    </span>
  );
}

// ─── Plages temporelles ────────────────────────────────────────────────────────

const TIME_RANGES = [
  { label: "7 j",    days: 7 },
  { label: "14 j",   days: 14 },
  { label: "30 j",   days: 30 },
  { label: "3 mois", days: 90 },
  { label: "6 mois", days: 180 },
  { label: "1 an",   days: 365 },
] as const;

// ─── Granularité & groupement ──────────────────────────────────────────────────

type Granularity = "day" | "week" | "month";

function granularityFor(days: number): Granularity {
  if (days <= 30)  return "day";
  if (days <= 180) return "week";
  return "month";
}

function mondayOf(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

type TimelineEntry = { date: string } & Record<string, number>;

function groupTimeline(entries: TimelineEntry[], gran: Granularity): TimelineEntry[] {
  if (gran === "day") return entries;
  const buckets = new Map<string, Record<string, number>>();
  for (const e of entries) {
    const key = gran === "week" ? mondayOf(e.date) : monthOf(e.date);
    if (!buckets.has(key)) buckets.set(key, {});
    const b = buckets.get(key)!;
    for (const [k, v] of Object.entries(e)) {
      if (k === "date") continue;
      b[k] = (b[k] ?? 0) + (v as number);
    }
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));
}

function formatTick(iso: string, gran: Granularity): string {
  if (gran === "month") {
    const d = new Date(`${iso}-01T00:00:00Z`);
    return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" });
  }
  const d = new Date(iso + "T00:00:00Z");
  if (gran === "week") return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
}

function formatTooltipLabel(iso: string, gran: Granularity): string {
  if (gran === "month") {
    const d = new Date(`${iso}-01T00:00:00Z`);
    return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
  }
  const d = new Date(iso + "T00:00:00Z");
  if (gran === "week") {
    return "Sem. du " + d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type FeatureSummaryItem = { feature: string; count: number };
type TopUser = {
  userId: number;
  email: string;
  nom: string | null;
  prenom: string | null;
  total: number;
  byFeature: Record<string, number>;
};
type ActivityData = {
  summary: FeatureSummaryItem[];
  timeline: TimelineEntry[];
  topUsers: TopUser[];
  days: number;
};

type UserActivityDetail = {
  user: {
    idUser: number;
    email: string;
    nom: string | null;
    prenom: string | null;
    role: string;
    isBanned: boolean;
  };
  total: number;
  firstActivity: string | null;
  lastActivity: string | null;
  summary: FeatureSummaryItem[];
  timeline: TimelineEntry[];
  recentEvents: { feature: string; createdAt: string }[];
  days: number;
};

// ─── Composant principal ───────────────────────────────────────────────────────

export function ActivitySection() {
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  // Fonctionnalités masquées dans le graphique (via la légende cliquable)
  const [hiddenFeatures, setHiddenFeatures] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void fetchProxy(`/api/admin/feature-usage?days=${selectedDays}`, { credentials: "include" })
      .then((r) => r.json() as Promise<{ success: boolean; data?: ActivityData; message?: string }>)
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.message ?? "Erreur serveur");
        setData(json.data ?? null);
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedDays]);

  // Export JSON de toutes les données de la période affichée
  const exportJson = () => {
    if (!data) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      periodDays: data.days,
      totalEvents,
      summary: data.summary.map((s) => ({
        ...s,
        label: featureLabel(s.feature),
        llm: featureLlm(s.feature) ?? null,
      })),
      timeline: data.timeline,
      topUsers: data.topUsers,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activite_${data.days}j_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleFeature = (feature: string) => {
    setHiddenFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(feature)) {
        next.delete(feature);
      } else {
        next.add(feature);
      }
      return next;
    });
  };

  const totalEvents = useMemo(() => data?.summary.reduce((s, f) => s + f.count, 0) ?? 0, [data]);
  const topFeature = data?.summary[0] ?? null;
  const activeUserCount = data?.topUsers.length ?? 0;

  // Une barre par fonctionnalité (totaux sur la période), filtrée par la légende
  const featureChartData = useMemo(() => {
    if (!data) return [];
    return data.summary
      .filter((s) => !hiddenFeatures.has(s.feature))
      .map((s) => ({ feature: s.feature, count: s.count }));
  }, [data, hiddenFeatures]);

  return (
    <div className="space-y-6">
      {/* Sélecteur de plage + export */}
      <div className="flex items-center gap-2 flex-wrap">
        {TIME_RANGES.map(({ label, days }) => (
          <button
            key={days}
            onClick={() => setSelectedDays(days)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedDays === days
                ? "bg-indigo-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-700"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={exportJson}
          disabled={!data || loading}
          title="Télécharger toutes les données de la période affichée au format JSON"
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Exporter JSON
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && (
        <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl p-4">
          Erreur : {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatTile
              icon={<Zap className="w-4 h-4" />}
              label="Appels LLM"
              value={totalEvents.toLocaleString("fr-FR")}
              sub={`sur ${selectedDays} j`}
            />
            <StatTile
              icon={<TrendingUp className="w-4 h-4" />}
              label="Feature la plus utilisée"
              value={topFeature ? featureLabel(topFeature.feature) : "—"}
              sub={topFeature ? `${topFeature.count} appels` : ""}
              accent
            />
            <StatTile
              icon={<Users className="w-4 h-4" />}
              label="Utilisateurs actifs"
              value={activeUserCount.toString()}
              sub="sur la période"
            />
          </div>

          {/* Graphique */}
          {data.summary.length > 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-gray-700">Appels par fonctionnalité</h3>
                <span className="text-xs font-normal text-gray-400">
                  (totaux sur {selectedDays} jours)
                </span>
                {hiddenFeatures.size > 0 && (
                  <button
                    onClick={() => setHiddenFeatures(new Set())}
                    className="ml-auto text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Tout réafficher ({hiddenFeatures.size} masquée{hiddenFeatures.size > 1 ? "s" : ""})
                  </button>
                )}
              </div>

              {/* Légende interactive : clic sur une pastille pour masquer / réafficher */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {data.summary.map((s) => {
                  const hidden = hiddenFeatures.has(s.feature);
                  return (
                    <button
                      key={s.feature}
                      onClick={() => toggleFeature(s.feature)}
                      title={hidden ? "Cliquer pour réafficher" : "Cliquer pour masquer"}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-all ${
                        hidden
                          ? "border-gray-100 bg-gray-50 text-gray-300"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:shadow-sm"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${hidden ? "opacity-30" : ""}`}
                        style={{ backgroundColor: featureColor(s.feature) }}
                      />
                      <span className={hidden ? "line-through" : ""}>{featureLabel(s.feature)}</span>
                      <span className={`font-semibold ${hidden ? "text-gray-300" : "text-gray-800"}`}>
                        {s.count.toLocaleString("fr-FR")}
                      </span>
                    </button>
                  );
                })}
              </div>

              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={featureChartData} margin={{ top: 16, right: 8, left: -16, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="feature"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickFormatter={(v: string) => featureLabel(v)}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={70}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(99, 102, 241, 0.06)" }}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const entry = payload[0];
                      const feat = String((entry.payload as { feature: string }).feature);
                      const count = Number(entry.value ?? 0);
                      const pct = totalEvents > 0 ? ((count / totalEvents) * 100).toFixed(1) : "0";
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
                          <div className="flex items-center gap-1.5 font-semibold text-gray-800">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: featureColor(feat) }}
                            />
                            {featureLabel(feat)}
                          </div>
                          <p className="text-gray-600 mt-0.5">
                            {count.toLocaleString("fr-FR")} appel{count > 1 ? "s" : ""}
                            <span className="text-gray-400"> · {pct} % du total</span>
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={56}>
                    <LabelList
                      dataKey="count"
                      position="top"
                      formatter={(v: number) => v.toLocaleString("fr-FR")}
                      style={{ fontSize: 11, fill: "#6b7280", fontWeight: 600 }}
                    />
                    {featureChartData.map((d) => (
                      <Cell key={d.feature} fill={featureColor(d.feature)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Aucune activité enregistrée sur cette période.</p>
              <p className="text-xs mt-1 text-gray-300">Les données s'accumuleront dès que des fonctionnalités IA seront utilisées.</p>
            </div>
          )}

          {/* Tableau feature breakdown */}
{data.summary.length > 0 && (
  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
    <div className="px-4 sm:px-5 py-3 border-b border-gray-100 flex items-center gap-2">
      <ChevronDown className="w-4 h-4 text-gray-400" />
      <h3 className="text-sm font-semibold text-gray-700">Répartition par fonctionnalité</h3>
    </div>

    {/* En-tête (Desktop uniquement) */}
    <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wide">
      <span className="col-span-6">Fonctionnalité</span>
      <span className="col-span-2 text-right">Appels</span>
      <span className="col-span-4 text-right pr-2">Part</span>
    </div>

    {/* Liste des fonctionnalités */}
    <div className="divide-y divide-gray-100">
      {data.summary.map((item) => {
        const pct = totalEvents > 0 ? (item.count / totalEvents) * 100 : 0;
        const color = featureColor(item.feature);

        return (
          <div key={item.feature} className="p-3.5 sm:px-5 sm:py-3 hover:bg-gray-50/50 transition-colors">
            {/* ── Vue Mobile ── */}
            <div className="sm:hidden space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {featureLabel(item.feature)}
                  </span>
                  <LlmTag llm={featureLlm(item.feature)} />
                </div>
                <span className="text-sm font-bold text-gray-900 shrink-0">
                  {item.count.toLocaleString("fr-FR")}
                </span>
              </div>

              {/* Barre de progression pleine largeur sur mobile */}
              <div className="flex items-center gap-2 pt-0.5">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-xs text-gray-400 tabular-nums w-10 text-right">
                  {pct.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* ── Vue Desktop ── */}
            <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
              <div className="col-span-6 flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm text-gray-700 truncate">{featureLabel(item.feature)}</span>
                <LlmTag llm={featureLlm(item.feature)} />
              </div>

              <div className="col-span-2 text-right font-medium text-gray-900 text-sm tabular-nums">
                {item.count.toLocaleString("fr-FR")}
              </div>

              <div className="col-span-4 flex items-center gap-2 pl-4">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-xs text-gray-400 tabular-nums w-10 text-right">
                  {pct.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}

          {/* Utilisateurs actifs — clic pour ouvrir le détail */}
          {data.topUsers.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-gray-700">Utilisateurs actifs</h3>
                <span className="ml-auto text-xs text-gray-400">Cliquez sur un utilisateur pour voir le détail</span>
              </div>
              <div className="overflow-y-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wide font-semibold sticky top-0">
                  <tr>
                    <th className="px-5 py-2.5 text-left">#</th>
                    <th className="px-5 py-2.5 text-left">Utilisateur</th>
                    <th className="px-5 py-2.5 text-right">Total</th>
                    <th className="px-5 py-2.5 text-left">Répartition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.topUsers.map((u, idx) => {
                    const name = [u.prenom, u.nom].filter(Boolean).join(" ") || u.email.split("@")[0];
                    const initials = `${u.prenom?.[0] ?? ""}${u.nom?.[0] ?? ""}`.toUpperCase() || u.email[0]?.toUpperCase() || "?";
                    const topFeat = Object.entries(u.byFeature).sort(([, a], [, b]) => b - a)[0];
                    return (
                      <tr
                        key={u.userId}
                        onClick={() => setSelectedUserId(u.userId)}
                        className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-2.5 text-gray-400 font-medium">{idx + 1}</td>
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-800 truncate">{name}</p>
                              <p className="text-xs text-gray-400 truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-2.5 text-right font-semibold text-gray-900">
                          {u.total.toLocaleString("fr-FR")}
                        </td>
                        <td className="px-5 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {topFeat && (
                              <span
                                className="px-2 py-0.5 rounded-full text-white text-xs font-medium"
                                style={{ backgroundColor: featureColor(topFeat[0]) }}
                              >
                                {featureLabel(topFeat[0])}
                              </span>
                            )}
                            {Object.keys(u.byFeature).length > 1 && (
                              <span className="text-xs text-gray-400 self-center">
                                +{Object.keys(u.byFeature).length - 1} autre{Object.keys(u.byFeature).length > 2 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* Légende des fonctionnalités */}
          <FeatureLegend />

          {/* Panneau de détail utilisateur */}
          {selectedUserId !== null && (
            <UserActivityPanel
              userId={selectedUserId}
              days={selectedDays}
              onClose={() => setSelectedUserId(null)}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─── Légende des fonctionnalités trackées ──────────────────────────────────────

function FeatureLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-5 py-3 hover:bg-gray-50/50 transition-colors"
      >
        <Info className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700">Légende des fonctionnalités</h3>
        <span className="text-xs text-gray-400 font-normal">— à quoi correspond chaque fonctionnalité trackée</span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 ml-auto shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wide font-semibold">
              <tr>
                <th className="px-5 py-2.5 text-left whitespace-nowrap">Fonctionnalité</th>
                <th className="px-5 py-2.5 text-left whitespace-nowrap">Coût</th>
                <th className="px-5 py-2.5 text-left whitespace-nowrap hidden sm:table-cell">Clé technique</th>
                <th className="px-5 py-2.5 text-left">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Object.entries(FEATURE_META).map(([key, meta]) => (
                <tr key={key} className="hover:bg-gray-50/50">
                  <td className="px-5 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="font-medium text-gray-800">{meta.label}</span>
                    </div>
                  </td>
                  <td className="px-5 py-2.5">
                    <LlmTag llm={meta.llm} />
                  </td>
                  <td className="px-5 py-2.5 hidden sm:table-cell">
                    <code className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{key}</code>
                  </td>
                  <td className="px-5 py-2.5 text-xs text-gray-500">{meta.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Panneau de détail d'activité utilisateur (slide-over) ─────────────────────

function UserActivityPanel({
  userId,
  days,
  onClose,
}: {
  userId: number;
  days: number;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<UserActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void fetchProxy(`/api/admin/feature-usage/users/${userId}?days=${days}`, { credentials: "include" })
      .then((r) => r.json() as Promise<{ success: boolean; data?: UserActivityDetail; message?: string }>)
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.message ?? "Erreur serveur");
        setDetail(json.data ?? null);
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, days]);

  const gran = granularityFor(days);
  const chartData = useMemo(
    () => (detail ? groupTimeline(detail.timeline, gran) : []),
    [detail, gran],
  );

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("fr-FR", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const name = detail
    ? [detail.user.prenom, detail.user.nom].filter(Boolean).join(" ") || detail.user.email.split("@")[0]
    : "";
  const initials = detail
    ? (`${detail.user.prenom?.[0] ?? ""}${detail.user.nom?.[0] ?? ""}`.toUpperCase() || detail.user.email[0]?.toUpperCase()) ?? "?"
    : "?";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-[28rem] max-w-full bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Détail d'activité</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {error && (
            <div className="m-4 text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl p-4">
              Erreur : {error}
            </div>
          )}

          {detail && !loading && (
            <div className="p-5 space-y-5">
              {/* Identité */}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center flex-shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate flex items-center gap-2">
                    {name}
                    {detail.user.isBanned && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                        <ShieldAlert className="w-3.5 h-3.5" /> SUSPENDU
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{detail.user.email}</p>
                  <p className="text-xs text-gray-400">{detail.user.role} · ID {detail.user.idUser}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-gray-900">{detail.total.toLocaleString("fr-FR")}</p>
                  <p className="text-xs text-gray-400">appels</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-gray-900">{detail.summary.length}</p>
                  <p className="text-xs text-gray-400">features</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold text-gray-900">
                    {detail.timeline.length > 0 ? Math.round(detail.total / detail.timeline.length) : 0}
                  </p>
                  <p className="text-xs text-gray-400">appels/jour actif</p>
                </div>
              </div>

              {/* Première / dernière activité */}
              {(detail.firstActivity || detail.lastActivity) && (
                <div className="text-xs text-gray-500 space-y-1 bg-gray-50 rounded-lg p-3">
                  {detail.firstActivity && (
                    <p className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      Première activité : <span className="font-medium text-gray-700">{formatDateTime(detail.firstActivity)}</span>
                    </p>
                  )}
                  {detail.lastActivity && (
                    <p className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      Dernière activité : <span className="font-medium text-gray-700">{formatDateTime(detail.lastActivity)}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Mini graphique timeline */}
              {chartData.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Activité sur {days} jours
                  </h4>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={chartData} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        tickFormatter={(v: string) => formatTick(v, gran)}
                        interval={Math.max(0, Math.floor(chartData.length / 5) - 1)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} allowDecimals={false} axisLine={false} tickLine={false} />
                      <Tooltip
                        labelFormatter={(v: string) => formatTooltipLabel(v, gran)}
                        formatter={(value: number, key: string) => [value, featureLabel(key)]}
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                      />
                      {detail.summary.map((s) => (
                        <Bar key={s.feature} dataKey={s.feature} stackId="a" fill={featureColor(s.feature)} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Répartition par feature */}
              {detail.summary.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Répartition par fonctionnalité
                  </h4>
                  <div className="space-y-1.5">
                    {detail.summary.map((s) => {
                      const pct = detail.total > 0 ? (s.count / detail.total) * 100 : 0;
                      return (
                        <div key={s.feature} className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: featureColor(s.feature) }}
                          />
                          <span className="text-xs text-gray-600 w-36 truncate">{featureLabel(s.feature)}</span>
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: featureColor(s.feature) }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-700 w-8 text-right">{s.count}</span>
                          <span className="text-xs text-gray-400 w-10 text-right">{pct.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Derniers événements */}
              {detail.recentEvents.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Derniers événements ({detail.recentEvents.length})
                  </h4>
                  <div className="border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-64 overflow-y-auto">
                    {detail.recentEvents.map((e, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-1.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: featureColor(e.feature) }}
                        />
                        <span className="text-xs text-gray-700 flex-1 truncate">{featureLabel(e.feature)}</span>
                        <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(e.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.total === 0 && (
                <p className="text-center text-sm text-gray-400 py-6">
                  Aucune activité sur cette période.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "bg-indigo-50 border-indigo-200" : "bg-white border-gray-200"}`}>
      <div className={`flex items-center gap-1.5 text-xs font-medium mb-2 ${accent ? "text-indigo-600" : "text-gray-500"}`}>
        {icon}
        {label}
      </div>
      <p className={`text-xl font-bold truncate ${accent ? "text-indigo-700" : "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
