import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Check, FolderPlus, Loader2 } from "lucide-react";
import { contractApi } from "../DashboardComponents/contratheque/api";
import type { ContractAnalysis } from "../../types";
import type { AnalysisContext } from "../../types/contextualAnalysis";
import { BANNER_ACTION_CLASS } from "../common/PageBanner";

/**
 * Enregistre le contrat analysé dans la contrathèque.
 * Reprend le texte extrait (`ocrText` → recherche plein texte + veille par type)
 * et le type de contrat détecté. Statut initial DRAFT : c'est un import à
 * compléter, pas un contrat validé.
 */
interface PropsBtn {
  contract: ContractAnalysis;
  context?: AnalysisContext | null;
}

export function AddToContrathequeButton({ contract, context }: PropsBtn) {

  const navigate = useNavigate();
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Bouton du bandeau bleu : même style que tous les boutons d'en-tête.
  const btnPrimary = BANNER_ACTION_CLASS;

  const btnDone = `${btnPrimary}`;

  const handleAdd = async () => {
    if (state === "saving") return;
    setState("saving");
    try {
      const title =
        (contract.fileName || "Contrat analysé").replace(/\.[^.]+$/, "").trim() ||
        "Contrat analysé";
      const contractType =
        (context?.contractType || contract.contractType || "").trim() || null;

      const { id } = await contractApi.create({
        title,
        contractType,
        ocrText: contract.content,
        status: "DRAFT",
      });
      setCreatedId(id);
      setState("done");
      toast.success("Ajouté à la contrathèque.");
    } catch (e) {
      setState("idle");
      const msg = e instanceof Error ? e.message : "";
      toast.error(
        /403|éditeur|editor/i.test(msg)
          ? "Réservé aux rôles Juriste et Administrateur."
          : "Échec de l'ajout à la contrathèque.",
      );
    }
  };

  if (state === "done" && createdId) {
    return (
      <button
        onClick={() => navigate(`/contratheque/${createdId}`)}
        className={btnDone}
        title="Ouvrir la fiche dans la contrathèque"
      >
        <Check className="w-4 h-4" />
        Voir dans la contrathèque
      </button>
    );
  }

  return (
    <button
      onClick={handleAdd}
      disabled={state === "saving"}
      className={state === "saving" ? btnPrimary : btnDone}
      title="Enregistrer ce contrat dans la contrathèque"
    >
      {state === "saving" ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <FolderPlus className="w-4 h-4" />
      )}
      {state === "saving" ? "Ajout…" : "Ajouter à la contrathèque"}
    </button>
  );
}
