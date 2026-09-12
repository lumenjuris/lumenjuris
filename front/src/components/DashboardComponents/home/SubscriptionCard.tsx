import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Infinity as InfinityIcon } from "lucide-react";

import type { QuotaBar, QuotaState } from "./types";

interface Props {
  planName: string;
  quotas: QuotaBar[];
  loading: boolean;
}

/** Habillage de chaque état de jauge : couleur du chiffre, de la barre, et note. */
const STATE_STYLE: Record<QuotaState, {
  valueClassName: string;
  barClassName: string;
  note: string;
  noteClassName: string;
}> = {
  ok: {
    valueClassName: "text-ink", barClassName: "bg-blue-primary",
    note: "", noteClassName: "",
  },
  warning: {
    valueClassName: "text-warning-dark", barClassName: "bg-warning",
    note: "Bientôt épuisé", noteClassName: "text-warning-dark",
  },
  full: {
    valueClassName: "text-danger", barClassName: "bg-danger",
    note: "Limite atteinte", noteClassName: "text-danger",
  },
  unlimited: {
    valueClassName: "text-success-dark", barClassName: "bg-success",
    note: "", noteClassName: "",
  },
  disabled: {
    valueClassName: "text-ink-subtle", barClassName: "bg-line-emphasis",
    note: "", noteClassName: "",
  },
};

/**
 * Carte « Votre abonnement » : formule en cours et consommation des quotas.
 *
 * Elle reste en bas de l'accueil, après les modules : c'est une information de
 * pilotage, consultée ponctuellement. Quand un quota est épuisé, un pied de
 * carte propose de changer de formule — c'est le seul moment où le bloc
 * réclame vraiment l'attention.
 */
export function SubscriptionCard({ planName, quotas, loading }: Props) {
  const hasReachedLimit = !loading && quotas.some((quota) => quota.state === "full");

  return (
    <section className="overflow-hidden rounded-2xl border border-[#e8eaf0] bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2.5">
          <h2 className="font-serif text-[19px] font-normal text-ink">Votre abonnement</h2>
          <span className="rounded-full border border-[#dfe4ef] bg-brand-light px-2.5 py-0.5 text-2xs font-semibold uppercase tracking-[0.09em] text-blue-primary">
            {loading ? "…" : planName}
          </span>
        </div>

        <Link
          to="/souscription"
          className="flex items-center gap-1.5 text-[12.5px] font-semibold text-blue-primary hover:underline"
        >
          Gérer l'abonnement
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-x-7 gap-y-4 border-t border-line-subtle px-4 py-4 sm:grid-cols-3">
        {loading
          ? [0, 1, 2].map((row) => (
              <div key={row} className="h-9 animate-pulse rounded-lg bg-surface-subtle" />
            ))
          : quotas.map((quota) => <QuotaMeter key={quota.label} quota={quota} />)}
      </div>

      {hasReachedLimit && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line-subtle bg-[#fffaf0] px-4 py-3">
          <span className="text-[12.5px] leading-snug text-ink-secondary">
            Vous avez atteint une limite de la formule {planName}. Passez à l'offre
            supérieure pour continuer sans interruption.
          </span>
          <Link
            to="/souscription"
            className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[9px] bg-blue-primary px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            Voir les offres
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </section>
  );
}

/** Une jauge : libellé, consommation, barre de remplissage et note éventuelle. */
function QuotaMeter({ quota }: { quota: QuotaBar }) {
  const style = STATE_STYLE[quota.state];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] text-ink-muted">{quota.label}</span>
        <span className={`flex items-center gap-1 text-[12.5px] font-semibold tabular-nums ${style.valueClassName}`}>
          {quota.state === "unlimited" && <InfinityIcon className="h-3.5 w-3.5" />}
          {quota.text}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-line-subtle">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${style.barClassName}`}
          style={{ width: `${quota.percent}%` }}
        />
      </div>

      {style.note && (
        <span className={`text-[11px] font-medium ${style.noteClassName}`}>{style.note}</span>
      )}
    </div>
  );
}
