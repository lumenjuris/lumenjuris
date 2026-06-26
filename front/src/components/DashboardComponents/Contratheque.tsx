import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ContrathequeList } from "./contratheque/ContrathequeList";
import { ContractDetail } from "./contratheque/ContractDetail";
import { ImportWizard } from "./contratheque/ImportWizard";
import { DeadlinesView } from "./contratheque/DeadlinesView";
import { ViewTabs } from "./contratheque/ViewTabs";
import type { ContrathequeTab } from "./contratheque/ViewTabs";
import { useUserStore } from "../../store/userStore";

/**
 * Contrathèque — point d'entrée (routes /contratheque et /contratheque/:externalId).
 *
 * Trois vues, inline dans la page (pas de popup) :
 *   - liste   : tableau + KPI + dossiers/tags
 *   - fiche   : /contratheque/:externalId
 *   - import  : wizard 4 étapes (état local)
 */
export function Contratheque() {
  const navigate = useNavigate();
  const { externalId } = useParams<{ externalId: string }>();
  const role = useUserStore((s) => s.userData?.profile?.role);
  // Éditeurs (admin/juriste/user) : peuvent supprimer leurs propres contrats.
  const canDelete = role === "ADMIN" || role === "JURISTE" || role === "USER";

  const [importing, setImporting] = useState(false);
  const [tab, setTab] = useState<ContrathequeTab>("contrats");
  const [refreshKey, setRefreshKey] = useState(0);

  // Wizard d'import (prioritaire sur les autres vues)
  if (importing) {
    return (
      <ImportWizard
        onCancel={() => setImporting(false)}
        onDone={() => { setImporting(false); setRefreshKey((k) => k + 1); }}
      />
    );
  }

  // Fiche détaillée
  if (externalId) {
    return (
      <ContractDetail
        contractId={externalId}
        canDelete={canDelete}
        onBack={() => navigate("/contratheque")}
        onDeleted={() => navigate("/contratheque")}
      />
    );
  }

  // Vue Échéances
  if (tab === "echeances") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Contrathèque</h1>
          <p className="text-sm text-gray-500 mt-1">Alertes de renouvellement et suivi des échéances.</p>
          <div className="mt-3"><ViewTabs tab={tab} onTab={setTab} /></div>
        </div>
        <DeadlinesView refreshKey={refreshKey} onOpen={(id) => navigate(`/contratheque/${id}`)} />
      </div>
    );
  }

  // Liste des contrats
  return (
    <ContrathequeList
      refreshKey={refreshKey}
      tab={tab}
      onTab={setTab}
      canDelete={canDelete}
      onOpen={(id) => navigate(`/contratheque/${id}`)}
      onImport={() => setImporting(true)}
    />
  );
}
