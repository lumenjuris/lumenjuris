import { useUserStore } from "../store/userStore";
import { useDashboardData } from "../components/DashboardComponents/home/useDashboardData";
import { InfoBanner } from "../components/DashboardComponents/home/InfoBanner";
import { HeroHeader } from "../components/DashboardComponents/home/HeroHeader";
import { OnboardingSteps } from "../components/DashboardComponents/home/OnboardingSteps";
import { UpcomingDeadlines } from "../components/DashboardComponents/home/UpcomingDeadlines";
import { TodayQueue } from "../components/DashboardComponents/home/TodayQueue";

/**
 * Page d'accueil (`/dashboard`).
 *
 * Compacte et organisée à l'horizontale : l'en-tête place la salutation à côté
 * des deux points d'entrée (générer / importer un contrat), la prise en main
 * s'affiche tant qu'elle n'est pas terminée, puis la file de travail et les
 * échéances sont côte à côte sur écran large.
 *
 * Toutes les données viennent d'un seul chargement (`useDashboardData`).
 */
export function Dashboard() {
  const firstName = useUserStore((s) => s.userData?.profile?.prenom) ?? "";
  const data = useDashboardData();

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4">
      <InfoBanner />

      <HeroHeader
        firstName={firstName}
        isEmpty={data.isEmpty}
        pendingActions={data.pendingActions}
        kpis={data.kpis}
        loading={data.loading}
      />

      {/* Le bloc de prise en main s'efface dès que les trois étapes sont faites. */}
      {!data.loading && !data.onboardingCompleted && (
        <OnboardingSteps steps={data.onboarding} loading={data.loading} />
      )}

      {/* Le titre « Lumen Juris » de bas de page a été retiré : le logo du menu
          suffit à situer l'utilisateur, la page d'accueil reste utilitaire. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <TodayQueue items={data.queue} loading={data.loading} />
        <UpcomingDeadlines items={data.deadlines} loading={data.loading} />
      </div>
    </div>
  );
}
