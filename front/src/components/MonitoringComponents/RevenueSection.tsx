import { useEffect, useState, useMemo } from "react";
import {
  TrendingUp,
  Users,
  CreditCard,
  Receipt,
  BadgeEuro,
  BarChart3,
  CalendarDays,
  Repeat,
  UserPlus,
  UserMinus,
  XCircle,
  Info,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { fetchProxy } from "../../utils/fetchProxy";

// ─── Types ─────────────────────────────────────────────────────────────────────

type RevenueUser = { idUser: number; email: string; nom: string | null; prenom: string | null };
type Plan = { idPlan: number; name: string; price: number; interval: string };
type Facture = { idFacture: number; price: number; stripeInvoiceId: string; status: string; createdAt: string };
type Subscription = {
  idSubscription: number;
  status: "ACTIVE" | "CANCELLED" | "EXPIRED" | "PENDING";
  startAt: string;
  expiresAt: string;
  user: RevenueUser;
  plan: Plan;
  facture: Facture[];
};

type RevenueKpis = {
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  mrr: number;
  mrrForecast: number;
  activeCount: number;
};

// Facture d'un achat unitaire (hors abonnement), ex : contrat sans filigrane
type OneShotFacture = Facture & { itemLabel: string; user: RevenueUser };

type RevenueData = {
  subscriptions: Subscription[];
  oneShotFactures?: OneShotFacture[];
  totalRevenue: number;
  activeCount: number;
  revenueByPlan: Record<string, { count: number; revenue: number }>;
  kpis?: RevenueKpis;
};

const STATUS_CONFIG = {
  ACTIVE: { label: "Actif", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
  CANCELLED: { label: "Annulé", bg: "bg-red-50", text: "text-red-600", border: "border-red-100" },
  EXPIRED: { label: "Expiré", bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200" },
  PENDING: { label: "En attente", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100" },
};

const fmt = {
  eur: (n: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n / 100),
  eurPrecise: (n: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n / 100),
  date: (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }),
};

// ─── Périodes & granularité ────────────────────────────────────────────────────

type PeriodPreset = "7d" | "30d" | "12m" | "custom";
type Granularity = "day" | "week" | "month";

const PERIOD_PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: "7d", label: "7 jours" },
  { id: "30d", label: "30 jours" },
  { id: "12m", label: "12 mois" },
  { id: "custom", label: "Personnalisé" },
];

// Ordre fixe : la couleur suit le plan (ordre alphabétique), jamais son rang.
const PLAN_COLORS = ["#6366f1", "#14b8a6", "#f59e0b", "#ec4899", "#8b5cf6", "#3b82f6"];

// Série du graphique regroupant tous les achats unitaires, toujours empilée en dernier
const ARTICLES_SERIES = "Ventes articles";
const ARTICLES_COLOR = "#10b981";

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Lundi de la semaine contenant la date (clé "YYYY-MM-DD"). */
function weekKey(d: Date): string {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = monday.getDay();
  monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day));
  return dayKey(monday);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function slotLabel(key: string, gran: Granularity): string {
  if (gran === "month") {
    return new Date(`${key}-01T00:00:00`).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
  }
  return new Date(`${key}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function slotTooltipLabel(key: string, gran: Granularity): string {
  if (gran === "month") {
    return new Date(`${key}-01T00:00:00`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }
  const d = new Date(`${key}T00:00:00`);
  if (gran === "week") {
    return "Semaine du " + d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  }
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// ─── Composants réutilisables ──────────────────────────────────────────────────

function KpiTile({ icon: Icon, label, value, sub, color, hint }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  color: string;
  /** Note explicative affichée au survol (icône ⓘ + tooltip natif). */
  hint?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-start gap-4" title={hint}>
      <div className={`rounded-lg p-2.5 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide flex items-center gap-1">
          {label}
          {hint && <Info className="w-3.5 h-3.5 text-gray-300 shrink-0 cursor-help" />}
        </p>
        <p className="mt-0.5 text-xl font-bold text-gray-900 tabular-nums truncate">{value}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
    </div>
  );
}

