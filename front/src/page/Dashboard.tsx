import "../components/DashboardComponents/home/console.css";

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
            />

            {data.loading ? (
              <ConsoleSkeleton />
            ) : (
              <>
                {/* <ConsoleKpis kpis={data.kpis} /> */}
                <div className="cols">
                  <WorkQueue items={data.queue} />
                  <div className="rail">
                    <AgendaCard items={data.deadlines} />
                    <CreditsCard quotas={data.quotas} planName={data.planName} />
                    <RisksCard alerts={data.alerts} />
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
