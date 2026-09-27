import type { ReactNode, RefObject } from "react";
import type { SettingsTab, SettingsTabItem } from "../../types/paramSettings";
import { PageBanner } from "../common/PageBanner";

type ParamLayoutProps = {
  title?: string;
  tabs: SettingsTabItem[];
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  panelMinHeight: number | null;
  children: ReactNode;
  accountMeasureRef: RefObject<HTMLElement>;
  enterpriseMeasureRef: RefObject<HTMLElement>;
  subscriptionMeasureRef: RefObject<HTMLElement>;
  accountMeasurePanel: ReactNode;
  enterpriseMeasurePanel: ReactNode;
  preferenceSubscriptionPanel: ReactNode;
};

export function ParamLayout({
  title = "Mes paramètres",
  tabs,
  activeTab,
  onTabChange,
  children,
  accountMeasureRef,
  enterpriseMeasureRef,
  subscriptionMeasureRef,
  accountMeasurePanel,
  enterpriseMeasurePanel,
  preferenceSubscriptionPanel,
}: ParamLayoutProps) {
  return (


    <div className="max-w-7xl w-full mx-auto space-y-6">
      <PageBanner title={title} subtitle="Modifiez les paramètres de votre compte" />

    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Btn changement de vue */}
      <div className="flex gap-0.5 justify-center flex-col sm:flex-row sm:gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`inline-flex items-center rounded-lg sm:mt-4 mt-1 px-4 py-1.5 text-sm font-medium transition-colors  ${isActive
                  ? "bg-white text-slate-900 shadow-sm text-black border-2"
                  : "bg-blue-primary text-white hover:bg-blue-primary/85"
                }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenu principal */}
      <div className="relative px-4 sm:p-6">
        <section className="flex flex-col space-y-6 min-h-[600px]">
          {children}
        </section>

        <div
          aria-hidden="true"
          className="pointer-events-none invisible absolute left-0 top-0 hidden w-full h-0 overflow-hidden md:block"
        >
          <div>
            <section ref={accountMeasureRef} className="flex flex-col p-6">
              {accountMeasurePanel}
            </section>
            <section ref={enterpriseMeasureRef} className="flex flex-col p-6">
              {enterpriseMeasurePanel}
            </section>
            <section ref={subscriptionMeasureRef} className="flex flex-col p-6">
              {preferenceSubscriptionPanel}
            </section>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
