import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { SignatureDashboard } from "./signature/SignatureDashboard";
import { SignatureWizard } from "./signature/SignatureWizard";

type View = "dashboard" | "wizard";

/**
 * Point d'entrée du module Signature (route `/signature`).
 *
 * Deux vues commutables :
 *   - `dashboard` : tableau de bord (KPIs + liste des enveloppes)
 *   - `wizard`    : wizard de création d'une nouvelle enveloppe
 *
 * Au retour depuis le wizard (envoi réussi ou annulation), on rafraîchit le
 * dashboard via `refreshKey` pour voir apparaître la nouvelle enveloppe.
 */
export function Signature() {
  const [view, setView] = useState<View>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);

  if (view === "wizard") {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setView("dashboard")}
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#354F99] transition-colors font-medium"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Retour au tableau de bord
        </button>
        <SignatureWizard
          onSent={() => { setRefreshKey((k) => k + 1); }}
          onExit={() => { setRefreshKey((k) => k + 1); setView("dashboard"); }}
        />
      </div>
    );
  }

  return (
    <SignatureDashboard
      refreshKey={refreshKey}
      onNewContract={() => setView("wizard")}
    />
  );
}
