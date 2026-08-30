import { Link } from "react-router-dom";

import type { RiskAlert } from "./types";

interface Props {
  alerts: RiskAlert[];
  loading: boolean;
}

/**
 * Bloc « Risques & conformité » : points de vigilance déduits des contrats
 * suivis (échéances dépassées, tacites reconductions, négociations bloquées).
 */
export function RiskPanel({ alerts, loading }: Props) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#e8eaf0] bg-white shadow-card">
      <div className="flex items-baseline justify-between px-4 pb-3 pt-3.5">
        <h2 className="font-serif text-lg font-normal text-ink">Risques &amp; conformité</h2>
        <span className={`text-2xs font-semibold uppercase tracking-[0.07em] ${alerts.length > 0 ? "text-red-primary" : "text-success"}`}>
          {loading ? "…" : alerts.length > 0 ? `${alerts.length} alertes` : "À jour"}
        </span>
      </div>

      {!loading && alerts.length > 0 && (
        <div className="flex flex-col border-t border-line-subtle">
          {alerts.map((alert) => (
            <Link
              key={alert.key}
              to={alert.to}
              className="flex gap-3 border-b border-line-subtle px-4 py-3 transition-colors hover:bg-[#fafbfd]"
            >
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  alert.level === "high"
                    ? "bg-red-primary shadow-[0_0_0_3px_#fde0e2]"
                    : "bg-warning shadow-[0_0_0_3px_#fdf0d5]"
                }`}
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-ink">{alert.title}</span>
                <span className="text-xs leading-snug text-ink-muted">{alert.detail}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && alerts.length === 0 && (
        <div className="flex flex-col items-center gap-1 border-t border-line-subtle px-4 py-6 text-center">
          <span className="text-[13px] font-semibold text-ink-secondary">Rien à signaler</span>
          <span className="text-xs text-ink-subtle">
            Les points de vigilance apparaissent dès votre premier contrat suivi.
          </span>
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-2.5 border-t border-line-subtle px-4 py-5">
          {[0, 1].map((row) => (
            <div key={row} className="h-8 animate-pulse rounded-lg bg-surface-subtle" />
          ))}
        </div>
      )}
    </section>
  );
}
