import { useUserStore } from "../store/userStore";
import { useDashboardData } from "../components/DashboardComponents/home/useDashboardData";
import { InfoBanner } from "../components/DashboardComponents/home/InfoBanner";
import { HeroHeader } from "../components/DashboardComponents/home/HeroHeader";
import { UpcomingDeadlines } from "../components/DashboardComponents/home/UpcomingDeadlines";
import { TodayQueue } from "../components/DashboardComponents/home/TodayQueue";
import { ModulesSection } from "../components/DashboardComponents/home/ModulesSection";
import { AccountRedirectNotice } from "../components/DashboardComponents/home/AccountRedirectNotice";

/**
 * Page d'accueil (`/dashboard`).
 *
 * Compacte et organisée à l'horizontale : l'en-tête place la salutation à côté
 * des deux points d'entrée (générer / importer un contrat), puis la file de
 * travail et les échéances sont côte à côte sur écran large. (Le bloc
 * « Premiers pas » a été retiré : il faisait doublon avec ces deux entrées.)
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

      {/* Un compte bloqué est renvoyé ici par le serveur après une tentative
          de connexion : le message doit être visible avant tout le reste. */}
      <AccountRedirectNotice />

      {/* Les annonces produit passent par une route authentifiée : on ne les
          demande pas pour un visiteur. */}
      {!data.isGuest && <InfoBanner />}

      <HeroHeader
        firstName={firstName}
        isGuest={data.isGuest}
        isEmpty={data.isEmpty}
        pendingActions={data.pendingActions}
        kpis={data.kpis}
        loading={data.loading}
      />

      {/* Les modules viennent juste après l'en-tête : pour un visiteur c'est la
          présentation de l'outil, pour un utilisateur connecté ce sont des
          raccourcis vers son travail. */}
      <ModulesSection isGuest={data.isGuest} />

      {/* Le titre « Lumen Juris » de bas de page a été retiré : le logo du menu
          suffit à situer l'utilisateur, la page d'accueil reste utilitaire. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <TodayQueue items={data.queue} loading={data.loading} isGuest={data.isGuest} />
        <UpcomingDeadlines items={data.deadlines} loading={data.loading} isGuest={data.isGuest} />
      </div>
    </div>
  );
}
