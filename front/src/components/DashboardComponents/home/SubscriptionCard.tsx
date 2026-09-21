import { Link } from "react-router-dom";
import { ArrowUpRight, Infinity as InfinityIcon, Lock } from "lucide-react";

import { SectionCard, SectionSkeleton } from "./SectionCard";
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
    valueClassName: "text-ink",
    barClassName: "bg-[linear-gradient(90deg,#2b4a76_0%,#4f82c6_100%)]",
    note: "", noteClassName: "",
  },
  warning: {
    valueClassName: "text-warning-dark",
    barClassName: "bg-[linear-gradient(90deg,#d97706_0%,#f0a93c_100%)]",
    note: "Bientôt épuisé", noteClassName: "text-warning-dark",
  },
  full: {
    valueClassName: "text-danger",
    barClassName: "bg-[linear-gradient(90deg,#dc2626_0%,#f0645f_100%)]",
    note: "Limite atteinte", noteClassName: "text-danger",
  },
  unlimited: {
    valueClassName: "text-success-dark",
    barClassName: "bg-[linear-gradient(90deg,#059669_0%,#34d399_100%)]",
    note: "", noteClassName: "",
  },
  disabled: {
    valueClassName: "text-ink-subtle",
    barClassName: "bg-line-emphasis",
    note: "", noteClassName: "",
  },
};

/**
 * Carte « Crédits » : formule en cours et consommation restante.
 *
 * Elle vit dans la colonne de droite de l'accueil : c'est une information de
 * pilotage, consultée d'un coup d'œil. Quand un quota est épuisé, un pied de
 * carte propose de changer de formule — c'est le seul moment où le bloc
 * réclame vraiment l'attention.
 */
export function SubscriptionCard({ planName, quotas, loading }: Props) {
  const hasReachedLimit = !loading && quotas.some((quota) => quota.state === "full");

  return (
    <SectionCard
      eyebrow="Abonnement"
      title="Vos crédits"
      headerRight={
        <span className="rounded-full border border-[#dfe4ef] bg-brand-light px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.1em] text-blue-primary">
          {loading ? "…" : planName}
        </span>
      }
    >
      {loading ? (
        <SectionSkeleton />
      ) : (
        <div className="flex flex-col gap-4 border-t border-line-subtle px-5 py-4">
          {quotas.map((quota) => <QuotaMeter key={quota.label} quota={quota} />)}
        </div>
      )}

      <div className="border-t border-line-subtle px-5 py-3">
        {hasReachedLimit ? (
          <div className="flex flex-col gap-2.5 rounded-xl bg-[#fffaf0] p-3">
            <span className="text-[12.5px] leading-snug text-ink-secondary">
              Vous avez atteint une limite de la formule {planName}. Passez à l'offre
              supérieure pour continuer sans interruption.
            </span>
            <Link
              to="/souscription"
              className="flex h-8 items-center justify-center gap-1.5 rounded-[10px] bg-blue-primary px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              Voir les offres
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <Link
            to="/souscription"
            className="group flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-blue-primary"
          >
            Gérer l'abonnement
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        )}
      </div>
    </SectionCard>
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
          {quota.state === "disabled" && <Lock className="h-3 w-3" />}
          {quota.text}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[#eef1f6]">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${style.barClassName}`}
          style={{ width: `${quota.percent}%` }}
        />
      </div>

      {style.note && (
        <span className={`text-[11px] font-medium ${style.noteClassName}`}>{style.note}</span>
      )}
    </div>
  );
}
