import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "../ui/Button";
import { useSubscriptionPortal } from "../../hooks/useSubscription";

export function SubscriptionSuccess() {
  const navigate = useNavigate();
  const { handleManageBilling, portalLoading, portalError } = useSubscriptionPortal();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-5xl rounded-2xl border border-green-200 bg-blue-primary px-6 py-12 text-center shadow-sm">
        <div className="flex items-center justify-center gap-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-white">Paiement confirmé !</h1>
        </div>

        <p className="mx-auto mt-2 max-w-2xl text-sm text-gray-primary">
          Merci pour votre confiance. Votre abonnement est en cours d'activation
          — cela peut prendre quelques secondes. Vous recevrez votre facture par email.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 w-full sm:flex-row sm:gap-4">
          <Button
            type="button"
            className="w-full bg-white text-blue-primary hover:bg-gray-300 sm:w-auto"
            onClick={() => navigate("/dashboard")}
          >
            Aller sur mon tableau de bord
          </Button>
          
          <Button
            type="button"
            variant="outline"
            disabled={portalLoading}
            className="w-full text-blue-primary hover:bg-gray-300 sm:w-auto"
            onClick={handleManageBilling}
          >
            {portalLoading ? "Chargement..." : "Voir mon abonnement"}
          </Button>
        </div>
        {portalError && (
            <p className="w-full text-center text-xs text-red-300 mt-2">{portalError}</p>
        )}
      </div>
    </div>
  );
}
