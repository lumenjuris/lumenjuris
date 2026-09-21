import { useState } from "react";
import { LegalWatchAlerts } from "./veille/LegalWatchAlerts";
import { LegalWatchFeed } from "./veille/LegalWatchFeed";
import { LegalWatchSettings } from "./veille/LegalWatchSettings";
import { useLegalWatchStore } from "../../store/legalWatchStore";
import { PageBanner } from "../common/PageBanner";

/**
 * Page Veille — trois onglets à rôle unique :
 * - « Alertes » : veille ciblée sur le portefeuille (veille/LegalWatchAlerts).
 * - « Actualités juridiques » : fil unique jurisprudence + RSS, filtrable par
 *   thématique (veille/LegalWatchFeed).
 * - « Paramètres » : sources & thèmes surveillés (veille/LegalWatchSettings).
 */
type VeilleTabKey = "alerts" | "news" | "settings";

export function Veille() {
  const [tab, setTab] = useState<VeilleTabKey>("alerts");
  const unreadCount = useLegalWatchStore((s) => s.unreadCount);

  const tabs: Array<{ key: VeilleTabKey; label: string; badge?: number }> = [
    { key: "alerts", label: "Alertes", badge: unreadCount },
    { key: "news", label: "Actualités" },
    { key: "settings", label: "Paramètres" },
  ];

  return (
    <div className="mx-auto w-full space-y-6 max-w-4xl">
      <PageBanner title="Actualité juridique" subtitle="Alertes et actualités du droit qui concernent vos contrats." />

      {/* Onglets */}
      <div className="flex items-center gap-1 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors -mb-px border-b-2 ${
              tab === t.key
                ? "text-brand border-brand"
                : "text-ink-muted border-transparent hover:text-ink-secondary"
            }`}
          >
            {t.label}
            {t.badge ? (
              <span className="ml-2 text-[10px] font-bold text-white bg-brand px-1.5 py-0.5 rounded-full">
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "alerts" && <LegalWatchAlerts onOpenSettings={() => setTab("settings")} />}
      {tab === "news" && <LegalWatchFeed />}
      {tab === "settings" && <LegalWatchSettings />}
    </div>
  );
}
