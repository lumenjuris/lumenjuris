import { useUserStore } from "../store/userStore";
import { useDashboardData } from "../components/DashboardComponents/home/useDashboardData";
import { InfoBanner } from "../components/DashboardComponents/home/InfoBanner";
import { HeroHeader } from "../components/DashboardComponents/home/HeroHeader";
import { OnboardingSteps } from "../components/DashboardComponents/home/OnboardingSteps";
import { UpcomingDeadlines } from "../components/DashboardComponents/home/UpcomingDeadlines";
import { TodayQueue } from "../components/DashboardComponents/home/TodayQueue";
import { SubscriptionCard } from "../components/DashboardComponents/home/SubscriptionCard";

/**
 * Page d'accueil (`/dashboard`).
 *
 * L'en-tête occupe toute la largeur : il porte les deux points d'entrée de
 * l'outil (générer / importer un contrat). En dessous, deux colonnes :
 *   - à gauche, ce sur quoi on travaille (prise en main, file « À traiter ») ;
 *   - à droite, ce qu'on consulte d'un coup d'œil (échéances, crédits).
 *
 * La colonne de droite passe sous la principale en dessous de `xl` : le menu
 * latéral mange déjà de la largeur sur les écrans intermédiaires.
 *
 * Toutes les données viennent d'un seul chargement (`useDashboardData`).
 */
export function Dashboard() {
  const firstName = useUserStore((s) => s.userData?.profile?.prenom) ?? "";
  const data = useDashboardData();

  return (
    <div className="relative mx-auto flex w-full max-w-[1240px] flex-col gap-5">
      {/* Halo très léger derrière le contenu, pour décoller la page du fond uni. */}
      <div className="pointer-events-none absolute -top-16 left-1/2 -z-10 h-72 w-[680px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(76,124,192,0.10)_0%,rgba(76,124,192,0)_70%)]" />

      <InfoBanner />

      <HeroHeader
        firstName={firstName}
        isEmpty={data.isEmpty}
        pendingActions={data.pendingActions}
        kpis={data.kpis}
        loading={data.loading}
      />

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          {/* Le bloc de prise en main s'efface dès que les trois étapes sont faites. */}
          {!data.loading && !data.onboardingCompleted && (
            <OnboardingSteps steps={data.onboarding} loading={data.loading} />
          )}

          <TodayQueue items={data.queue} loading={data.loading} />
        </div>

        <div className="flex flex-col gap-5">
          <UpcomingDeadlines items={data.deadlines} loading={data.loading} />

          <SubscriptionCard
            planName={data.planName}
            quotas={data.quotas}
            loading={data.loading}
          />
        </div>
      </div>

      <p className="font-serif text-sm italic text-ink-muted">
        Lumen Juris — Metre à lumière le juridique.
      </p>
    </div>
  );
}
