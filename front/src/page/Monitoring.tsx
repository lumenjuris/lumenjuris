import { useEffect, useState, useMemo, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import MainHeader from "../components/MainHeader/MainHeader";
import { useUserStore } from "../store/userStore";
import { Navigate } from "react-router-dom";
import { fetchProxy } from "../utils/fetchProxy";
import { KpiCard } from "../components/ui/kpiCard";

type LlmUsage = {
  model: string;
  tokenInput: number;
  tokenOutput: number;
  totalTokens: number;
  totalCostUsd: number;
  startAt: string;
  expiresAt: string;
};

type DayEntry = {
  date: string; // "YYYY-MM-DD"
  totalCostUsd: number;
  totalTokens: number;
  tokenInput: number;
  tokenOutput: number;
  byModel: Record<
    string,
    { tokenInput: number; tokenOutput: number; totalCostUsd: number }
  >;
};

const TIME_RANGES = [
  { label: "Aujourd'hui", days: 1 },
  { label: "7 jours", days: 7 },
  { label: "14 jours", days: 14 },
  { label: "30 jours", days: 30 },
] as const;

type Days = (typeof TIME_RANGES)[number]["days"];

// Couleurs fixes par modèle
const MODEL_COLORS: Record<string, string> = {
  "gpt-4o": "#6366f1",
  "gpt-4o-mini": "#22c55e",
  "gpt-5.2": "#f59e0b",
  "gpt-5.4-nano": "#3b82f6",
};
// Palette de secours pour les modèles non listés ci-dessus
const FALLBACK_COLORS = ["#a855f7", "#ec4899", "#14b8a6", "#f97316"];

// Intervalle de rafraîchissement du snapshot live (ms)
const LIVE_REFRESH_MS = 5_000;

const formating = {
  /** Nombre entier, séparateur au format français */
  number: (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)),

  /** Montant en USD avec `digits` décimales */
  usd: (n: number, digits = 4) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: digits,
    }).format(n),

  /**
   * Date courte pour l'axe X : "28 mai"
   * On reconstruit via les composantes locales pour éviter le décalage UTC.
   */
  dateShort: (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
    });
  },
};

