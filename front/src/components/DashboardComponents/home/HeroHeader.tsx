import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Upload } from "lucide-react";

import type { KpiCard } from "./types";
import { useAuthPanelStore } from "../../../store/authPanelStore";

interface Props {
  firstName: string;
  /** Vrai quand la page est consultée sans compte : on présente l'outil. */
  isGuest: boolean;
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
 * Les compteurs restent affichés en bas de l'en-tête, sous forme de pastilles
 * cliquables : ce sont des repères, pas le sujet de la page.
 */
export function HeroHeader({ firstName, isGuest, isEmpty, pendingActions, kpis, loading }: Props) {
  const ouvrirConnexion = useAuthPanelStore((state) => state.ouvrirConnexion);

  // Le prénom peut manquer (compte créé via OAuth sans profil complet).
  let greeting = isEmpty
    ? `Bienvenue${firstName ? `, ${firstName}` : ""}.`
    : `Bonjour${firstName ? ` ${firstName}` : ""}.`;

  let subline = "Commencez par un contrat : le suivi des échéances, des signatures et des risques se met en place ensuite tout seul.";
  if (!isEmpty) {
    subline = pendingActions > 0
      ? `${pendingActions} action${pendingActions > 1 ? "s vous attendent" : " vous attend"}. Reprenez où vous vous êtes arrêté.`
      : "Rien d'urgent aujourd'hui : tous vos contrats sont à jour.";
  }

  // Visiteur : pas de prénom ni de compteurs, on présente ce que fait l'outil.
  if (isGuest) {
    greeting = "Rédigez, négociez et faites signer vos contrats.";
    subline = "Découvrez l'outil librement. La création d'un compte vous sera demandée au moment d'enregistrer votre premier contrat.";
  }

  const visibleKpis = kpis.filter((kpi) => !kpi.hideWhenZero || kpi.value > 0);

  return (
    <div className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(150deg,#24405f_0%,#1b3049_55%,#16263a_100%)] shadow-[0_28px_60px_-30px_rgba(16,34,54,0.75)]">
      {/* Filet doré en haut de la carte */}
      <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,rgba(214,178,102,0.9)_0%,rgba(214,178,102,0.15)_34%,rgba(255,255,255,0)_70%)]" />
      {/* Halos décoratifs : ils donnent de la profondeur au fond uni. */}
      <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(97,146,214,0.35)_0%,rgba(97,146,214,0)_70%)]" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(214,178,102,0.18)_0%,rgba(214,178,102,0)_70%)]" />

      {/* Sur écran large, la salutation et les deux actions tiennent sur une
          seule rangée : l'en-tête occupe deux fois moins de hauteur. */}
      <div className="relative flex flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="flex min-w-0 flex-col gap-1.5 lg:max-w-sm">
          <h1 className="font-serif text-2xl font-normal leading-tight tracking-tight text-white sm:text-[28px]">
            {greeting}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-white/60">{subline}</p>

          {isGuest && (
            <button
              type="button"
              onClick={() => ouvrirConnexion()}
              className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-white/25 px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:border-white/50 hover:bg-white/10"
            >
              Se connecter ou créer un compte
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
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

      {/* Un compteur à zéro n'apprend rien : on ne garde que ce qui existe. */}
      {!isEmpty && visibleKpis.length > 0 && (
        <div className="relative flex flex-wrap gap-2 border-t border-white/10 px-6 py-4 sm:px-8">
          {visibleKpis.map((kpi) => (
            <Link
              key={kpi.label}
              to={kpi.to}
              className="group flex items-baseline gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 transition-colors hover:border-white/25 hover:bg-white/[0.12]"
            >
              <span className="text-[15px] font-semibold tabular-nums text-white">
                {loading ? "—" : kpi.value}
              </span>
              <span className="text-xs text-white/55 group-hover:text-white/80">{kpi.label}</span>
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
    ? "bg-white shadow-[0_14px_30px_-16px_rgba(0,0,0,0.7)] hover:bg-brand-light"
    : "border border-white/20 bg-white/[0.06] hover:border-white/35 hover:bg-white/[0.12]";
  const iconStyle = emphasis ? "bg-brand-light text-blue-primary" : "bg-white/10 text-white";
  const titleStyle = emphasis ? "text-[#1b3049]" : "text-white";
  const textStyle = emphasis ? "text-ink-muted" : "text-white/55";

  return (
    <Link
      to={to}
      className={`group flex items-start gap-3.5 rounded-2xl px-4 py-3 transition-colors ${cardStyle}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] ${iconStyle}`}>
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
