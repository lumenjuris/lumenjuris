import { useState } from "react";
import {
  AlertBanner,
  type AlertVariant,
} from "../components/common/AlertBanner";
import MainHeader from "../components/MainHeader/MainHeader";

import { useUserStore } from "../store/userStore";

import { Navigate } from "react-router-dom";

import { fetchProxy } from "../utils/fetchProxy";


const PRESETS: {
  label: string;
  variant: AlertVariant;
  title: string;
  detail?: string;
}[] = [
  {
    label: "Erreur simple",
    variant: "error",
    title: "Les mois d'ancienneté doivent être compris entre 0 et 11.",
    detail: "Vérifiez les champs saisis et relancez le calcul.",
  },
  {
    label: "Erreur multi",
    variant: "error",
    title:
      "Le taux de temps partiel doit être supérieur à 0 et inférieur ou égal à 1.",
    detail: "+2 autres erreurs — vérifiez les champs saisis.",
  },
  {
    label: "Succès",
    variant: "success",
    title: "Document généré avec succès.",
    detail: "Votre contrat CDI a été créé et est prêt à être téléchargé.",
  },
  {
    label: "Info",
    variant: "info",
    title: "Convention collective détectée.",
    detail:
      "Une indemnité conventionnelle peut être plus favorable que l'indemnité légale calculée.",
  },
  {
    label: "Sans détail",
    variant: "error",
    title: "Une erreur est survenue.",
  },
];

const inputClass =
  "w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 outline-none focus:border-lumenjuris-dark focus:ring-1 focus:ring-lumenjuris-dark";

export function Sandbox() {
  const [banners, setBanners] = useState<
    {
      id: number;
      preset: (typeof PRESETS)[number];
      duration: number;
      title: string;
      detail: string;
      accent: boolean;
    }[]
  >([]);
  const [nextId, setNextId] = useState(0);
  const [duration, setDuration] = useState(5000);
  const [accent, setAccent] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customDetail, setCustomDetail] = useState("");
  const [inseeSiren, setInseeSiren] = useState("940468606");
  const [inseeLoading, setInseeLoading] = useState(false);
  const [inseeResult, setInseeResult] = useState<string>("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authResult, setAuthResult] = useState<string>("");

  const { isConnected: userConnected, userData } = useUserStore();

  const spawn = (preset: (typeof PRESETS)[number]) => {
    setBanners((prev) => [
      ...prev,
      {
        id: nextId,
        preset,
        duration,
        title: customTitle.trim() || preset.title,
        detail: customDetail.trim() || preset.detail || "",
        accent,
      },
    ]);
    setNextId((n) => n + 1);
  };

  const dismiss = (id: number) =>
    setBanners((prev) => prev.filter((b) => b.id !== id));

  const testInsee = async () => {
    try {
      setInseeLoading(true);
      setInseeResult("");

      const response = await fetchProxy(
        `/api/insee/${encodeURIComponent(inseeSiren)}`,
        {
          credentials: "include",
        },
      );

      const rawText = await response.text();

      let parsed: unknown = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = null;
      }

      setInseeResult(
        JSON.stringify(
          {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            body: parsed ?? rawText ?? "",
          },
          null,
          2,
        ),
      );
    } catch (error) {
      setInseeResult(
        JSON.stringify(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          null,
          2,
        ),
      );
    } finally {
      setInseeLoading(false);
    }
  };

  const testAuth = async (action: "login" | "logout") => {
    try {
      setAuthLoading(true);
      setAuthResult("");

      const response = await fetchProxy(
        action === "login" ? "/api/user/auth/login" : "/api/user/auth/logout",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body:
            action === "login"
              ? JSON.stringify({
                  email: "test@lumenjuris.local",
                  password: "password123",
                })
              : undefined,
        },
      );

      const rawText = await response.text();

      let parsed: unknown = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = null;
      }

      setAuthResult(
        JSON.stringify(
          {
            action,
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            body: parsed ?? rawText ?? "",
          },
          null,
          2,
        ),
      );
    } catch (error) {
      setAuthResult(
        JSON.stringify(
          {
            action,
            error: error instanceof Error ? error.message : String(error),
          },
          null,
          2,
        ),
      );
    } finally {
      setAuthLoading(false);
    }
  };

  return !userConnected ? (
    <Navigate to="/inscription" />
  ) : userData?.profile.role !== "ADMIN" ? (
    <Navigate to="/dashboard" />
  ) : (
    <>
      <MainHeader />
      <div className="space-y-8 max-w-2xl min-h-[calc(100vh-64px)] mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Sandbox
          </h1>
        </div>

        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-800">AlertBanner</h2>

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Titre
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Texte principal..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Détail
                </label>
                <input
                  type="text"
                  value={customDetail}
                  onChange={(e) => setCustomDetail(e.target.value)}
                  placeholder="Texte secondaire..."
                  className={inputClass}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500 shrink-0">
                  Durée (ms)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={duration}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, "");
                    setDuration(v === "" ? 3000 : parseInt(v));
                  }}
                  className="w-24 text-sm border border-gray-300 rounded-md px-3 py-1.5 outline-none focus:border-lumenjuris-dark focus:ring-1 focus:ring-lumenjuris-dark"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setAccent((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${accent ? "bg-lumenjuris-dark" : "bg-gray-200"}`}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${accent ? "translate-x-4" : ""}`}
                  />
                </div>
                <span className="text-xs font-medium text-gray-600">
                  Accent gauche
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => spawn(preset)}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors bg-white text-gray-700"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {banners.map((b) => (
              <AlertBanner
                key={b.id}
                variant={b.preset.variant}
                title={b.title}
                detail={b.detail || undefined}
                duration={b.duration}
                accent={b.accent}
                onClose={() => dismiss(b.id)}
              />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Test Auth</h2>

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => testAuth("login")}
                disabled={authLoading}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors bg-white text-gray-700 disabled:opacity-50"
              >
                {authLoading ? "Chargement..." : "Login user test"}
              </button>
              <button
                onClick={() => testAuth("logout")}
                disabled={authLoading}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors bg-white text-gray-700 disabled:opacity-50"
              >
                {authLoading ? "Chargement..." : "Logout"}
              </button>
            </div>

            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 overflow-auto whitespace-pre-wrap">
              {authResult || "Le résultat du test auth s'affichera ici."}
            </pre>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Test INSEE</h2>

          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={inseeSiren}
                onChange={(e) => setInseeSiren(e.target.value)}
                placeholder="SIREN"
                className={inputClass}
              />
              <button
                onClick={testInsee}
                disabled={inseeLoading}
                className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors bg-white text-gray-700 disabled:opacity-50"
              >
                {inseeLoading ? "Chargement..." : "Tester"}
              </button>
            </div>

            <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700 overflow-auto whitespace-pre-wrap">
              {inseeResult || "Le résultat du test INSEE s'affichera ici."}
            </pre>
          </div>
        </section>
      </div>
    </>
  );
}
