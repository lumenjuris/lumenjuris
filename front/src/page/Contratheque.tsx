import { useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { contractApi } from "../components/DashboardComponents/contratheque/api";
import { QuotaLimitModal } from "../components/common/QuotaLimitModal";
import { ContrathequeList } from "../components/DashboardComponents/contratheque/ContrathequeList";
import { ContractDetail } from "../components/DashboardComponents/contratheque/ContractDetail";
import { ImportWizard } from "../components/DashboardComponents/contratheque/ImportWizard";
import { DeadlinesView } from "../components/DashboardComponents/contratheque/DeadlinesView";
import { ViewTabs } from "../components/DashboardComponents/contratheque/ViewTabs";
import type { ContrathequeTab } from "../components/DashboardComponents/contratheque/ViewTabs";
import { useUserStore } from "../store/userStore";

/**
 * Contrathèque — point d'entrée (routes /contratheque et /contratheque/:externalId).
 *
 * Trois vues, inline dans la page (pas de popup) :
 *   - liste   : tableau + KPI + dossiers/tags
 *   - fiche   : /contratheque/:externalId
 *   - import  : wizard (état local), ouvert une fois les fichiers choisis
 */
export function Contratheque() {
  const navigate = useNavigate();
  const { externalId } = useParams<{ externalId: string }>();
  const role = useUserStore((s) => s.userData?.profile?.role);
  // Éditeurs (admin/juriste/user) : peuvent supprimer leurs propres contrats.
  const canDelete = role === "ADMIN" || role === "JURISTE" || role === "USER";

  // `?vue=echeances` ouvre directement l'onglet Échéances (liens du dashboard).
  const [searchParams] = useSearchParams();
  // Fichiers choisis dans la fenêtre système ; non vide = wizard d'import ouvert.
  const [filesToImport, setFilesToImport] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  // Vérification du plafond lancée dès le clic, relue au moment de la sélection.
  const capacityCheck = useRef<Promise<{ allowed: boolean; limit?: number } | null> | null>(null);
  const [tab, setTab] = useState<ContrathequeTab>(
    searchParams.get("vue") === "echeances" ? "echeances" : "contrats",
  );
  const [refreshKey, setRefreshKey] = useState(0);
  // Message de plafond atteint (null = carte fermée).
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  // Le clic ouvre directement la fenêtre système : pas d'`await` avant le
  // `.click()`, sinon le navigateur ne le voit plus comme un geste utilisateur
  // et refuse d'ouvrir la fenêtre. La vérification du plafond part en parallèle
  // et est relue dans handleFilesSelected.
  const handleImport = () => {
    capacityCheck.current = contractApi.capacity().catch((err) => {
      console.error("Vérification du plafond impossible, import poursuivi :", err);
      return null;
    });
    fileRef.current?.click();
  };

  // Vérifie le plafond AVANT d'ouvrir le wizard (UX : bloquer tôt, pas au save).
  // Fail-open : en cas d'erreur, on ouvre quand même — le backend POST /contract
  // reste le garde-fou (402).
  const handleFilesSelected = async (files: File[]) => {
    if (!files.length) return;
    const cap = await capacityCheck.current;
    if (cap && cap.allowed === false) {
      setLimitMessage(
        cap.limit != null
          ? `Votre formule est limitée à ${cap.limit} contrats suivis. Passez à une formule supérieure pour en suivre davantage.`
          : "Votre formule ne permet pas de suivre davantage de contrats.",
      );
      return;
    }
    setFilesToImport(files);
  };

  // Wizard d'import (prioritaire sur les autres vues)
  if (filesToImport.length > 0) {
    return (
      <ImportWizard
        files={filesToImport}
        onCancel={() => setFilesToImport([])}
        onDone={() => { setFilesToImport([]); setRefreshKey((k) => k + 1); }}
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
      <div className="space-y-5 max-w-7xl mx-auto w-full">
        <div className="flex flex-col items-center gap-4 bg-blue-primary px-12 py-8 rounded-2xl">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Contrathèque</h1>
          <p className="text-sm text-gray-primary mt-1">Alertes de renouvellement et suivi des échéances.</p>
        </div>
        <div className="mt-3"><ViewTabs tab={tab} onTab={setTab} /></div>
        <DeadlinesView refreshKey={refreshKey} onOpen={(id) => navigate(`/contratheque/${id}`)} />
      </div>
    );
  }

  // Liste des contrats
  return (
    <>
      <ContrathequeList
        refreshKey={refreshKey}
        tab={tab}
        onTab={setTab}
        canDelete={canDelete}
        onOpen={(id) => navigate(`/contratheque/${id}`,)}
        onImport={handleImport}
      />
      {/* Sélecteur de fichiers de l'import, ouvert par le bouton « Importer ». */}
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx"
        multiple
        className="hidden"
        onChange={(e) => { void handleFilesSelected(Array.from(e.target.files ?? [])); e.target.value = ""; }}
      />
      {limitMessage && (
        <QuotaLimitModal
          title="Limite de la contrathèque atteinte"
          message={limitMessage}
          onClose={() => setLimitMessage(null)}
        />
      )}
    </>
  );
}