export const Monitoring = () => {
  const { userData } = useUserStore();
/*   const [llmUsage, setLlmUsage] = useState<LlmUsage[]>([]);
  const [llmUsageLoading, setLlmUsageLoading] = useState(false);
  const [llmUsageError, setLlmUsageError] = useState("");
  const [llmUsageUpdatedAt, setLlmUsageUpdatedAt] = useState<Date | null>(null); */

  // Plage temporelle sélectionnée par l'utilisateur
  const [selectedDays, setSelectedDays] = useState<Days>(7);

  // Données "aujourd'hui" (live, rafraîchies toutes les 5 s)
  const [todayUsage, setTodayUsage] = useState<LlmUsage[]>([]);
  const [todayLoading, setTodayLoading] = useState(false);
  const [todayError, setTodayError] = useState("");
  const [todayUpdatedAt, setTodayUpdatedAt] = useState<Date | null>(null);

  // Historique sur la plage sélectionnée
  const [history, setHistory] = useState<DayEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  // Fetch snapshot live
  const fetchToday = useCallback(async () => {
    setTodayLoading(true);
    setTodayError("");
    try {
      const response = await fetchProxy("/api/llm/usage", {
        credentials: "include",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success)
        throw new Error(data?.message ?? `HTTP ${response.status}`);
      setTodayUsage(Array.isArray(data.usage) ? data.usage : []);
      setTodayUpdatedAt(new Date());
    } catch (error) {
      setTodayError(error instanceof Error ? error.message : String(error));
    } finally {
      setTodayLoading(false);
    }
  }, []);

  // Fetch historique
  const fetchHistory = useCallback(async (days: number) => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const response = await fetchProxy(`/api/llm/usage/history?days=${days}`, {
        credentials: "include",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success)
        throw new Error(data?.message ?? `HTTP ${response.status}`);
      setHistory(Array.isArray(data.history) ? data.history : []);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : String(error));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Polling live
  useEffect(() => {
    void fetchToday();
    const id = window.setInterval(() => void fetchToday(), LIVE_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [fetchToday]);

  // Rechargement à chaque changement de plage
  useEffect(() => {
    void fetchHistory(selectedDays);
  }, [selectedDays, fetchHistory]);

  /**
   * Liste des modèles présents dans l'historique.
   * Triée par ordre alphabétique.
   */
  const models = useMemo(() => {
    const seen = new Set<string>();
    history.forEach((d) => Object.keys(d.byModel).forEach((m) => seen.add(m)));
    return Array.from(seen).sort();
  }, [history]);

  /**
   * Format plat attendu par Recharts : un objet par jour avec une clé par modèle.
   * Ex : { date: "2025-05-28", "gpt-4o": 0.0012, "gpt-4o-mini": 0.0003 }
   */
  const chartData = useMemo(
    () =>
      history.map((day) => {
        const row: Record<string, string | number> = { date: day.date };
        models.forEach((m) => {
          row[m] = day.byModel[m]?.totalCostUsd ?? 0;
        });
        return row;
      }),
    [history, models],
  );

  /** KPIs agrégés sur toute la période sélectionnée */
  const periodTotals = useMemo(
    () =>
      history.reduce(
        (acc, day) => ({
          cost: acc.cost + day.totalCostUsd,
          tokens: acc.tokens + day.totalTokens,
          tokenInput: acc.tokenInput + day.tokenInput,
          tokenOutput: acc.tokenOutput + day.tokenOutput,
        }),
        { cost: 0, tokens: 0, tokenInput: 0, tokenOutput: 0 },
      ),
    [history],
  );

  /**
   * Calcul de l'intervalle de ticks sur l'axe X pour éviter la surcharge.
   * Cible ~7 labels visibles quelle que soit la plage choisie.
   */
  const xAxisInterval = Math.max(0, Math.floor(chartData.length / 7) - 1);

  /** Couleur d'un modèle, avec repli sur la palette de secours */
  const colorOf = (model: string, idx: number) =>
    MODEL_COLORS[model] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];

  // Redirection silencieuse si l'utilisateur n'est pas admin
  if (userData?.profile.role !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  const periodLabel =
    selectedDays === 1 ? "Aujourd'hui" : `${selectedDays} derniers jours`;

  return (
    <>
      <MainHeader />

      <div className="space-y-8 max-w-5xl min-h-[calc(100vh-64px)] mx-auto px-4 py-8">
        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Monitoring
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Consommation LLM — usage global de l'application
          </p>
        </div>

        {/* Sélecteur de plage temporelle */}
        <div className="flex flex-wrap gap-2">
          {TIME_RANGES.map(({ label, days }) => (
            <button
              key={days}
              onClick={() => setSelectedDays(days)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedDays === days
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Cartes KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Coût total"
            value={formating.usd(periodTotals.cost, 2)}
            sub={periodLabel}
          />
          <KpiCard
            label="Tokens total"
            value={formating.number(periodTotals.tokens)}
            sub="input + output"
          />
          <KpiCard
            label="Tokens input"
            value={formating.number(periodTotals.tokenInput)}
            sub="envoyés au modèle"
          />
          <KpiCard
            label="Tokens output"
            value={formating.number(periodTotals.tokenOutput)}
            sub="générés par le modèle"
          />
        </div>

        {/* Graphe en barres empilées */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-800">
            Coût LLM par jour{" "}
            <span className="font-normal text-gray-400 text-sm">
              — {periodLabel}
            </span>
          </h2>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            {historyLoading ? (
              <div className="h-64 flex items-center justify-center text-sm text-gray-400">
                Chargement…
              </div>
            ) : historyError ? (
              <div className="h-64 flex items-center justify-center text-sm text-red-400">
                Erreur : {historyError}
              </div>
            ) : chartData.length === 0 || models.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-gray-400">
                Aucune donnée LLM pour cette période.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={chartData}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#f0f0f0"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formating.dateShort}
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    interval={xAxisInterval}
                  />
                  <YAxis
                    // Affichage en dollars avec 3 décimales max sur l'axe
                    tickFormatter={(v: number) =>
                      v === 0 ? "$0" : `$${v.toFixed(3)}`
                    }
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    width={62}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formating.usd(value),
                      name,
                    ]}
                    labelFormatter={formating.dateShort}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      fontSize: 12,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />

                  {/* Une barre par modèle, toutes empilées (stackId identique)
                      pour visualiser à la fois le total du jour et la répartition */}
                  {models.map((model, idx) => (
                    <Bar
                      key={model}
                      dataKey={model}
                      stackId="cost"
                      fill={colorOf(model, idx)}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Tableau de détail — snapshot live du jour courant */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">
              Détail — jour courant
            </h2>
            {todayUpdatedAt && (
              <span className="text-xs text-gray-400">
                Actualisé à{" "}
                {todayUpdatedAt.toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* En-tête du tableau */}
            <div className="grid grid-cols-5 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span>Modèle</span>
              <span className="text-right">Total tokens</span>
              <span className="text-right">Input</span>
              <span className="text-right">Output</span>
              <span className="text-right">Coût USD</span>
            </div>

            {todayUsage.length > 0 ? (
              <>
                {todayUsage.map((u) => (
                  <div
                    key={u.model}
                    className="grid grid-cols-5 gap-2 px-4 py-3 border-b border-gray-100 last:border-b-0 text-sm text-gray-700"
                  >
                    {/* Pastille colorée + nom du modèle */}
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: MODEL_COLORS[u.model] ?? "#9ca3af",
                        }}
                      />
                      <span className="font-medium text-gray-900">
                        {u.model}
                      </span>
                    </div>
                    <span className="text-right tabular-nums">
                      {formating.number(u.totalTokens)}
                    </span>
                    <span className="text-right tabular-nums">
                      {formating.number(u.tokenInput)}
                    </span>
                    <span className="text-right tabular-nums">
                      {formating.number(u.tokenOutput)}
                    </span>
                    <span className="text-right tabular-nums">
                      {formating.usd(u.totalCostUsd)}
                    </span>
                  </div>
                ))}

                {/* Ligne de total — masquée si un seul modèle actif */}
                {todayUsage.length > 1 && (
                  <div className="grid grid-cols-5 gap-2 px-4 py-2.5 bg-gray-50 text-xs font-semibold text-gray-700 border-t border-gray-200">
                    <span>Total</span>
                    <span className="text-right tabular-nums">
                      {formating.number(
                        todayUsage.reduce((s, u) => s + u.totalTokens, 0),
                      )}
                    </span>
                    <span className="text-right tabular-nums">
                      {formating.number(
                        todayUsage.reduce((s, u) => s + u.tokenInput, 0),
                      )}
                    </span>
                    <span className="text-right tabular-nums">
                      {formating.number(
                        todayUsage.reduce((s, u) => s + u.tokenOutput, 0),
                      )}
                    </span>
                    <span className="text-right tabular-nums">
                      {formating.usd(
                        todayUsage.reduce((s, u) => s + u.totalCostUsd, 0),
                        4,
                      )}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="px-4 py-8 text-sm text-gray-400 text-center">
                {todayLoading
                  ? "Chargement…"
                  : todayError
                    ? `Erreur : ${todayError}`
                    : "Aucun usage LLM enregistré aujourd'hui."}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
};
