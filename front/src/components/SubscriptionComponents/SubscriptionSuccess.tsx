import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";
import { fetchProxy } from "../../utils/fetchProxy";
import type { SubscriptionData } from "../../types/subscriptionData";

/** Délai entre deux vérifications de l'abonnement. */
const POLL_INTERVAL_MS = 2000;
/** Nombre maximum de vérifications (15 × 2 s = 30 s). */
const MAX_POLL_ATTEMPTS = 15;

/**
 * - `pending` : on attend que le webhook Stripe ait enregistré l'abonnement ;
 * - `active`  : l'abonnement payant est bien actif en base ;
 * - `timeout` : toujours rien après 30 s (le webhook peut encore arriver plus tard).
 */
type ActivationStatus = "pending" | "active" | "timeout";

/**
 * Lit l'abonnement en base et indique s'il s'agit d'un abonnement payant actif.
 * Un checkout n'est possible que sans abonnement payant en cours (garde côté
 * backend) : un abonnement ACTIVE et gérable via Stripe est donc forcément
 * celui qui vient d'être payé.
 */
async function fetchPaidSubscription(): Promise<SubscriptionData | null> {
  const response = await fetchProxy("/api/billing/subscription", {
    method: "GET",
    credentials: "include",
  });
  const data = await response.json();
  const subscription: SubscriptionData | null = data?.data?.subscription ?? null;

  const isPaidAndActive =
    subscription?.status === "ACTIVE" && subscription.canManageBilling === true;
  return isPaidAndActive ? subscription : null;
}

export function SubscriptionSuccess() {
  const navigate = useNavigate();
  const [activationStatus, setActivationStatus] =
    useState<ActivationStatus>("pending");
  const [planName, setPlanName] = useState<string | null>(null);

  // Le paiement est validé chez Stripe, mais l'abonnement n'est enregistré
  // qu'à la réception du webhook (quelques secondes plus tard).
  // On revérifie donc régulièrement jusqu'à ce qu'il apparaisse.
  useEffect(() => {
    let attempts = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    const checkSubscription = async () => {
      attempts += 1;
      try {
        const subscription = await fetchPaidSubscription();
        if (isUnmounted) return;
        if (subscription) {
          setPlanName(subscription.planName);
          setActivationStatus("active");
          return;
        }
      } catch (error) {
        // Erreur réseau ponctuelle : on retente simplement au tour suivant
        console.error(error);
      }

      if (isUnmounted) return;
      if (attempts >= MAX_POLL_ATTEMPTS) {
        setActivationStatus("timeout");
        return;
      }
      timeoutId = setTimeout(checkSubscription, POLL_INTERVAL_MS);
    };

    void checkSubscription();

    return () => {
      isUnmounted = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const goToBillingSettings = () =>
    navigate("/mon-compte", { state: { tab: "subscription" } });

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
          Merci pour votre confiance. Vous recevrez votre facture par e-mail.
        </p>

        {/* État d'activation de l'abonnement */}
        <div className="mx-auto mt-6 flex max-w-xl items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-3 text-sm text-white">
          {activationStatus === "pending" && (
            <>
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              <span>Activation de votre abonnement en cours…</span>
            </>
          )}
          {activationStatus === "active" && (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-300" />
              <span>
                Votre abonnement <strong>{planName}</strong> est actif. Vos
                crédits sont disponibles.
              </span>
            </>
          )}
          {activationStatus === "timeout" && (
            <>
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                L'activation prend plus de temps que prévu. Votre abonnement
                apparaîtra d'ici quelques minutes dans Mon compte → Facturation.
              </span>
            </>
          )}
        </div>

        <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Button
            type="button"
            disabled={activationStatus === "pending"}
            className="w-full bg-white text-blue-primary hover:bg-gray-300 sm:w-auto"
            onClick={() => navigate("/dashboard")}
          >
            Aller sur mon tableau de bord
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={activationStatus === "pending"}
            className="w-full text-blue-primary hover:bg-gray-300 sm:w-auto"
            onClick={goToBillingSettings}
          >
            Voir mon abonnement
          </Button>
        </div>
      </div>
    </div>
  );
}
