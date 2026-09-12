import { useUserStore } from "../store/userStore";
import { useDashboardData } from "../components/DashboardComponents/home/useDashboardData";
import { InfoBanner } from "../components/DashboardComponents/home/InfoBanner";
import { HeroHeader } from "../components/DashboardComponents/home/HeroHeader";
import { OnboardingSteps } from "../components/DashboardComponents/home/OnboardingSteps";
import { UpcomingDeadlines } from "../components/DashboardComponents/home/UpcomingDeadlines";
import { TodayQueue } from "../components/DashboardComponents/home/TodayQueue";
import { ModulesGrid } from "../components/DashboardComponents/home/ModulesGrid";
import { SubscriptionCard } from "../components/DashboardComponents/home/SubscriptionCard";

/**
 * Page d'accueil (`/dashboard`).
 *
 * Une seule colonne, lue de haut en bas : les deux points d'entrée de l'outil
 * (générer / importer un contrat), puis la prise en main tant qu'elle n'est pas
 * terminée, puis les deux informations réellement consultées au retour
 * (échéances et file de travail), puis l'accès aux modules et le suivi de
 * l'abonnement.
 *
 * Toutes les données viennent d'un seul chargement (`useDashboardData`).
 */
export function Dashboard() {
  const firstName = useUserStore((s) => s.userData?.profile?.prenom) ?? "";
  const data = useDashboardData();

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-5">
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

      <TodayQueue items={data.queue} loading={data.loading} />

      <UpcomingDeadlines items={data.deadlines} loading={data.loading} />

      <ModulesGrid counts={data.moduleCounts} />

      <SubscriptionCard
        planName={data.planName}
        quotas={data.quotas}
        loading={data.loading}
      />

      <p className="font-serif text-sm italic text-ink-muted">
        Lumen Juris — la clarté contractuelle, en continu.
      </p>
    </div>
  );
}
