import { useState, useEffect, useMemo } from "react";
import { fetchProxy } from "../../utils/fetchProxy";
import { readQuotaValue, type PlanQuotas } from "../../types/quotas";
import {
  Users,
  UserCheck,
  TrendingUp,
  AlertTriangle,
  CreditCard,
  DollarSign,
  Activity,
  Zap,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type OverviewData = {
  users: { total: number; verified: number; active: { d1: number; d7: number; d30: number } };
  conversion: { withActiveSub: number; total: number; rate: number };
  costAlert: { todayUsd: number; threshold: number; exceeded: boolean };
  credits: CreditRow[];
};

type CreditRow = {
  userId: number;
  email: string;
  nom: string | null;
  prenom: string | null;
  quotas: PlanQuotas;
  planQuotas: PlanQuotas | null;
};

/**
 * Métrique représentative pour le monitoring : le quota "analyzer" (le principal
 * consommable). Renvoie le restant, le plein et si c'est illimité.
 * NB : vue de synthèse — le détail par feature reste consultable ailleurs.
 */
function analyzerMetric(row: CreditRow): {
  unlimited: boolean;
  remaining: number | null;
  full: number | null;
} {
  const rem = readQuotaValue(row.quotas?.analyzer);
  const full = readQuotaValue(row.planQuotas?.analyzer);
  return {
    unlimited: rem.kind === "unlimited",
    remaining: rem.kind === "finite" ? rem.value : null,
    full: full.kind === "finite" ? full.value : null,
  };
}

type LlmUserUsage = {
  userId: number;
  email: string;
  nom: string | null;
  prenom: string | null;
  model: string;
  totalCostUsd: number;
  tokenInput: number;
  tokenOutput: number;
};

// ─── Composant principal ───────────────────────────────────────────────────────

export function OverviewSection() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [llmUsers, setLlmUsers] = useState<LlmUserUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        const [overviewRes, llmRes] = await Promise.all([
          fetchProxy("/api/admin/overview", { credentials: "include" }),
          fetchProxy("/api/llm/usage/users", { credentials: "include" }),
        ]);
        const overview = await overviewRes.json() as { success: boolean; data?: OverviewData; message?: string };
        const llm = await llmRes.json() as { success: boolean; usage?: LlmUserUsage[] };
        if (cancelled) return;
        if (!overview.success) throw new Error(overview.message ?? "Erreur serveur");
        setData(overview.data ?? null);
        if (llm.success) setLlmUsers(llm.usage ?? []);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadData();
    return () => { cancelled = true; };
  }, []);

  // Consolidation des top LLM users (un user peut avoir plusieurs modèles)
  const topLlmUsers = useMemo(() => {
    const byUser = new Map<number, { email: string; nom: string | null; prenom: string | null; totalCostUsd: number; tokens: number }>();
    for (const r of llmUsers) {
      const existing = byUser.get(r.userId);
      if (existing) {
        existing.totalCostUsd += r.totalCostUsd;
        existing.tokens += r.tokenInput + r.tokenOutput;
      } else {
        byUser.set(r.userId, {
          email: r.email, nom: r.nom, prenom: r.prenom,
          totalCostUsd: r.totalCostUsd,
          tokens: r.tokenInput + r.tokenOutput,
        });
      }
    }
    return [...byUser.entries()]
      .sort(([, a], [, b]) => b.totalCostUsd - a.totalCostUsd)
      .slice(0, 10)
      .map(([userId, u]) => ({ userId, ...u }));
  }, [llmUsers]);

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl p-4">
      Erreur : {error}
    </div>
  );

  if (!data) return null;

  const { users, conversion, costAlert, credits } = data;
  const exhaustedUsers = credits.filter((c) => analyzerMetric(c).remaining === 0);
  const lowUsers = credits.filter((c) => {
    const m = analyzerMetric(c);
    return (
      m.remaining !== null &&
      m.remaining > 0 &&
      m.full !== null &&
      m.full > 0 &&
      m.remaining / m.full < 0.2
    );
  });

  return (
    <div className="space-y-6">

      {/* Alerte coût */}
      {costAlert.exceeded && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-semibold text-amber-800">Alerte coût LLM</span>
            <span className="text-amber-700 ml-1">
              — Dépense aujourd'hui&nbsp;:&nbsp;
              <span className="font-semibold">${costAlert.todayUsd.toFixed(4)}</span>
              &nbsp;(seuil&nbsp;: ${costAlert.threshold.toFixed(2)})
            </span>
          </div>
        </div>
      )}

      {/* KPI tiles — utilisateurs & conversion */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiTile icon={<Users className="w-4 h-4" />} label="Inscrits" value={users.total} />
        <KpiTile icon={<UserCheck className="w-4 h-4" />} label="Vérifiés" value={users.verified} />
        <KpiTile icon={<Activity className="w-4 h-4" />} label="Actifs J-1" value={users.active.d1} sub="(IA)" />
        <KpiTile icon={<Activity className="w-4 h-4" />} label="Actifs J-7" value={users.active.d7} sub="(IA)" />
        <KpiTile icon={<Activity className="w-4 h-4" />} label="Actifs J-30" value={users.active.d30} sub="(IA)" />
        <KpiTile icon={<TrendingUp className="w-4 h-4" />} label="Conversion" value={`${conversion.rate}%`} sub={`${conversion.withActiveSub}/${conversion.total} abonnés payants`} accent />
      </div>

      {/* Coût LLM du jour */}
      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${costAlert.exceeded ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`}>
        <DollarSign className={`w-4 h-4 flex-shrink-0 ${costAlert.exceeded ? "text-amber-500" : "text-gray-400"}`} />
        <span className="text-sm text-gray-600">Coût LLM aujourd'hui :</span>
        <span className={`text-sm font-semibold ${costAlert.exceeded ? "text-amber-700" : "text-gray-900"}`}>
          ${costAlert.todayUsd.toFixed(4)}
        </span>
        <span className="text-xs text-gray-400 ml-auto">seuil : ${costAlert.threshold.toFixed(2)}</span>
      </div>

      {/* Deux colonnes : top LLM users + résumé crédits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top LLM users aujourd'hui */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-gray-700">Top consommateurs LLM (30 derniers jours)</h3>
          </div>
          {topLlmUsers.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-gray-400">Aucune consommation sur les 30 derniers jours.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-400 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Utilisateur</th>
                  <th className="px-4 py-2 text-right">Coût</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topLlmUsers.map((u, idx) => {
                  const name = [u.prenom, u.nom].filter(Boolean).join(" ") || u.email.split("@")[0];
                  const initials = (`${u.prenom?.[0] ?? ""}${u.nom?.[0] ?? ""}`.toUpperCase() || u.email[0]?.toUpperCase()) ?? "?";
                  return (
                    <tr key={u.userId} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2 text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate text-xs">{name}</p>
                            <p className="text-xs text-gray-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className="font-semibold text-gray-900">${u.totalCostUsd.toFixed(4)}</span>
                        <p className="text-xs text-gray-400">{u.tokens.toLocaleString("fr-FR")} tokens</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Suivi des crédits */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-gray-700">Suivi des crédits</h3>
            {(exhaustedUsers.length > 0 || lowUsers.length > 0) && (
              <span className="ml-auto flex items-center gap-1 text-xs text-amber-600 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                {exhaustedUsers.length > 0 && `${exhaustedUsers.length} épuisé${exhaustedUsers.length > 1 ? "s" : ""}`}
                {exhaustedUsers.length > 0 && lowUsers.length > 0 && " · "}
                {lowUsers.length > 0 && `${lowUsers.length} faible${lowUsers.length > 1 ? "s" : ""}`}
              </span>
            )}
          </div>
          {credits.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-gray-400">Aucun compte avec crédits.</p>
          ) : (
            <div className="overflow-y-auto max-h-72">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-400 uppercase font-semibold sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left">Utilisateur</th>
                    <th className="px-4 py-2 text-right">Analyses</th>
                    <th className="px-4 py-2 text-left w-20">État</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {credits.map((c) => {
                    const name = [c.prenom, c.nom].filter(Boolean).join(" ") || c.email.split("@")[0];
                    const m = analyzerMetric(c);
                    const pct =
                      m.full !== null && m.full > 0 && m.remaining !== null
                        ? Math.min((m.remaining / m.full) * 100, 100)
                        : null;
                    const isExhausted = m.remaining === 0;
                    const isLow = !isExhausted && pct !== null && pct < 20;
                    return (
                      <tr key={c.userId} className={`${isExhausted ? "bg-red-50/30" : isLow ? "bg-amber-50/30" : ""} hover:bg-gray-50/50`}>
                        <td className="px-4 py-2">
                          <p className="font-medium text-gray-800 truncate text-xs">{name}</p>
                          <p className="text-xs text-gray-400 truncate">{c.email}</p>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <span className={`font-semibold text-xs ${isExhausted ? "text-red-600" : isLow ? "text-amber-600" : "text-gray-900"}`}>
                            {m.unlimited ? "∞" : (m.remaining ?? 0).toLocaleString("fr-FR")}
                          </span>
                          {!m.unlimited && m.full !== null && m.full > 0 && (
                            <p className="text-xs text-gray-400">/ {m.full.toLocaleString("fr-FR")}</p>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {isExhausted ? (
                            <span className="text-xs font-medium text-red-600">Épuisé</span>
                          ) : isLow ? (
                            <div className="space-y-0.5">
                              <span className="text-xs font-medium text-amber-600">Faible</span>
                              {pct !== null && (
                                <div className="h-1 w-12 bg-gray-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              {pct !== null && (
                                <>
                                  <span className="text-xs text-gray-400">{Math.round(pct)}%</span>
                                  <div className="h-1 w-12 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function KpiTile({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "bg-indigo-50 border-indigo-200" : "bg-white border-gray-200"}`}>
      <div className={`flex items-center gap-1.5 text-xs font-medium mb-1.5 ${accent ? "text-indigo-600" : "text-gray-500"}`}>
        {icon}
        {label}
      </div>
      <p className={`text-lg font-bold ${accent ? "text-indigo-700" : "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}
