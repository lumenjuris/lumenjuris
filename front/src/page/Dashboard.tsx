import "../components/DashboardComponents/home/console.css";

import { useMemo } from "react";

import { useUserStore } from "../store/userStore";
import { useDashboardData } from "../components/DashboardComponents/home/useDashboardData";
import { usePageThemeScope } from "../hooks/usePageThemeScope";
import { InfoBanner } from "../components/DashboardComponents/home/InfoBanner";
import { AccountRedirectNotice } from "../components/DashboardComponents/home/AccountRedirectNotice";
import { ConsoleHero } from "../components/DashboardComponents/home/console/ConsoleHero";
/* import { ConsoleKpis } from "../components/DashboardComponents/home/console/ConsoleKpis"; */
import { WorkQueue } from "../components/DashboardComponents/home/console/WorkQueue";
import { AgendaCard } from "../components/DashboardComponents/home/console/AgendaCard";
import { CreditsCard } from "../components/DashboardComponents/home/console/CreditsCard";
import { RisksCard } from "../components/DashboardComponents/home/console/RisksCard";
import { VisitorLauncher } from "../components/DashboardComponents/home/console/VisitorLauncher";
import { ToolCards } from "../components/DashboardComponents/home/console/ToolCards";
import { buildToolCards } from "../components/DashboardComponents/home/console/toolCatalog";

/**
 * Page d'accueil (`/dashboard`) — « la console ».
 *
 * Deux visages selon la connexion :
 *  - **Visiteur** : un lanceur d'outils qui amène à agir tout de suite.
 *  - **Connecté** : un poste de pilotage — salutation, repères du portefeuille,
 *    file « À traiter » et un rail (agenda, crédits, points de vigilance).
 *
 * Le thème clair / sombre est global (voir `store/themeStore`) ; seul le fond
 * « matière » pleine page est réservé au tableau de bord.
 * Toutes les données viennent d'un seul chargement (`useDashboardData`).
 */
export function Dashboard() {
  const firstName = useUserStore((s) => s.userData?.profile?.prenom) ?? "";
  // Réserve l'habillage sombre pleine page (fond « matière ») au tableau de bord.
  usePageThemeScope("dashboard");

  const data = useDashboardData();

  // Cartes d'outils : celles choisies à l'onboarding, sinon trois cartes par défaut.
  const primaryIntents = useUserStore((s) => s.onboarding?.primaryIntents);
  const onboardingLoaded = useUserStore((s) => s.onboardingLoaded);
  const toolCards = useMemo(
    () => buildToolCards(primaryIntents ?? [], data.toolCounts),
    [primaryIntents, data.toolCounts],
  );
  const isPersonalized = (primaryIntents?.length ?? 0) > 0;

  // Un bloc sans donnée est masqué, chacun indépendamment des autres.
  const showQueue = data.queue.length > 0;
  const showAgenda = data.deadlines.length > 0;
  // Les points de vigilance restent visibles dès qu'un contrat est suivi, même
  // sans alerte : « vos contrats sont à jour » est alors une information utile.
  const showRisks = data.alerts.length > 0 || data.toolCounts.contracts > 0;

  return (
    <div className="ljc">
      <div className="wrap">
        {/* Un compte bloqué est renvoyé ici après une tentative de connexion :
            le message doit rester visible avant tout le reste. */}
        <AccountRedirectNotice />
        {data.isGuest ? (
          <VisitorLauncher />
        ) : (
          <>
            {/* Les annonces produit passent par une route authentifiée. */}
            <InfoBanner />

            <ConsoleHero
              firstName={firstName}
              isEmpty={data.isEmpty}
              pendingActions={data.pendingActions}
              isPersonalized={isPersonalized}
            />

            {/* On attend aussi l'onboarding : sans cela, les cartes par défaut
                s'afficheraient un instant avant celles de l'utilisateur. */}
            {data.loading || !onboardingLoaded ? (
              <ConsoleSkeleton />
            ) : (
              <>
                {/* <ConsoleKpis kpis={data.kpis} /> */}
                {/* Chaque bloc ne s'affiche que s'il a quelque chose à montrer
                    (voir `showQueue`, `showAgenda`, `showRisks`). Les cartes
                    d'outils et les crédits sont toujours présents. */}
                <div className="cols">
                  <div className="maincol bg-white p-4 rounded-xl">
                    {showQueue && <WorkQueue items={data.queue} />}
                    <ToolCards cards={toolCards} isPersonalized={isPersonalized} />
                  </div>
                  <div className="rail">
                    {/* Les points de vigilance passent en tête du rail : rassurer est la première promesse. */}
                    {showRisks && <RisksCard alerts={data.alerts} />}
                    {showAgenda && <AgendaCard items={data.deadlines} />}
                    <CreditsCard quotas={data.quotas} planName={data.planName} />
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Ossature affichée pendant le chargement des données du portefeuille. */
function ConsoleSkeleton() {
  const bar = { background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 16 };
  return (
    <>
      <div className="kpis" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => <div key={i} style={{ ...bar, height: 82 }} className="lj-pulse" />)}
      </div>
      <div className="cols" aria-hidden="true">
        <div style={{ ...bar, height: 320 }} className="lj-pulse" />
        <div className="rail">
          <div style={{ ...bar, height: 150 }} className="lj-pulse" />
          <div style={{ ...bar, height: 180 }} className="lj-pulse" />
        </div>
      </div>
    </>
  );
}
