import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Upload } from "lucide-react";

import type { KpiCard } from "./types";

interface Props {
  firstName: string;
  /** Vrai tant que l'utilisateur n'a rien créé : le message d'accueil change. */
  isEmpty: boolean;
  /** Nombre d'éléments en attente, utilisé dans la phrase d'accroche. */
  pendingActions: number;
  kpis: KpiCard[];
  loading: boolean;
}


/**
 * En-tête de l'accueil : salutation, puis les deux points d'entrée principaux
 * de l'outil (générer / importer un contrat) présentés comme cartes d'action.
 *
 * Les compteurs restent affichés en bas de l'en-tête, en version compacte :
 * ce sont des repères, pas le sujet de la page.
 */
export function HeroHeader({ firstName, isEmpty, pendingActions, kpis, loading }: Props) {
  // Le prénom peut manquer (compte créé via OAuth sans profil complet).
  const greeting = isEmpty
    ? `Bienvenue${firstName ? `, ${firstName}` : ""}.`
    : `Bonjour${firstName ? ` ${firstName}` : ""}.`;

  let subline = "Commencez par un contrat : le suivi des échéances, des signatures et des risques se met en place ensuite tout seul.";
  if (!isEmpty) {
    subline = pendingActions > 0
      ? `${pendingActions} action${pendingActions > 1 ? "s vous attendent" : " vous attend"}. Reprenez où vous vous êtes arrêté.`
      : "Rien d'urgent aujourd'hui : tous vos contrats sont à jour.";
  }

  return (
    <div className="relative overflow-hidden rounded-[20px] bg-[linear-gradient(160deg,#223b5b_0%,#1b3049_100%)] shadow-[0_18px_44px_-22px_rgba(20,34,54,0.55)]">
      {/* Filet doré en haut de la carte */}
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(214,178,102,0.9)_0%,rgba(214,178,102,0.15)_34%,rgba(255,255,255,0)_70%)]" />

      {/* Sur écran large, la salutation et les deux actions tiennent sur une
          seule rangée : l'en-tête occupe deux fois moins de hauteur. */}
      <div className="relative flex flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="flex min-w-0 flex-col gap-1.5 lg:max-w-sm">
          <h1 className="font-serif text-2xl font-normal leading-tight tracking-tight text-white sm:text-[28px]">
            {greeting}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-white/60">{subline}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-2xl lg:flex-1">
          <PrimaryAction
            to="/contrat-generation?section=scratch"
            icon={Sparkles}
            title="Générer un contrat"
            description="Décrivez votre besoin, nous rédigeons la structure et les clauses."
            emphasis
          />
          <PrimaryAction
            to="/contrat-generation?section=import"
            icon={Upload}
            title="Importer un contrat"
            description="Reprenez un document existant : dates clés et risques sont extraits."
          />
        </div>
      </div>

      {!isEmpty && (
        <div className="relative flex flex-wrap gap-x-7 gap-y-3 border-t border-white/10 px-5 py-3.5 sm:px-7">
          {/* Un compteur à zéro n'apprend rien : on ne garde que ce qui existe. */}
          {kpis.filter((kpi) => !kpi.hideWhenZero || kpi.value > 0).map((kpi) => (
            <Link
              key={kpi.label}
              to={kpi.to}
              className="group flex items-baseline gap-2 transition-opacity hover:opacity-100 sm:opacity-90"
            >
              <span className="text-[15px] font-semibold tabular-nums text-white">
                {loading ? "—" : kpi.value}
              </span>
              <span className="text-xs text-white/50 group-hover:text-white/75">{kpi.label}</span>
              {kpi.hint && (
                <span className={`text-xs font-medium ${kpi.toneClassName}`}>{kpi.hint}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

interface ActionProps {
  to: string;
  icon: React.ElementType;
  title: string;
  description: string;
  /** L'action principale est en blanc plein, la seconde en carte translucide. */
  emphasis?: boolean;
}

/** Grande carte cliquable : c'est le point d'entrée mis en avant de la page. */
function PrimaryAction({ to, icon: Icon, title, description, emphasis }: ActionProps) {
  const cardStyle = emphasis
    ? "bg-white shadow-[0_10px_26px_-14px_rgba(0,0,0,0.6)] hover:bg-brand-light"
    : "border border-white/20 bg-white/[0.06] hover:border-white/35 hover:bg-white/[0.12]";
  const iconStyle = emphasis ? "bg-brand-light text-blue-primary" : "bg-white/10 text-white";
  const titleStyle = emphasis ? "text-[#1b3049]" : "text-white";
  const textStyle = emphasis ? "text-ink-muted" : "text-white/55";

  return (
    <Link
      to={to}
      className={`group flex items-start gap-3.5 rounded-2xl px-4 py-3 transition-colors ${cardStyle}`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconStyle}`}>
        <Icon className="h-[18px] w-[18px]" />
      </span>

      <div className="flex min-w-0 flex-col gap-1">
        <span className={`flex items-center gap-1.5 text-[15px] font-semibold ${titleStyle}`}>
          {title}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
        <span className={`text-[12.5px] leading-snug ${textStyle}`}>{description}</span>
      </div>
    </Link>
  );
}
