import { Elements } from "@stripe/react-stripe-js";
// Variante « pure » : l'import seul n'insère pas le script de Stripe dans la page.
import { loadStripe } from "@stripe/stripe-js/pure";
import type { Stripe } from "@stripe/stripe-js";
import { ArrowLeft } from "lucide-react";
import { Button } from "../ui/Button";
import { BillingForm } from "./BillingForm";
import { BillingInterval } from "../../types/subscriptionData";
import type { CreditsPayload } from "../../types/creditsData";

// Le script de Stripe (≈ 250 Ko) n'est chargé qu'à l'ouverture du formulaire de
// paiement : appelé au chargement du module, il ralentissait l'ouverture de tout le site.
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(): Promise<Stripe | null> {
  stripePromise ??= loadStripe(import.meta.env.VITE_STRIPE_CLIENT ?? "");
  return stripePromise;
}

type BillingStripePanelProps = {
  planName: string;
  price: number;
  interval?: BillingInterval;
  onBack: () => void;
  onSuccess: (
    planName: string,
    interval: BillingInterval,
    price: number,
  ) => void;
  onError?: () => void;
  mode?: "plan" | "credits";
  creditsPayload?: CreditsPayload;
};

/**
 * Stripe context avec wrapping de `BillingForm`.
 *
 * Ce composant a deux responsabilités :
 * 1. Initialiser le SDK Stripe via `loadStripe`
 * 2. Afficher un message d'avertissement si la variable d'environnement
 *    `VITE_STRIPE_CLIENT` est absente, sans bloquer l'exécution de l'application.
 *
 * @param planName        Nom du plan ou libellé de l'achat, transmis à `BillingForm`.
 * @param price           Prix en centimes, transmis à `BillingForm` et utilisé comme `key` du contexte Stripe.
 * @param interval        Périodicité de l'abonnement. Optionnel en mode `"credits"`.
 * @param onBack          Callback déclenché par le bouton "Retour" de `BillingForm`.
 * @param onSuccess       Callback appelé après paiement réussi.
 * @param onError         Callback optionnel appelé si le paiement échoue.
 * @param mode            `"plan"` ou `"credits"`. Transmis à `BillingForm`.
 * @param creditsPayload  Payload de crédits à ajouter. Utilisé uniquement en mode `"credits"`.
 */
export function BillingStripePanel({
  planName,
  price,
  interval,
  onBack,
  onSuccess,
  onError,
  mode,
  creditsPayload,
}: BillingStripePanelProps) {
  const options = {
    appearance: { theme: "stripe" as const },
  };

  if (!import.meta.env.VITE_STRIPE_CLIENT) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            type="button"
            onClick={onBack}
            className="text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
        </div>
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Paiement non disponible — clé Stripe manquante (
          <code>VITE_STRIPE_PUBLISHABLE_KEY</code>).
        </div>
      </div>
    );
  }

  return (
    <Elements stripe={getStripe()} options={options} key={price}>
      <BillingForm
        planName={planName}
        price={price}
        interval={interval}
        onBack={onBack}
        onSuccess={onSuccess}
        onError={onError}
        mode={mode}
        creditsPayload={creditsPayload}
      />
    </Elements>
  );
}
