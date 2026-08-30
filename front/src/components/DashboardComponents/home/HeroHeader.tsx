import { Link } from "react-router-dom";
import { Sparkles, Upload } from "lucide-react";

import type { KpiCard } from "./types";

interface Props {
  firstName: string;
  /** Vrai tant que l'utilisateur n'a rien créé : le message d'accueil change. */
  isEmpty: boolean;
  kpis: KpiCard[];
  loading: boolean;
}

/** « Dimanche 30 août 2026 », avec une majuscule initiale. */
function formatToday(): string {
  const label = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * En-tête de l'accueil : salutation, actions principales et bandeau des 4 KPI.
 */
export function HeroHeader({ firstName, isEmpty, kpis, loading }: Props) {
  const pendingActions = kpis
    .filter((kpi) => kpi.label !== "Contrats suivis")
    .reduce((sum, kpi) => sum + kpi.value, 0);

  // Le prénom peut manquer (compte créé via OAuth sans profil complet).
  const greeting = isEmpty
    ? `Bienvenue${firstName ? `, ${firstName}` : ""}.`
    : `Bonjour${firstName ? ` ${firstName}` : ""}.`;

  let subline = "Votre espace est prêt. Générez un premier contrat pour activer le suivi des échéances, des signatures et des risques.";
  if (!isEmpty) {
    subline = pendingActions > 0
      ? `${pendingActions} action${pendingActions > 1 ? "s" : ""} vous attendent. Reprenez où vous vous êtes arrêté.`
      : "Rien d'urgent aujourd'hui : tous vos contrats sont à jour.";
  }

  return (
    <div className="relative overflow-hidden rounded-[20px] bg-[linear-gradient(160deg,#223b5b_0%,#1b3049_100%)] shadow-[0_18px_44px_-22px_rgba(20,34,54,0.55)]">
      {/* Filet doré en haut de la carte */}
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(214,178,102,0.9)_0%,rgba(214,178,102,0.15)_34%,rgba(255,255,255,0)_70%)]" />

      <div className="relative grid grid-cols-1 items-end gap-6 px-5 pt-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d6b266]" />
            <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-white/50">
              {formatToday()}
            </span>
          </div>
          <h1 className="font-serif text-3xl font-normal leading-tight tracking-tight text-white sm:text-[38px]">
            {greeting}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-white/60">{subline}</p>
        </div>

        <div className="flex items-center gap-2 pb-1">
          <Link
            to="/contrat-generation?section=import"
            className="flex h-10 items-center gap-2 rounded-[10px] border border-white/20 bg-white/5 px-4 text-[13px] font-medium text-white/90 transition-colors hover:border-white/30 hover:bg-white/10"
          >
            <Upload className="h-[15px] w-[15px]" />
            <span className="whitespace-nowrap">Importer</span>
          </Link>
          <Link
            to="/contrat-generation?section=scratch"
            className="flex h-10 items-center gap-2 rounded-[10px] bg-white px-4 text-[13px] font-semibold text-[#1b3049] shadow-[0_6px_18px_-8px_rgba(0,0,0,0.5)] transition-colors hover:bg-brand-light"
          >
            <Sparkles className="h-[15px] w-[15px]" />
            <span className="whitespace-nowrap">Générer un contrat</span>
          </Link>
        </div>
      </div>

      <div className="relative mt-6 grid grid-cols-2 border-t border-white/10 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            to={kpi.to}
            className="flex flex-col gap-2 border-l border-white/10 px-5 pb-[18px] pt-4 transition-colors hover:bg-white/5"
          >
            <span className="text-2xs font-semibold uppercase tracking-[0.11em] text-white/45">
              {kpi.label}
            </span>
            <div className="flex items-baseline gap-2.5">
              <span className="font-serif text-[34px] font-normal leading-none tabular-nums text-white">
                {loading ? "—" : String(kpi.value).padStart(2, "0")}
              </span>
              <span className={`text-xs font-medium ${kpi.toneClassName}`}>{kpi.hint}</span>
            </div>
            <div className="mt-0.5 h-0.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${kpi.barClassName}`}
                style={{ width: `${loading ? 0 : kpi.barPercent}%` }}
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
