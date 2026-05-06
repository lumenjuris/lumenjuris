import { useEffect, useState } from "react";
import MainHeader from "../components/MainHeader/MainHeader";
import { useUserStore } from "../store/userStore";
import { Navigate } from "react-router-dom";
import { fetchProxy } from "../utils/fetchProxy";


type LlmUsage = {
  model: string;
  tokenInput: number;
  tokenOutput: number;
  totalTokens: number;
  totalCostUsd: number;
  startAt: string;
  expiresAt: string;
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("fr-FR").format(value);

const formatUsd = (value: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 4,
  }).format(value);

export const Monitoring = () => {
  const { isConnected: userConnected, userData } = useUserStore();
  const [llmUsage, setLlmUsage] = useState<LlmUsage[]>([]);
  const [llmUsageLoading, setLlmUsageLoading] = useState(false);
  const [llmUsageError, setLlmUsageError] = useState("");
  const [llmUsageUpdatedAt, setLlmUsageUpdatedAt] = useState<Date | null>(null);

  const fetchLlmUsage = async () => {
    try {
      setLlmUsageLoading(true);
      setLlmUsageError("");

      const response = await fetchProxy("/api/llm/usage", {
        credentials: "include",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || `Erreur HTTP ${response.status}`);
      }

      setLlmUsage(Array.isArray(data.usage) ? data.usage : []);
      setLlmUsageUpdatedAt(new Date());
    } catch (error) {
      setLlmUsageError(error instanceof Error ? error.message : String(error));
    } finally {
      setLlmUsageLoading(false);
    }
  };

  useEffect(() => {
    void fetchLlmUsage();
    const intervalId = window.setInterval(() => {
      void fetchLlmUsage();
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

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
            Monitoring
          </h1>
        </div>

        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-800">
            Usage LLM actuel
          </h2>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500">
              <span>Modèle</span>
              <span className="text-right">Input</span>
              <span className="text-right">Output</span>
              <span className="text-right">Coût USD</span>
            </div>

            {llmUsage.length > 0 ? (
              llmUsage.map((usage) => (
                <div
                  key={usage.model}
                  className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-gray-100 last:border-b-0 text-sm text-gray-700"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {usage.model}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatNumber(usage.totalTokens)} tokens
                    </div>
                  </div>
                  <span className="text-right tabular-nums">
                    {formatNumber(usage.tokenInput)}
                  </span>
                  <span className="text-right tabular-nums">
                    {formatNumber(usage.tokenOutput)}
                  </span>
                  <span className="text-right tabular-nums">
                    {formatUsd(usage.totalCostUsd)}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-4 py-4 text-sm text-gray-500">
                {llmUsageLoading
                  ? "Chargement de l'usage..."
                  : "Aucun usage LLM trouvé pour le mois courant."}
              </div>
            )}

            <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500">
              {llmUsageError
                ? `Erreur: ${llmUsageError}`
                : llmUsageUpdatedAt
                  ? `Dernière mise à jour: ${llmUsageUpdatedAt.toLocaleTimeString("fr-FR")}`
                  : "Surveillance active toutes les secondes."}
            </div>
          </div>
        </section>
      </div>
    </>
  );
};
