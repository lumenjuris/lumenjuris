import { useEffect, useState, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Zap, ArrowUpDown, CalendarDays } from "lucide-react";
import { fetchProxy } from "../../utils/fetchProxy";
import { KpiCard } from "../ui/kpiCard";

// ── Types ─────────────────────────────────────────────────────────────────────
type DayEntry = {
  date: string; // "YYYY-MM-DD"
  totalCostUsd: number;
  totalTokens: number;
  tokenInput: number;
  tokenOutput: number;
  byModel: Record<string, { tokenInput: number; tokenOutput: number; totalCostUsd: number }>;
};

// ── Plages temporelles ────────────────────────────────────────────────────────
const TIME_RANGES = [
  { label: "Aujourd'hui", days: 1 },
  { label: "7 j",         days: 7 },
  { label: "14 j",        days: 14 },
  { label: "30 j",        days: 30 },
  { label: "3 mois",      days: 90 },
  { label: "6 mois",      days: 180 },
  { label: "9 mois",      days: 270 },
  { label: "1 an",        days: 365 },
  { label: "5 ans",       days: 1825 },
] as const;

type Days = (typeof TIME_RANGES)[number]["days"];

// ── Options top jours ─────────────────────────────────────────────────────────
const TOP_N_OPTIONS = [
  { label: "Top 5",   value: 5 },
  { label: "Top 10",  value: 10 },
  { label: "Top 20",  value: 20 },
  { label: "Tout",    value: 0 }, // 0 = tous
] as const;

// ── Couleurs modèles ──────────────────────────────────────────────────────────
const MODEL_COLORS: Record<string, string> = {
  "gpt-4o":       "#6366f1",
  "gpt-4o-mini":  "#22c55e",
  "gpt-5.2":      "#f59e0b",
  "gpt-5.4-nano": "#3b82f6",
};
const FALLBACK_COLORS = ["#a855f7", "#ec4899", "#14b8a6", "#f97316"];
const colorOf = (model: string, idx: number) =>
  MODEL_COLORS[model] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];

// ── Granularité selon la plage ────────────────────────────────────────────────
type Granularity = "day" | "week" | "month";

function granularityFor(days: number): Granularity {
  if (days <= 30)  return "day";
  if (days <= 180) return "week";
  return "month";
}

// ── Clés de regroupement ──────────────────────────────────────────────────────
function mondayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function monthOf(iso: string): string {
  return iso.slice(0, 7); // "YYYY-MM"
}

// ── Agrégation pour le graphe ─────────────────────────────────────────────────
function groupHistory(history: DayEntry[], granularity: Granularity): DayEntry[] {
  if (granularity === "day") return history;

  const buckets: Record<string, DayEntry> = {};
  for (const day of history) {
    const key = granularity === "week" ? mondayOf(day.date) : monthOf(day.date);
    if (!buckets[key]) {
      buckets[key] = { date: key, totalCostUsd: 0, totalTokens: 0, tokenInput: 0, tokenOutput: 0, byModel: {} };
    }
    const b = buckets[key];
    b.totalCostUsd += day.totalCostUsd;
    b.totalTokens  += day.totalTokens;
    b.tokenInput   += day.tokenInput;
    b.tokenOutput  += day.tokenOutput;
    Object.entries(day.byModel).forEach(([model, s]) => {
      if (!b.byModel[model]) b.byModel[model] = { tokenInput: 0, tokenOutput: 0, totalCostUsd: 0 };
      b.byModel[model].tokenInput    += s.tokenInput;
      b.byModel[model].tokenOutput   += s.tokenOutput;
      b.byModel[model].totalCostUsd  += s.totalCostUsd;
    });
  }
  return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
}

// ── Formatage ─────────────────────────────────────────────────────────────────
const fmt = {
  number: (n: number) =>
    new Intl.NumberFormat("fr-FR").format(Math.round(n)),
  usd: (n: number, digits = 4) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency", currency: "USD", maximumFractionDigits: digits,
    }).format(n),
  ratio: (a: number, b: number) =>
    b === 0 ? "—" : `${(a / b).toFixed(2)}:1`,

  tickLabel: (key: string, granularity: Granularity): string => {
    if (granularity === "month") {
      const [y, m] = key.split("-").map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    }
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  },

  tooltipLabel: (key: string, granularity: Granularity): string => {
    if (granularity === "week") {
      const [y, m, d] = key.split("-").map(Number);
      return `Sem. du ${new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`;
    }
    if (granularity === "month") {
      const [y, m] = key.split("-").map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    }
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" });
  },

  dateFull: (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
      weekday: "short", day: "2-digit", month: "short", year: "numeric",
    });
  },
};

