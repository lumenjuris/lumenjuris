import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { XCircle, AlertCircle } from "lucide-react";
import { Button } from "../ui/Button";
import { isContractPackPaid, startContractPackCheckout } from "./contractPackApi";
import { CONTRACT_PACK_PRICE } from "./contractPackConfig";

/**
 * Page de retour Stripe après un achat ponctuel annulé (`/achat/failed?contractRef=…`).
 * Aucun débit n'a eu lieu ; le contrat reste enregistré dans la contrathèque.
 */
export function ContractPackCancelled() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const contractRef = searchParams.get("contractRef");

  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  // Contrat déjà payé (ex : dans un autre onglet) : on n'invite pas à repayer,
  // on renvoie vers la page de succès et ses documents.
  useEffect(() => {
    if (!contractRef) return;
    let isCurrent = true;
    isContractPackPaid(contractRef)
      .then((paid) => {
        if (isCurrent && paid) {
          navigate(`/achat/success?contractRef=${encodeURIComponent(contractRef)}`, { replace: true });
        }
      })
      .catch((err) => console.error("Statut d'achat indisponible :", err));
    return () => { isCurrent = false; };
  }, [contractRef, navigate]);

  // Relance le paiement du même contrat (le contenu mémorisé avant le premier essai reste valable)
  const retryPayment = async () => {
    if (!contractRef || retrying) return;
    setRetrying(true);
    setRetryError(null);
    const checkout = await startContractPackCheckout(contractRef);
    if (checkout.success) {
      window.location.href = checkout.url;
      return;
    }
    setRetryError(checkout.message);
    setRetrying(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-3xl rounded-2xl bg-blue-primary px-6 py-10 text-center shadow-sm sm:px-10">
        <div className="flex items-center justify-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-white">Paiement annulé</h1>
        </div>
        <p className="mx-auto mt-3 max-w-xl text-sm text-gray-primary">
          Votre paiement n'a pas été finalisé et aucun montant n'a été débité.
          Votre contrat reste enregistré dans votre contrathèque : vous pouvez reprendre l'achat quand vous le souhaitez.
        </p>

        {retryError && (
          <p role="alert" className="mx-auto mt-4 flex max-w-xl items-center justify-center gap-1.5 text-sm text-red-200">
            <AlertCircle className="h-4 w-4 shrink-0" /> {retryError}
          </p>
        )}

        <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          {contractRef && (
            <Button
              type="button"
              disabled={retrying}
              className="w-full bg-white text-blue-primary hover:bg-gray-300 sm:w-auto"
              onClick={() => void retryPayment()}
            >
              {retrying ? "Redirection vers le paiement…" : `Reprendre l'achat – ${CONTRACT_PACK_PRICE}`}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full text-blue-primary hover:bg-gray-300 sm:w-auto"
            onClick={() => navigate(contractRef ? `/contratheque/${contractRef}` : "/contratheque")}
          >
            Voir le contrat dans ma contrathèque
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full text-blue-primary hover:bg-gray-300 sm:w-auto"
            onClick={() => navigate("/dashboard")}
          >
            Retour au tableau de bord
          </Button>
        </div>
      </div>
    </div>
  );
}
