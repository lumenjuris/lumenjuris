import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";
import { getParamConfirmationModalContent } from "../utils/param/paramSettings";
import { fetchProxy } from "../utils/fetchProxy";
import { AlertBanner } from "../components/common/AlertBanner";

type AccountConfirmationModal = "export_data" | "delete_account";

export function ConfirmDeleteAccountPage() {
  const { token } = useParams<{ token: string }>();

  const [activeConfirmationModal, setActiveConfirmationModal] =
    useState<AccountConfirmationModal | null>(null);
  const [exportDataSuccess, setExportDataSuccess] = useState(false);
  const [exportDataError, setExportDataError] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [loading, setLoading] = useState(false);
  const [reasonDeparture, setReasonDeparture] = useState("");
  const [customReason, setCustomReason] = useState("");

  const confirmationModalContent = getParamConfirmationModalContent({
    activeConfirmationModal,
    onClose: () => setActiveConfirmationModal(null),

    onExportDataConfirm: () => {
      void fetchProxy("/api/user/export-data", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: token ? JSON.stringify({ token }) : undefined,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error();
          const result = await response.json();
          if (!result.success) throw new Error();

          setActiveConfirmationModal(null);
          setExportDataSuccess(true);
        })
        .catch(() => {
          setActiveConfirmationModal(null);
          setExportDataError(true);
        });
    },

    onDeleteAccountConfirm: () => {
      setLoading(true);
      setDeleteError("");

      void fetchProxy(`/api/user/confirm-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: token
          ? JSON.stringify({
              token,
              reason: reasonDeparture === "autre" ? customReason : reasonDeparture,
            })
          : undefined,
      })
        .then(async (response) => {
          const result = await response.json();
          if (response.ok && result.success) {
            window.location.href = "https://www.lumenjuris.com/";
          } else {
            throw new Error(result.message || "Lien invalide ou expiré");
          }
        })
        .catch((error) => {
          setDeleteError(
            error.message || "Une erreur est survenue lors de la suppression.",
          );
        })
        .finally(() => {
          setActiveConfirmationModal(null);
          setLoading(false);
        });
    },

    onTwoFactorConfirm: () => {},
    onPasswordConfirm: () => {},
    onProfileUpdateConfirm: () => {},
    onSendMailDeleteAccountConfirm: () => {},
  });

return (
  <div className="max-w-4xl mx-auto my-8 p-8 bg-[#1e3a5f] rounded-2xl text-white shadow-xl space-y-6">
    
    {/* Alertes de statut */}
    {exportDataSuccess && (
      <AlertBanner
        title="Export demandé avec succès !"
        variant="success"
        detail="Un e-mail contenant toutes les informations liées à votre compte vous a été envoyé."
        duration={10000}
        onClose={() => setExportDataSuccess(false)}
      />
    )}
    {exportDataError && (
      <AlertBanner
        title="Échec de l'exportation !"
        variant="error"
        detail="Une erreur est survenue lors de la récupération de vos données. Veuillez réessayer."
        duration={10000}
        onClose={() => setExportDataError(false)}
      />
    )}
    {deleteError && (
      <AlertBanner
        title="Erreur de suppression"
        variant="error"
        detail={deleteError}
        duration={10000}
        onClose={() => setDeleteError("")}
      />
    )}

    {/* En-tête centré */}
    <div className="text-center space-y-2 max-w-xl mx-auto mb-8">
      <h1 className="text-3xl font-bold">Suppression de votre compte</h1>
      <p className="text-sm text-slate-300">
        Nous sommes désolés de vous voir partir. Votre décision est définitive et effacera toutes vos données.
      </p>
    </div>

    {/* Section principale en 2 colonnes avec séparateur */}
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-8 items-center">
      
      {/* Colonne de gauche : Motif + Action de suppression */}
      <div className="space-y-4 text-center md:text-left">
        <label htmlFor="delete-reason" className="block text-sm font-medium text-slate-200">
          Pourquoi souhaitez-vous nous quitter ?
        </label>
        
        <select
          id="delete-reason"
          value={reasonDeparture}
          onChange={(e) => setReasonDeparture(e.target.value)}
          className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 text-center font-medium transition outline-none cursor-pointer"
        >
          <option value="">Sélectionnez une raison</option>
          <option value="plus_utilise">Je n'utilise plus le service</option>
          <option value="trop_cher">Trop cher</option>
          <option value="autre_outil">Je préfère un autre outil</option>
          <option value="technique">Problème technique</option>
          <option value="confidentialite">Confidentialité / Données personnelles</option>
          <option value="autre">Autre raison...</option>
        </select>

        {reasonDeparture === "autre" && (
          <textarea
            placeholder="Dites-nous en plus pour nous aider à nous améliorer..."
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            className="w-full p-3 bg-white text-slate-800 rounded-lg text-sm h-28 outline-none resize-none"
            maxLength={1000}
          />
        )}

        <Button
          className="w-full bg-[#ef4444] text-white hover:bg-red-600 font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          disabled={loading || !reasonDeparture || (reasonDeparture === "autre" && !customReason.trim())}
          onClick={() => setActiveConfirmationModal("delete_account")}
        >
          {loading ? "Suppression..." : "Supprimer mon compte"}
        </Button>
      </div>

      {/* Séparateur vertical (desktop) / horizontal (mobile) */}
      <div className="hidden md:block w-[1px] h-full bg-slate-400/40 justify-self-center" />
      <div className="block md:hidden h-[1px] w-full bg-slate-400/40" />

      {/* Colonne de droite : Carte de sauvegarde des données */}
      <div className="bg-white text-slate-900 rounded-xl p-6 text-center space-y-4 shadow-md">
        <h4 className="text-base font-bold text-slate-900">Pensez à sauvegarder vos données</h4>
        <p className="text-xs text-slate-500 leading-relaxed">
          Souhaitez-vous télécharger une copie de vos informations de compte avant leur suppression irréversible ?
        </p>
        <Button
          variant="outline"
          onClick={() => setActiveConfirmationModal("export_data")}
          className="w-full bg-[#1e3a5f] text-white hover:bg-[#162a45] text-xs py-2.5 font-medium rounded-lg transition"
        >
          Récupérer mes données
        </Button>
      </div>

    </div>

    {/* Modale de confirmation */}
    {confirmationModalContent ? (
      <ConfirmationModal
        open
        title={confirmationModalContent.title}
        description={confirmationModalContent.description}
        confirmLabel={confirmationModalContent.confirmLabel}
        confirmClassName={confirmationModalContent.confirmClassName}
        onCancel={() => setActiveConfirmationModal(null)}
        onConfirm={confirmationModalContent.onConfirm}
      />
    ) : null}
  </div>
);
}