/** Badge Mensuel / Annuel affiché à côté du nom du plan. */
function IntervalBadge({ interval }: { interval: string }) {
  const isYear = interval === "yearly";
  return (
    <span
      className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${
        isYear
          ? "bg-violet-50 text-violet-700 border-violet-100"
          : "bg-sky-50 text-sky-600 border-sky-100"
      }`}
    >
      {isYear ? "Annuel" : "Mensuel"}
    </span>
  );
}

// ─── Section principale ────────────────────────────────────────────────────────

export function RevenueSection() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filtres de période du graphique / liste des ventes / KPIs de période
  const [preset, setPreset] = useState<PeriodPreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetchProxy("/api/admin/revenue", { credentials: "include" });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message ?? `HTTP ${res.status}`);
        setData(json.data as RevenueData);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  // Bornes de la période sélectionnée
  const range = useMemo(() => {
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (preset === "7d") {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 6);
      return { from, to: endOfToday };
    }
    if (preset === "30d") {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 29);
      return { from, to: endOfToday };
    }
    if (preset === "12m") {
      return { from: new Date(now.getFullYear(), now.getMonth() - 11, 1), to: endOfToday };
    }
    // Personnalisé — bornes par défaut : 30 derniers jours
    const from = customFrom
      ? new Date(`${customFrom}T00:00:00`)
      : (() => { const d = new Date(startOfToday); d.setDate(d.getDate() - 29); return d; })();
    const to = customTo ? new Date(`${customTo}T23:59:59.999`) : endOfToday;
    return { from, to: to >= from ? to : endOfToday };
  }, [preset, customFrom, customTo]);

  // Granularité automatique selon l'étendue de la période
  const granularity: Granularity = useMemo(() => {
    const spanDays = Math.ceil((range.to.getTime() - range.from.getTime()) / 86_400_000);
    if (spanDays <= 45) return "day";
    if (spanDays <= 200) return "week";
    return "month";
  }, [range]);

  // Toutes les factures aplaties (avec plan + client), triées récentes d'abord.
  // Les achats unitaires sont rangés dans la série « Ventes articles ».
  const allFactures = useMemo(() => {
    if (!data) return [];
    const subscriptionFactures = data.subscriptions.flatMap((s) =>
      s.facture.map((f) => ({
        ...f,
        plan: s.plan.name,
        planInterval: s.plan.interval as string | null,
        series: s.plan.name,
        user: s.user,
        date: new Date(f.createdAt),
      })),
    );
    const articleFactures = (data.oneShotFactures ?? []).map((f) => ({
      ...f,
      plan: f.itemLabel,
      planInterval: null, // un achat unitaire n'a pas d'intervalle
      series: ARTICLES_SERIES,
      date: new Date(f.createdAt),
    }));
    return [...subscriptionFactures, ...articleFactures]
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [data]);

  // Factures de la période sélectionnée
  const periodFactures = useMemo(
    () => allFactures.filter((f) => f.date >= range.from && f.date <= range.to),
    [allFactures, range],
  );

  // KPIs dépendants de la période
  const periodKpis = useMemo(() => {
    if (!data) return { newSubs: 0, endedSubs: 0, failedPayments: 0 };
    const newSubs = data.subscriptions.filter((s) => {
      const d = new Date(s.startAt);
      return d >= range.from && d <= range.to;
    }).length;
    // Approximation : date d'expiration des abonnements annulés/expirés
    // (le schéma ne stocke pas la date du clic de résiliation).
    const endedSubs = data.subscriptions.filter((s) => {
      if (s.status !== "CANCELLED" && s.status !== "EXPIRED") return false;
      const d = new Date(s.expiresAt);
      return d >= range.from && d <= range.to;
    }).length;
    const failedPayments = periodFactures.filter((f) => f.status === "FAILED").length;
    return { newSubs, endedSubs, failedPayments };
  }, [data, range, periodFactures]);

  // Données du graphique : paiements réussis de la période, empilés par plan
  const { chartData, planNames } = useMemo(() => {
    if (!data) return { chartData: [] as ({ slot: string } & Record<string, number | string>)[], planNames: [] as string[] };

    const paid = periodFactures.filter((f) => f.status !== "FAILED");
    // Ordre alphabétique fixe : la couleur d'un plan ne change pas selon la période.
    const plans = [...new Set(data.subscriptions.map((s) => s.plan.name))].sort((a, b) => a.localeCompare(b));
    if ((data.oneShotFactures ?? []).length > 0) plans.push(ARTICLES_SERIES);

    const keyOf = (d: Date) =>
      granularity === "month" ? monthKey(d) : granularity === "week" ? weekKey(d) : dayKey(d);

    const buckets = new Map<string, Record<string, number>>();
    for (const f of paid) {
      const k = keyOf(f.date);
      if (!buckets.has(k)) buckets.set(k, {});
      const b = buckets.get(k)!;
      b[f.series] = (b[f.series] ?? 0) + f.price;
    }

    // Slots continus sur toute la période (les creux restent visibles à zéro)
    const keys: string[] = [];
    if (granularity === "month") {
      const cur = new Date(range.from.getFullYear(), range.from.getMonth(), 1);
      while (cur <= range.to) {
        keys.push(monthKey(cur));
        cur.setMonth(cur.getMonth() + 1);
      }
    } else if (granularity === "week") {
      const cur = new Date(`${weekKey(range.from)}T00:00:00`);
      while (cur <= range.to) {
        keys.push(dayKey(cur));
        cur.setDate(cur.getDate() + 7);
      }
    } else {
      const cur = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate());
      while (cur <= range.to) {
        keys.push(dayKey(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }

    // 60 derniers slots max pour rester lisible
    const chart = keys.slice(-60).map((k) => ({ slot: k, ...(buckets.get(k) ?? {}) }));
    return { chartData: chart, planNames: plans };
  }, [data, periodFactures, granularity, range]);

  const periodRevenue = useMemo(
    () => periodFactures.filter((f) => f.status !== "FAILED").reduce((s, f) => s + f.price, 0),
    [periodFactures],
  );

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
        </div>
        <div className="h-48 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-400 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
        Erreur : {error}
      </div>
    );
  }

  if (!data) return null;

  const kpis = data.kpis;
  const mrrDelta = kpis ? kpis.mrrForecast - kpis.mrr : 0;

  return (
    <div className="space-y-8">

      {/* ── Cartes de synthèse : revenus ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiTile
          icon={BadgeEuro}
          label="Aujourd'hui"
          value={fmt.eur(kpis?.revenueToday ?? 0)}
          sub="paiements encaissés"
          color="bg-emerald-50 text-emerald-600"
        />
        <KpiTile
          icon={CalendarDays}
          label="Cette semaine"
          value={fmt.eur(kpis?.revenueWeek ?? 0)}
          sub="depuis lundi"
          color="bg-emerald-50 text-emerald-600"
        />
        <KpiTile
          icon={TrendingUp}
          label="Ce mois"
          value={fmt.eur(kpis?.revenueMonth ?? 0)}
          sub={new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          color="bg-emerald-50 text-emerald-600"
        />
      </div>

      {/* ── Cartes de synthèse : récurrence ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiTile
          icon={Repeat}
          label="MRR"
          value={`${fmt.eurPrecise(kpis?.mrr ?? 0)} /mois`}
          sub="revenu mensuel récurrent"
          color="bg-indigo-50 text-indigo-600"
          hint="Somme des abonnements actifs ramenés au mois : plan mensuel = prix du plan, plan annuel = prix ÷ 12."
        />
        <KpiTile
          icon={TrendingUp}
          label="Prévision MRR"
          value={`${fmt.eurPrecise(kpis?.mrrForecast ?? 0)} /mois`}
          sub={
            mrrDelta === 0
              ? "stable (hors renouvellements)"
              : `${mrrDelta > 0 ? "+" : ""}${fmt.eurPrecise(mrrDelta)} si aucun renouvellement`
          }
          color={mrrDelta < 0 ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"}
          hint="Plancher pessimiste : MRR du mois prochain si aucun abonnement n'est renouvelé et aucune nouvelle souscription. Seuls les abonnements actifs encore valides au 1er du mois prochain sont comptés — ceux qui expirent avant en sortent, d'où l'écart affiché."
        />
        <KpiTile
          icon={Users}
          label="Abonnements actifs"
          value={String(kpis?.activeCount ?? data.activeCount)}
          sub="en ce moment"
          color="bg-indigo-50 text-indigo-600"
        />
      </div>

      {/* ── Graphique + filtres de période ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            Évolution des revenus
            <span className="font-normal text-gray-400 text-sm">— {fmt.eur(periodRevenue)} sur la période</span>
            <span title="Le graphique et le total n'incluent que les paiements réussis — les tentatives échouées sont exclues." className="cursor-help inline-flex">
              <Info className="w-3.5 h-3.5 text-gray-300" />
            </span>
          </h2>
          {/* Presets de période */}
          <div className="flex gap-0.5 bg-white border border-gray-200 rounded-lg p-0.5">
            {PERIOD_PRESETS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setPreset(id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  preset === id
                    ? "bg-indigo-600 text-white"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Bornes personnalisées */}
        {preset === "custom" && (
          <div className="flex items-center gap-3 flex-wrap bg-white border border-gray-200 rounded-lg px-4 py-2.5 w-fit">
            <label className="flex items-center gap-2 text-xs text-gray-500">
              Du
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-500">
              au
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </label>
          </div>
        )}

        {/* KPIs de la période sélectionnée */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiTile
            icon={UserPlus}
            label="Nouveaux abonnements"
            value={String(periodKpis.newSubs)}
            sub="sur la période"
            color="bg-emerald-50 text-emerald-600"
            hint="Abonnements dont la date de début tombe dans la période sélectionnée ci-dessus."
          />
          <KpiTile
            icon={UserMinus}
            label="Résiliations"
            value={String(periodKpis.endedSubs)}
            sub="échéances sur la période (approx.)"
            color="bg-gray-50 text-gray-500"
            hint="Approximation : abonnements annulés ou expirés dont la date de fin tombe dans la période. La date exacte du clic de résiliation n'est pas stockée en base."
          />
          <KpiTile
            icon={XCircle}
            label="Paiements échoués"
            value={String(periodKpis.failedPayments)}
            sub="tentatives non abouties"
            color={periodKpis.failedPayments > 0 ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-500"}
            hint="Tentatives de paiement refusées par Stripe depuis l'écran de paiement. Montants non encaissés, exclus de tous les totaux de revenus."
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          {chartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Aucun paiement sur cette période.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="slot"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickFormatter={(v: string) => slotLabel(v, granularity)}
                  interval={Math.max(0, Math.floor(chartData.length / 8) - 1)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickFormatter={(v: number) => `${Math.round(v / 100)} €`}
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  labelFormatter={(v: string) => slotTooltipLabel(v, granularity)}
                  formatter={(value: number, name: string) => [fmt.eur(value), name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                {planNames.map((plan, i) => (
                  <Bar
                    key={plan}
                    dataKey={plan}
                    stackId="revenue"
                    fill={plan === ARTICLES_SERIES ? ARTICLES_COLOR : PLAN_COLORS[i % PLAN_COLORS.length]}
                    stroke="#ffffff"
                    strokeWidth={1}
                    radius={i === planNames.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ── Liste des ventes de la période ── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-800">
          Ventes de la période{" "}
          <span className="font-normal text-gray-400 text-sm">
            — {periodFactures.length} paiement{periodFactures.length > 1 ? "s" : ""}
          </span>
        </h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span className="col-span-3">Date</span>
            <span className="col-span-4">Client</span>
            <span className="col-span-2">Plan</span>
            <span className="col-span-2 text-right">Montant</span>
            <span className="col-span-1 text-right">Statut</span>
          </div>
          {periodFactures.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-400 text-center">Aucun paiement sur cette période.</div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {periodFactures.slice(0, 100).map((f) => {
                const name = [f.user.prenom, f.user.nom].filter(Boolean).join(" ") || f.user.email;
                const failed = f.status === "FAILED";
                return (
                  <div key={f.idFacture} className="grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm hover:bg-gray-50/50">
                    <div className="col-span-3 flex items-center gap-1.5 text-gray-500 text-xs">
                      <Receipt className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      {fmt.date(f.createdAt)}
                    </div>
                    <div className="col-span-4 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{name}</p>
                      <p className="text-xs text-gray-400 truncate">{f.user.email}</p>
                    </div>
                    <div className="col-span-2 flex items-center gap-1.5 min-w-0">
                      <CreditCard className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      <span className="text-gray-700 truncate">{f.plan}</span>
                      {f.planInterval ? (
                        <IntervalBadge interval={f.planInterval} />
                      ) : (
                        <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap bg-emerald-50 text-emerald-700 border-emerald-100">
                          Article
                        </span>
                      )}
                    </div>
                    <span className={`col-span-2 text-right font-semibold tabular-nums ${failed ? "text-gray-400 line-through" : "text-emerald-700"}`}>
                      {fmt.eur(f.price)}
                    </span>
                    <span className="col-span-1 text-right">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        failed
                          ? "bg-red-50 text-red-600 border-red-100"
                          : "bg-emerald-50 text-emerald-700 border-emerald-100"
                      }`}>
                        {failed ? "Échoué" : "Payé"}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Breakdown par plan ── */}
      {Object.keys(data.revenueByPlan).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-800">Répartition par plan</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(data.revenueByPlan).map(([plan, stats]) => (
              <div key={plan} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-gray-800">{plan}</p>
                <p className="text-lg font-bold text-gray-900 tabular-nums mt-0.5">{fmt.eur(stats.revenue)}</p>
                <p className="text-xs text-gray-400">{stats.count} actif{stats.count > 1 ? "s" : ""}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Liste des abonnements ── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-800">
          Tous les abonnements{" "}
          <span className="font-normal text-gray-400 text-sm">— {data.subscriptions.length} au total</span>
        </h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span className="col-span-3">Utilisateur</span>
            <span className="col-span-3">Plan</span>
            <span className="col-span-2">Statut</span>
            <span className="col-span-2">Période</span>
            <span className="col-span-2 text-right">Payé</span>
          </div>
          {data.subscriptions.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-400 text-center">Aucun abonnement.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data.subscriptions.map((sub) => {
                const st = STATUS_CONFIG[sub.status];
                const name = [sub.user.prenom, sub.user.nom].filter(Boolean).join(" ") || sub.user.email;
                const paid = sub.facture.filter((f) => f.status !== "FAILED").reduce((s, f) => s + f.price, 0);
                return (
                  <div key={sub.idSubscription} className="grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm hover:bg-gray-50/50">
                    <div className="col-span-3 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{name}</p>
                      <p className="text-xs text-gray-400 truncate">{sub.user.email}</p>
                    </div>
                    <div className="col-span-3 flex items-center gap-1.5 min-w-0">
                      <span className="text-gray-700 font-medium truncate">{sub.plan.name}</span>
                      <IntervalBadge interval={sub.plan.interval} />
                    </div>
                    <span className="col-span-2">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.bg} ${st.text} ${st.border}`}>
                        {st.label}
                      </span>
                    </span>
                    <div className="col-span-2 text-xs text-gray-500 leading-tight">
                      <p>{fmt.date(sub.startAt)}</p>
                      <p className="text-gray-400">→ {fmt.date(sub.expiresAt)}</p>
                    </div>
                    <span className="col-span-2 text-right font-semibold text-gray-800 tabular-nums">
                      {fmt.eur(paid)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
