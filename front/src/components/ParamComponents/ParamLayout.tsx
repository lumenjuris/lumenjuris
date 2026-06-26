import type { ReactNode, RefObject } from "react";
import type { SettingsTab, SettingsTabItem } from "../../types/paramSettings";

type ParamLayoutProps = {
  title?: string;
  tabs: SettingsTabItem[];
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  panelMinHeight: number | null;
  children: ReactNode;
  accountMeasureRef: RefObject<HTMLElement>;
  enterpriseMeasureRef: RefObject<HTMLElement>;
  preferenceMeasureRef: RefObject<HTMLElement>;
  subscriptionMeasureRef: RefObject<HTMLElement>;
  accountMeasurePanel: ReactNode;
  enterpriseMeasurePanel: ReactNode;
  preferenceMeasurePanel: ReactNode;
  preferenceSubscriptionPanel: ReactNode;
};

/** Panneau de paramètres — s'intègre dans la coquille commune (MainLayout), pas de sidebar/header propre. */
export function ParamLayout({
  title = "Mes Paramètres",
  tabs,
  activeTab,
  onTabChange,
  children,
  accountMeasureRef,
  enterpriseMeasureRef,
  preferenceMeasureRef,
  subscriptionMeasureRef,
  accountMeasurePanel,
  enterpriseMeasurePanel,
  preferenceMeasurePanel,
  preferenceSubscriptionPanel,
}: ParamLayoutProps) {
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight text-ink mb-6">{title}</h1>

      {/* Onglets */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-line pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-light text-brand"
                  : "text-ink-secondary hover:bg-surface-muted"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <section className="flex flex-col rounded-card border border-line bg-white p-6 shadow-card min-h-[600px]">
          {children}
        </section>

        {/*
          Ces panneaux invisibles servent uniquement à stabiliser la hauteur
          de la carte quand on change d'onglet.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none invisible absolute left-0 top-0 hidden w-full md:block"
        >
          <div>
            <section ref={accountMeasureRef} className="flex flex-col rounded-card border border-line bg-white p-6 shadow-card">
              {accountMeasurePanel}
            </section>
            <section ref={enterpriseMeasureRef} className="flex flex-col rounded-card border border-line bg-white p-6 shadow-card">
              {enterpriseMeasurePanel}
            </section>
            <section ref={preferenceMeasureRef} className="flex flex-col rounded-card border border-line bg-white p-6 shadow-card">
              {preferenceMeasurePanel}
            </section>
            <section ref={subscriptionMeasureRef} className="flex flex-col rounded-card border border-line bg-white p-6 shadow-card">
              {preferenceSubscriptionPanel}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
