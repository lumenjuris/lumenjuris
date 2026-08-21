import { useNavigate } from "react-router-dom";
import { XCircle } from "lucide-react";
import { Button } from "../ui/Button";

/**
 * Page d'atterrissage après un paiement annulé ou échoué sur Stripe Checkout.
 * (URL d'annulation configurée côté backend dans `createCheckout`.)
 *
 * Aucun débit n'a eu lieu : l'utilisateur peut simplement réessayer.
 */
export function SubscriptionFailed() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-5xl rounded-2xl border border-green-200 bg-blue-primary px-6 py-12 text-center shadow-sm">
        <div className="flex items-center justify-center gap-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <XCircle className="h-6 w-6 text-red-600" />
        </div>

        <h1 className="text-xl font-bold text-white">Paiement non abouti</h1>
        </div>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-gray-primary">
          Votre paiement a été annulé ou n'a pas pu aboutir. Aucun montant n'a
          été débité — vous pouvez réessayer à tout moment.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 w-full sm:flex-row sm:gap-4">
          <Button
            type="button"
            className="w-full bg-white text-blue-primary hover:bg-gray-300 sm:w-auto"
            onClick={() => navigate("/souscription")}
          >
            Revenir aux offres
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
