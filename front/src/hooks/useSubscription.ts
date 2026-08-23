import { useState } from "react";
import { fetchProxy } from "../utils/fetchProxy";

export function useSubscriptionPortal() {
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const handleManageBilling = async () => {
    setPortalError(null);
    setPortalLoading(true);
    try {
      const res = await fetchProxy("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
        return;
      }
      setPortalError(
        typeof data?.message === "string"
          ? data.message
          : "Impossible d'ouvrir le portail. Réessayez."
      );
    } catch (e) {
      console.error(e);
      setPortalError("Une erreur est survenue. Réessayez.");
    } finally {
      setPortalLoading(false);
    }
  };

  return { handleManageBilling, portalLoading, portalError };
}
