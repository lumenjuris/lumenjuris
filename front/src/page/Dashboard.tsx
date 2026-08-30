import { useUserStore } from "../store/userStore";
import { useDashboardData } from "../components/DashboardComponents/home/useDashboardData";
import { InfoBanner } from "../components/DashboardComponents/home/InfoBanner";
import { HeroHeader } from "../components/DashboardComponents/home/HeroHeader";
import { TodayQueue } from "../components/DashboardComponents/home/TodayQueue";
import { UpcomingDeadlines } from "../components/DashboardComponents/home/UpcomingDeadlines";
import { ModulesGrid } from "../components/DashboardComponents/home/ModulesGrid";
import { QuickGenerateCard } from "../components/DashboardComponents/home/QuickGenerateCard";
import { RiskPanel } from "../components/DashboardComponents/home/RiskPanel";
import { PlanCard } from "../components/DashboardComponents/home/PlanCard";

/**
 * Page d'accueil (`/dashboard`).
 *
 * Assemble les blocs de `components/DashboardComponents/home` autour d'un seul
 * chargement de données (`useDashboardData`) :
 *   - colonne principale : file de travail, échéances, modules
 *   - colonne latérale   : génération rapide, risques, abonnement
 */
export function Dashboard() {
  const firstName = useUserStore((s) => s.userData?.profile?.prenom) ?? "";
  const data = useDashboardData();

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5">
      <InfoBanner />

      <HeroHeader
        firstName={firstName}
        isEmpty={data.isEmpty}
        kpis={data.kpis}
        loading={data.loading}
      />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <TodayQueue items={data.queue} loading={data.loading} />
          <UpcomingDeadlines items={data.deadlines} loading={data.loading} />
          <ModulesGrid counts={data.moduleCounts} />

          <p className="mt-0.5 font-serif text-sm italic text-ink-muted">
            Lumen Juris — la clarté contractuelle, en continu.
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <QuickGenerateCard />
          <RiskPanel alerts={data.alerts} loading={data.loading} />
          <PlanCard planName={data.planName} quotas={data.quotas} loading={data.loading} />
        </div>
      </div>
    </div>
  );
}