// ── Sous-composants ───────────────────────────────────────────────────────────
function StatTile({
  label, value, sub, icon: Icon, trend,
}: {
  label: string; value: string; sub?: string;
  icon?: React.ElementType; trend?: "up" | "down" | "flat";
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-red-500" : trend === "down" ? "text-emerald-500" : "text-gray-400";
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-1">
          {trend && <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />}
          {Icon && <Icon className="w-3.5 h-3.5 text-gray-300" />}
        </div>
      </div>
      <span className="text-lg font-bold text-gray-900 tabular-nums leading-tight">{value}</span>
      {sub && <span className="text-[11px] text-gray-400">{sub}</span>}
    </div>
  );
}

function PctBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs tabular-nums text-gray-500 w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export function LlmUsageSection() {
  const [selectedDays, setSelectedDays] = useState<Days>(7);
  const [topN, setTopN]                 = useState<number>(5);

  const [history, setHistory]               = useState<DayEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError]     = useState("");

  const fetchHistory = useCallback(async (days: number) => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const r = await fetchProxy(`/api/llm/usage/history?days=${days}`, { credentials: "include" });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.success) throw new Error(d?.message ?? `HTTP ${r.status}`);
      setHistory(Array.isArray(d.history) ? d.history : []);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : String(e));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { void fetchHistory(selectedDays); }, [selectedDays, fetchHistory]);

  const granularity = granularityFor(selectedDays);

  const models = useMemo(() => {
    const seen = new Set<string>();
    history.forEach((d) => Object.keys(d.byModel).forEach((m) => seen.add(m)));
    return Array.from(seen).sort();
  }, [history]);

  const grouped = useMemo(() => groupHistory(history, granularity), [history, granularity]);

  const chartData = useMemo(
    () => grouped.map((entry) => {
      const row: Record<string, string | number> = { date: entry.date };
      models.forEach((m) => { row[m] = entry.byModel[m]?.totalCostUsd ?? 0; });
      return row;
    }),
    [grouped, models],
  );

  const periodTotals = useMemo(
    () => history.reduce(
      (acc, d) => ({
        cost:        acc.cost + d.totalCostUsd,
        tokens:      acc.tokens + d.totalTokens,
        tokenInput:  acc.tokenInput + d.tokenInput,
        tokenOutput: acc.tokenOutput + d.tokenOutput,
      }),
      { cost: 0, tokens: 0, tokenInput: 0, tokenOutput: 0 },
    ),
    [history],
  );

  const modelStats = useMemo(() => {
    const acc: Record<string, { tokenInput: number; tokenOutput: number; totalCostUsd: number }> = {};
    history.forEach((day) => {
      Object.entries(day.byModel).forEach(([model, s]) => {
        if (!acc[model]) acc[model] = { tokenInput: 0, tokenOutput: 0, totalCostUsd: 0 };
        acc[model].tokenInput   += s.tokenInput;
        acc[model].tokenOutput  += s.tokenOutput;
        acc[model].totalCostUsd += s.totalCostUsd;
      });
    });
    return acc;
  }, [history]);

  const activeDays = history.filter((d) => d.totalTokens > 0).length;
  const avgDailyCost = activeDays > 0 ? periodTotals.cost / activeDays : 0;
  const projMonthly  = avgDailyCost * 30;

  const peakDay = useMemo(
    () => history.reduce<DayEntry | null>(
      (best, d) => (!best || d.totalCostUsd > best.totalCostUsd ? d : best),
      null,
    ),
    [history],
  );

  const trendDir = useMemo((): "up" | "down" | "flat" => {
    if (history.length < 4) return "flat";
    const half = Math.floor(history.length / 2);
    const first  = history.slice(0, half).reduce((s, d) => s + d.totalCostUsd, 0);
    const second = history.slice(half).reduce((s, d) => s + d.totalCostUsd, 0);
    if (second > first * 1.1) return "up";
    if (second < first * 0.9) return "down";
    return "flat";
  }, [history]);

  const sortedDays = useMemo(
    () => [...history].sort((a, b) => b.totalCostUsd - a.totalCostUsd),
    [history],
  );
  const topDays = topN === 0 ? sortedDays : sortedDays.slice(0, topN);

  const xAxisInterval = Math.max(0, Math.floor(chartData.length / 8) - 1);

  const periodLabel = useMemo(() => {
    const r = TIME_RANGES.find((t) => t.days === selectedDays);
    return r?.label ?? `${selectedDays} j`;
  }, [selectedDays]);

  const granLabel = granularity === "week" ? "par semaine" : granularity === "month" ? "par mois" : "par jour";

  return (
    <div className="space-y-8">

      {/* ── Sélecteur plage ── */}
      <div className="flex flex-wrap gap-2">
        {TIME_RANGES.map(({ label, days }) => (
          <button
            key={days}
            onClick={() => setSelectedDays(days)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedDays === days
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Coût total"    value={fmt.usd(periodTotals.cost, 2)}        sub={periodLabel} />
        <KpiCard label="Tokens total"  value={fmt.number(periodTotals.tokens)}       sub="input + output" />
        <KpiCard label="Tokens input"  value={fmt.number(periodTotals.tokenInput)}   sub="envoyés au modèle" />
        <KpiCard label="Tokens output" value={fmt.number(periodTotals.tokenOutput)}  sub="générés" />
      </div>

      {/* ── Graphe ── */}
      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-semibold text-gray-800">Coût LLM</h2>
          <span className="text-sm text-gray-400">{granLabel} — {periodLabel}</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          {historyLoading ? (
            <div className="h-72 flex items-center justify-center text-sm text-gray-400">Chargement…</div>
          ) : historyError ? (
            <div className="h-72 flex items-center justify-center text-sm text-red-400">Erreur : {historyError}</div>
          ) : chartData.length === 0 || models.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-sm text-gray-400">Aucune donnée pour cette période.</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(key) => fmt.tickLabel(key, granularity)}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  interval={xAxisInterval}
                />
                <YAxis
                  tickFormatter={(v: number) => v === 0 ? "$0" : `$${v.toFixed(3)}`}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  width={62}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [fmt.usd(value), name]}
                  labelFormatter={(key) => fmt.tooltipLabel(key, granularity)}
                  contentStyle={{
                    borderRadius: "8px", border: "1px solid #e5e7eb",
                    fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                {models.map((model, idx) => (
                  <Bar key={model} dataKey={model} stackId="cost" fill={colorOf(model, idx)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ── SECTION DÉTAIL ANALYTIQUE ── */}
      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-800">Détail analytique</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">{periodLabel}</span>
        </div>

        {historyLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune donnée pour cette période.</p>
        ) : (
          <>
            {/* Stat tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatTile
                label="Coût moyen / jour actif"
                value={fmt.usd(avgDailyCost, 4)}
                sub={`${activeDays} jour${activeDays > 1 ? "s" : ""} avec activité`}
                icon={CalendarDays}
              />
              <StatTile
                label="Projection mensuelle"
                value={fmt.usd(projMonthly, 2)}
                sub="extrapolé sur 30 jours"
                icon={TrendingUp}
                trend={trendDir}
              />
              <StatTile
                label="Jour le plus cher"
                value={peakDay ? fmt.usd(peakDay.totalCostUsd, 4) : "—"}
                sub={peakDay ? fmt.dateFull(peakDay.date) : undefined}
                icon={Zap}
              />
              <StatTile
                label="Ratio input / output"
                value={fmt.ratio(periodTotals.tokenInput, periodTotals.tokenOutput)}
                sub={`${fmt.number(periodTotals.tokenInput)} in · ${fmt.number(periodTotals.tokenOutput)} out`}
                icon={ArrowUpDown}
              />
            </div>

            {/* Tableau par modèle */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Consommation par modèle</span>
                <span className="text-xs text-gray-400">{periodLabel}</span>
              </div>

              {/* Header Desktop */}
              <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                <span className="col-span-3">Modèle</span>
                <span className="col-span-2 text-right">Input tk</span>
                <span className="col-span-2 text-right">Output tk</span>
                <span className="col-span-2 text-right">Coût USD</span>
                <span className="col-span-3 text-right">Part du total</span>
              </div>

              {/* Liste des modèles */}
              <div className="divide-y divide-gray-100">
                {models.map((model, idx) => {
                  const s = modelStats[model] ?? { tokenInput: 0, tokenOutput: 0, totalCostUsd: 0 };
                  const pct = periodTotals.cost > 0 ? (s.totalCostUsd / periodTotals.cost) * 100 : 0;
                  const color = colorOf(model, idx);
                  
                  return (
                    <div key={model} className="p-4 sm:px-4 sm:py-3 hover:bg-gray-50/50 transition-colors">
                      {/* Mobile */}
                      <div className="sm:hidden space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-sm font-semibold text-gray-900 truncate">{model}</span>
                          </div>
                          <span className="text-sm font-bold text-gray-900">{fmt.usd(s.totalCostUsd)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                          <span>Tokens: <strong className="text-gray-700">{fmt.number(s.tokenInput + s.tokenOutput)}</strong></span>
                          <span className="text-[11px] text-gray-400">(In: {fmt.number(s.tokenInput)} / Out: {fmt.number(s.tokenOutput)})</span>
                        </div>
                        <div className="pt-1">
                          <PctBar pct={pct} color={color} />
                        </div>
                      </div>

                      {/* Desktop */}
                      <div className="hidden sm:grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-3 flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-sm font-medium text-gray-900 truncate">{model}</span>
                        </div>
                        <span className="col-span-2 text-right text-sm tabular-nums text-gray-600">{fmt.number(s.tokenInput)}</span>
                        <span className="col-span-2 text-right text-sm tabular-nums text-gray-600">{fmt.number(s.tokenOutput)}</span>
                        <span className="col-span-2 text-right text-sm tabular-nums font-medium text-gray-800">{fmt.usd(s.totalCostUsd)}</span>
                        <div className="col-span-3"><PctBar pct={pct} color={color} /></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totaux */}
              {models.length > 1 && (
                <div className="p-4 sm:px-4 sm:py-2.5 bg-gray-50 border-t border-gray-200 text-xs font-semibold text-gray-700">
                  <div className="flex justify-between items-center sm:hidden">
                    <span>Total ({fmt.number(periodTotals.tokenInput + periodTotals.tokenOutput)} tk)</span>
                    <span className="text-sm font-bold text-gray-900">{fmt.usd(periodTotals.cost, 4)}</span>
                  </div>
                  <div className="hidden sm:grid grid-cols-12 gap-2">
                    <span className="col-span-3">Total</span>
                    <span className="col-span-2 text-right tabular-nums">{fmt.number(periodTotals.tokenInput)}</span>
                    <span className="col-span-2 text-right tabular-nums">{fmt.number(periodTotals.tokenOutput)}</span>
                    <span className="col-span-2 text-right tabular-nums">{fmt.usd(periodTotals.cost, 4)}</span>
                    <span className="col-span-3 text-right text-gray-400">100 %</span>
                  </div>
                </div>
              )}
            </div>

            {/* Top jours */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-6">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
                <span className="text-sm font-semibold text-gray-700">
                  Jours les plus coûteux
                  <span className="font-normal text-gray-400 ml-1.5">
                    ({topN === 0 ? sortedDays.length : Math.min(topN, sortedDays.length)} / {sortedDays.length})
                  </span>
                </span>
                <div className="flex gap-1.5">
                  {TOP_N_OPTIONS.map(({ label, value }) => (
                    <button
                      key={value}
                      onClick={() => setTopN(value)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        topN === value
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {topDays.length === 0 ? (
                <div className="px-4 py-8 text-sm text-gray-400 text-center">Aucune donnée.</div>
              ) : (
                <>
                  <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    <span className="col-span-1 text-center">#</span>
                    <span className="col-span-4">Date</span>
                    <span className="col-span-2 text-right">Tokens</span>
                    <span className="col-span-3 text-right">Coût</span>
                    <span className="col-span-2">Modèle dominant</span>
                  </div>
                  <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                    {topDays.map((day, rank) => {
                      const dominantModel = Object.entries(day.byModel)
                        .sort((a, b) => b[1].totalCostUsd - a[1].totalCostUsd)[0];
                      const modelIdx = models.indexOf(dominantModel?.[0] ?? "");
                      const isTop = rank === 0;

                      return (
                        <div
                          key={day.date}
                          className={`p-3 sm:px-4 sm:py-3 transition-colors ${isTop ? "bg-amber-50/40" : "hover:bg-gray-50/50"}`}
                        >
                          {/* Mobile */}
                          <div className="flex items-center justify-between sm:hidden">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold text-xs ${isTop ? "text-amber-500" : "text-gray-400"}`}>
                                #{rank + 1}
                              </span>
                              <div>
                                <div className="text-xs font-medium text-gray-800">{fmt.dateFull(day.date)}</div>
                                {dominantModel && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorOf(dominantModel[0], modelIdx) }} />
                                    <span className="text-[10px] text-gray-400">{dominantModel[0]}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-xs font-bold ${isTop ? "text-amber-700" : "text-gray-900"}`}>
                                {fmt.usd(day.totalCostUsd)}
                              </div>
                              <div className="text-[10px] text-gray-400">{fmt.number(day.totalTokens)} tk</div>
                            </div>
                          </div>

                          {/* Desktop */}
                          <div className="hidden sm:grid grid-cols-12 gap-2 items-center text-sm">
                            <span className={`col-span-1 text-center font-bold tabular-nums text-xs ${isTop ? "text-amber-500" : "text-gray-300"}`}>
                              {rank + 1}
                            </span>
                            <span className="col-span-4 text-gray-700 text-xs">{fmt.dateFull(day.date)}</span>
                            <span className="col-span-2 text-right tabular-nums text-gray-500 text-xs">{fmt.number(day.totalTokens)}</span>
                            <span className={`col-span-3 text-right tabular-nums font-semibold ${isTop ? "text-amber-700" : "text-gray-800"}`}>
                              {fmt.usd(day.totalCostUsd)}
                            </span>
                            {dominantModel ? (
                              <div className="col-span-2 flex items-center gap-1.5 min-w-0">
                                <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorOf(dominantModel[0], modelIdx) }} />
                                <span className="text-xs text-gray-500 truncate">{dominantModel[0]}</span>
                              </div>
                            ) : <span className="col-span-2" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
