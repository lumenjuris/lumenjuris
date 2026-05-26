import { useState } from "react";
import {
  AlertBanner,
  type AlertVariant,
} from "../components/common/AlertBanner";
import MainHeader from "../components/MainHeader/MainHeader";

import { useUserStore } from "../store/userStore";

import { Navigate } from "react-router-dom";

import { fetchProxy } from "../utils/fetchProxy";

interface DebugFeed {
  url: string;
  label: string;
  status: "ok" | "error";
  error?: string;
  itemCount: number;
  items: {
    title: string;
    description: string;
    date: string;
    source: string;
    link?: string;
  }[];
}

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

  const [debugFeeds, setDebugFeeds] = useState<DebugFeed[]>([]);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugError, setDebugError] = useState("");
  const [expandedFeed, setExpandedFeed] = useState<number | null>(null);
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [classifyError, setClassifyError] = useState("");
  // map "feedIndex-itemIndex" → tag | null
  const [classifyTags, setClassifyTags] = useState<
    Record<string, string | null>
  >({});

  const { isConnected: userConnected, userData } = useUserStore();

  const applyAiFilter = async () => {
    const allItems: {
      feedIdx: number;
      itemIdx: number;
      title: string;
      description: string;
    }[] = [];
    debugFeeds.forEach((feed, fi) => {
      feed.items.forEach((item, ii) =>
        allItems.push({
          feedIdx: fi,
          itemIdx: ii,
          title: item.title,
          description: item.description,
        }),
      );
    });
    if (allItems.length === 0) return;

    setClassifyLoading(true);
    setClassifyError("");
    setClassifyTags({});
    try {
      const res = await fetchProxy("/api/classify-veille", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articles: allItems.map((a) => ({
            title: a.title,
            description: a.description,
          })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw: (string | null)[] = await res.json();
      const tags: Record<string, string | null> = {};
      allItems.forEach((a, i) => {
        tags[`${a.feedIdx}-${a.itemIdx}`] = raw[i] ?? null;
      });
      setClassifyTags(tags);
    } catch (e) {
      setClassifyError((e as Error).message);
    } finally {
      setClassifyLoading(false);
    }
  };

  const fetchDebug = async () => {
    setDebugLoading(true);
    setDebugError("");
    try {
      const res = await fetchProxy("/api/veille/debug", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as {
        success: boolean;
        feeds?: DebugFeed[];
      };
      if (payload.success && payload.feeds) {
        setDebugFeeds(payload.feeds);
        setExpandedFeed(null);
      } else {
        setDebugError("Réponse inattendue du serveur.");
      }
    } catch (e) {
      setDebugError((e as Error).message);
    } finally {
      setDebugLoading(false);
    }
  };

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
        { credentials: "include" },
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
            body: parsed ?? rawText ?? "",
          },
          null,
          2,
        ),
      );
    } catch (error) {
      setInseeResult(
        JSON.stringify(
          { error: error instanceof Error ? error.message : String(error) },
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
          headers: { "Content-Type": "application/json" },
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

  return userData?.profile.role !== "ADMIN" ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <>
      <MainHeader />
      <div className="space-y-8 max-w-2xl min-h-[calc(100vh-64px)] mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Sandbox
          </h1>
        </div>

        {/* AlertBanner */}
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

        {/* Auth */}
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

        {/* INSEE */}
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

        {/* Debug RSS */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-800">
            Debug flux RSS
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={fetchDebug}
                disabled={debugLoading}
                className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:border-gray-500 transition-colors bg-gray-50 text-gray-700 font-mono disabled:opacity-50"
              >
                {debugLoading ? "Chargement…" : "Fetch flux bruts"}
              </button>
              {debugFeeds.length > 0 && (
                <button
                  onClick={applyAiFilter}
                  disabled={classifyLoading}
                  className="text-sm px-4 py-2 rounded-lg border border-lumenjuris/40 hover:border-lumenjuris transition-colors bg-lumenjuris/5 text-lumenjuris font-medium disabled:opacity-50"
                >
                  {classifyLoading
                    ? "Classification…"
                    : "Appliquer le filtre IA"}
                </button>
              )}
            </div>
            {debugError && (
              <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">
                {debugError}
              </p>
            )}
            {classifyError && (
              <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">
                {classifyError}
              </p>
            )}
          </div>

          {debugFeeds.length > 0 && (
            <div className="space-y-2">
              {debugFeeds.map((feed, fi) => (
                <div
                  key={fi}
                  className="bg-white border border-gray-200 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedFeed(expandedFeed === fi ? null : fi)
                    }
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${feed.status === "ok" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                      >
                        {feed.status === "ok"
                          ? `${feed.itemCount} items`
                          : "erreur"}
                      </span>
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {feed.label}
                      </span>
                      <span className="text-xs text-gray-400 truncate hidden sm:block">
                        {feed.url}
                      </span>
                    </div>
                    <span className="text-gray-400 text-xs shrink-0 ml-2">
                      {expandedFeed === fi ? "▲" : "▼"}
                    </span>
                  </button>

                  {expandedFeed === fi && (
                    <div className="border-t border-gray-100">
                      {feed.status === "error" ? (
                        <p className="px-4 py-3 text-xs text-red-600 font-mono">
                          {feed.error}
                        </p>
                      ) : feed.items.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-gray-400 italic">
                          Aucun item dans ce flux.
                        </p>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {feed.items.map((item, ii) => {
                            const aiTag = classifyTags[`${fi}-${ii}`];
                            const hasAiResult = `${fi}-${ii}` in classifyTags;
                            return (
                              <div key={ii} className="px-4 py-2.5 space-y-0.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    {item.link ? (
                                      <a
                                        href={item.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-medium text-gray-800 hover:text-lumenjuris underline underline-offset-2"
                                      >
                                        {item.title || (
                                          <span className="italic text-gray-400">
                                            (sans titre)
                                          </span>
                                        )}
                                      </a>
                                    ) : (
                                      <p className="text-xs font-medium text-gray-800">
                                        {item.title || (
                                          <span className="italic text-gray-400">
                                            (sans titre)
                                          </span>
                                        )}
                                      </p>
                                    )}
                                  </div>
                                  {hasAiResult && (
                                    <span
                                      className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${aiTag ? "bg-lumenjuris/10 text-lumenjuris" : "bg-gray-100 text-gray-400 italic"}`}
                                    >
                                      {aiTag ?? "null"}
                                    </span>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-xs text-gray-400 truncate">
                                    {item.description}
                                  </p>
                                )}
                                <p className="text-xs text-gray-300">
                                  {item.date}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
