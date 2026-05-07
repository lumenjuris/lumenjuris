import type { ReactNode, RefObject } from "react";
import { useState } from "react";
import { ArrowLeft, Lock, Scale } from "lucide-react";
import { Link } from "react-router-dom";
import type { SettingsTab, SettingsTabItem } from "../../types/paramSettings";

import HeaderNavigationBar from "../MainHeader/HeaderNavigationBar";

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

export function ParamLayout({
  title = "Mes Paramètres",
  tabs,
  activeTab,
  onTabChange,
  panelMinHeight,
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
    <>
      {" "}
      <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {/* <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <PanelLeft className="h-4 w-4" />
            </button> */}
        </div>

        <HeaderNavigationBar />
      </header>
      <div className="min-h-screen bg-[#f8f9fb]">
        <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:z-20 md:w-64 md:flex-col md:bg-lumenjuris-sidebar">
          <div className="p-4 pb-2">
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-lumenjuris">
                <Scale className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white tracking-tight">
                  LumenJuris
                </span>
                <span className="text-[10px] text-gray-400 leading-none">
                  Conformité RH
                </span>
              </div>
            </Link>
          </div>

          <nav className="flex-1 overflow-auto px-2 pt-4">
            <ul className="flex flex-col gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <li key={tab.id}>
                    <button
                      type="button"
                      onClick={() => onTabChange(tab.id)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                        isActive
                          ? "bg-white/10 text-white font-medium"
                          : "text-gray-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{tab.label}</span>
                    </button>
                  </li>
                );
              })}
              <li className="mt-4 border-t border-white/10 pt-4">
                <Link
                  to="/dashboard"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" />
                  <span>Retour</span>
                </Link>
              </li>
            </ul>
          </nav>

          <div className="p-4">
            <div className="flex items-center justify-center gap-1.5 py-2">
              <Lock className="h-3 w-3 text-gray-500" />
              <span className="text-[10px] text-gray-500">
                Données sécurisées – Hébergement UE
              </span>
            </div>
          </div>
        </aside>

        <div className="min-h-[calc(vh-64px)] px-4 py-6 lg:px-6 md:ml-64">
          <div className="mx-auto max-w-6xl">
            <div className="mb-16">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                {title}
              </h1>
            </div>

            <div className="relative">
              <aside className="mb-6 flex flex-col gap-2 md:hidden">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onTabChange(tab.id)}
                      className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-colors ${
                        isActive
                          ? "border-lumenjuris bg-lumenjuris text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <div>
                        <div className="text-sm font-semibold">{tab.label}</div>
                        {tab.description ? (
                          <div
                            className={`mt-1 text-xs ${
                              isActive ? "text-white/75" : "text-gray-400"
                            }`}
                          >
                            {tab.description}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
                <Link
                  to="/dashboard"
                  className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-left text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" />
                  <div className="text-sm font-semibold">Retour</div>
                </Link>
              </aside>

              <div>
                <section
                  className="flex flex-col rounded-2xl border border-gray-200 min-h-[600px] bg-white p-6 shadow-sm"
                  // style={
                  //   panelMinHeight !== null
                  //     ? { minHeight: `${panelMinHeight}px` }
                  //     : undefined
                  // }
                >
                  {children}
                </section>
              </div>

              {/*
            Ces panneaux invisibles servent uniquement à stabiliser la hauteur
            de la carte desktop quand on change d'onglet.
            */}
              <div
                aria-hidden="true"
                className="pointer-events-none invisible absolute left-0 top-0 hidden w-full md:block"
              >
                <div>
                  <section
                    ref={accountMeasureRef}
                    className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
                  >
                    {accountMeasurePanel}
                  </section>
                  <section
                    ref={enterpriseMeasureRef}
                    className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
                  >
                    {enterpriseMeasurePanel}
                  </section>
                  <section
                    ref={preferenceMeasureRef}
                    className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
                  >
                    {preferenceMeasurePanel}
                  </section>
                  <section
                    ref={subscriptionMeasureRef}
                    className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
                  >
                    {preferenceSubscriptionPanel}
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
