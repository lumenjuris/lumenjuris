import { Link } from "react-router-dom";

import type { QuotaBar } from "./types";

interface Props {
  planName: string;
  quotas: QuotaBar[];
  loading: boolean;
}

/**
 * Bloc « Votre abonnement » : formule en cours et consommation des quotas
 * (contrats suivis, analyses, signatures avancées).
 */
export function PlanCard({ planName, quotas, loading }: Props) {
  return (
    <section className="flex flex-col gap-3.5 rounded-2xl border border-[#e8eaf0] bg-white p-4 shadow-card">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-lg font-normal text-ink">Votre abonnement</h2>
        <span className="text-2xs font-semibold uppercase tracking-[0.09em] text-blue-primary">
          {loading ? "…" : planName}
        </span>
      </div>

      {quotas.map((quota) => (
        <div key={quota.label} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[12.5px] text-ink-muted">{quota.label}</span>
            <span className="text-[12.5px] font-semibold tabular-nums text-ink">
              {loading ? "—" : quota.text}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line-subtle">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${quota.barClassName}`}
              style={{ width: `${loading ? 0 : quota.percent}%` }}
            />
          </div>
        </div>
      ))}

      <Link to="/souscription" className="text-[12.5px] font-semibold text-blue-primary hover:underline">
        Voir les abonnements
      </Link>
    </section>
  );
}
