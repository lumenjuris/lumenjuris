import { FileStack, AlarmClock, RefreshCw, CalendarOff } from "lucide-react";
import type { ContractStats } from "./types";

/** Bandeau des 4 KPI de la contrathèque. */
export function KpiBar({ stats, loading }: { stats: ContractStats | null; loading: boolean }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Kpi
        label="Total contrats"
        value={stats?.total}
        icon={FileStack}
        accent="#354F99"
        loading={loading}
      />
      <Kpi
        label="Échéance < 90 j"
        value={stats?.expiringIn90Days}
        icon={AlarmClock}
        accent="#d97706"
        loading={loading}
        alert={(stats?.expiringIn90Days ?? 0) > 0}
      />
      <Kpi
        label="Tacite reconduction"
        value={stats?.tacitRenewal}
        icon={RefreshCw}
        accent="#2563eb"
        loading={loading}
      />
      <Kpi
        label="Sans date de fin"
        value={stats?.withoutEndDate}
        icon={CalendarOff}
        accent="#6b7280"
        loading={loading}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  accent,
  loading,
  alert = false,
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  accent: string;
  loading: boolean;
  alert?: boolean;
}) {
  return (
    <div className="bg-white rounded-card border border-line shadow-card p-4 flex items-center gap-4">
      <div
        className="w-10 h-10 rounded-panel flex items-center justify-center shrink-0"
        style={{ backgroundColor: accent + "18" }}
      >
        <Icon className="w-5 h-5" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        {loading ? (
          <>
            <div className="h-6 w-12 rounded-md bg-surface-muted animate-pulse mb-1.5" />
            <div className="h-3 w-20 rounded bg-surface-muted animate-pulse" />
          </>
        ) : (
          <>
            <p className={`text-2xl font-bold tracking-tight ${alert && value ? "text-warning" : "text-ink"}`}>
              {value ?? 0}
            </p>
            <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest leading-tight mt-0.5">
              {label}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
