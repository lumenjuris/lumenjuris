import { useState } from "react";
import {
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Lock, ArrowLeft } from "lucide-react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Label } from "../ui/Label";
import { formatPrice } from "../../utils/format/formatPrice";
import type { BillingInterval } from "../../types/subscriptionData";
import type { CreditsPayload } from "../../types/creditsData";
import { fetchProxy } from "../../utils/fetchProxy";


const PROXY_URL: string =
  import.meta.env.VITE_URL_PROXY || "http://localhost:3000";

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: "14px",
      color: "#111827",
      fontFamily: "inherit",
      "::placeholder": { color: "#9ca3af" },
    },
    invalid: { color: "#dc2626" },
  },
};

type BillingFormProps = {
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
 * Crée ou récupère le client Stripe associé à l'utilisateur connecté.
 * Appelle `POST /api/billing/customer` et retourne le `stripeCustomerId`,
 * ou `null` en cas d'échec (profil de paiement introuvable / erreur serveur).
 */
async function ensureStripeCustomer(): Promise<string | null> {
  const res = await fetch(`${PROXY_URL}/api/billing/customer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  const data = await res.json();
  if (!data.success) return null;
  return data.stripeCustomerId as string;
}



/**
 * Crée un PaymentIntent Stripe côté serveur pour le montant donné.
 * Retourne le `clientSecret` nécessaire à `stripe.confirmCardPayment`,
 * ou `null` si l'initialisation échoue.
 *
 * @param amount Montant en centimes (ex : 2900 pour 29,00 €).
 */
async function createPaymentIntent(amount: number): Promise<string | null> {
  const res = await fetch(`${PROXY_URL}/api/billing/payment-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ amount, automaticPayment: true }),
  });
  const data = await res.json();
  if (!data.success || !data.clientSecret) return null;
  return data.clientSecret as string;
}






/**
 * Signale au backend une tentative de paiement échouée (suivi admin).
 * Best-effort : fire-and-forget, n'impacte jamais le parcours utilisateur.
 */
function reportPaymentFailure(
  amount: number,
  stripePaymentIntentId: string,
): void {
  void fetchProxy("/api/billing/payment-failed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ amount, stripePaymentIntentId }),
  }).catch((err) =>
    console.error("Erreur lors du signalement du paiement échoué:", err),
  );
}

/**
 * Crédite le compte de l'utilisateur après un paiement réussi.
 * Best-effort : l'erreur est loguée sans interrompre le flux.
 */
async function addCreditsToAccount(payload: CreditsPayload): Promise<void> {
  await fetch(`${PROXY_URL}/api/billing/add-credits`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  }).catch((err) => console.error("Erreur lors de l'ajout des crédits:", err));
}

/**
 * Formulaire de paiement par carte bancaire, alimenté par les éléments Stripe
 * (`CardNumberElement`, `CardExpiryElement`, `CardCvcElement`).
 * Doit être rendu à l'intérieur d'un `<Elements>` Stripe (voir `BillingStripePanel`).
 *
 * **Pipeline de paiement en 4 étapes** :
 * 1. `ensureStripeCustomer` — crée ou récupère le profil Stripe de l'utilisateur.
 * 2. `createPaymentIntent` — génère un `clientSecret` côté serveur pour le montant calculé.
 * 3. `stripe.confirmCardPayment` — soumet la carte ; en cas d'erreur Stripe, le flux s'arrête ici.
 * 4. Selon `mode` :
 *    - `"plan"` → `saveSubscription` enregistre l'abonnement en BDD.
 *    - `"credits"` → `addCreditsToAccount` crédite le compte utilisateur.
 *
 * @param planName        Nom affiché dans le récapitulatif de commande.
 * @param price           Prix de base en centimes.
 * @param interval        Périodicité de l'abonnement (`"month"` | `"year"`). Non utilisé en mode `"credits"`.
 * @param onBack          Callback déclenché par le bouton "Retour", pour revenir à la sélection.
 * @param onSuccess       Callback appelé après paiement et enregistrement réussis.
 * @param onError         Callback optionnel appelé si `stripe.confirmCardPayment` échoue.
 * @param mode            `"plan"` (abonnement) ou `"credits"` (achat ponctuel). Défaut : `"plan"`.
 * @param creditsPayload  Payload envoyé à `addCreditsToAccount` en mode `"credits"`. Ignoré en mode `"plan"`.
 */
export function BillingForm({
  planName,
  price,
  interval,
  onBack,
  onSuccess,
  onError,
  mode = "plan",
  creditsPayload,
}: BillingFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardholderName, setCardholderName] = useState("");

  const isCreditsMode = mode === "credits";
  const annualPrice = price * 12;
  const paymentAmount =
    !isCreditsMode && interval === "yearly" ? annualPrice : price;

  const priceLabel = isCreditsMode
    ? `${formatPrice(price)} — paiement unique`
    : interval === "yearly"
      ? `${formatPrice(annualPrice)} — paiement unique`
      : `${formatPrice(price)} / mois`;

  const intervalLabel = isCreditsMode
    ? "Achat ponctuel de crédits"
    : interval === "yearly"
      ? "Abonnement annuel"
      : "Abonnement mensuel";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setIsLoading(true);
    setError(null);

    const cardNumber = elements.getElement(CardNumberElement);
    if (!cardNumber) {
      setIsLoading(false);
      return;
    }

    // 1. S'assurer que le customer Stripe existe
    const customerId = await ensureStripeCustomer();
    if (!customerId) {
      setError("Impossible de créer le profil de paiement. Réessayez.");
      setIsLoading(false);
      return;
    }

    // 2. Créer le PaymentIntent côté serveur
    const clientSecret = await createPaymentIntent(paymentAmount);
    if (!clientSecret) {
      setError("Impossible d'initialiser le paiement. Réessayez.");
      setIsLoading(false);
      return;
    }

    // 3. Confirmer le paiement avec la carte saisie
    const { error: confirmError } = await stripe.confirmCardPayment(
      clientSecret,
      {
        payment_method: {
          card: cardNumber,
          billing_details: { name: cardholderName },
        },
      },
    );

    if (confirmError) {
      setError(confirmError.message ?? "Le paiement a échoué. Réessayez.");
      reportPaymentFailure(paymentAmount, clientSecret.split("_secret_")[0]);
      setIsLoading(false);
      onError?.();
      return;
    }

    // 4. Créditer le compte. BillingForm n'est plus utilisé qu'en mode "credits" :
    // l'ancien chemin "plan" (saveSubscription) est OBSOLÈTE — les abonnements
    // passent désormais par Stripe Checkout (voir PlansPanel).
    if (isCreditsMode && creditsPayload) {
      await addCreditsToAccount(creditsPayload);
    }

    setIsLoading(false);
    onSuccess(planName, interval ?? "monthly", paymentAmount);
  };

  return (
    <div className="space-y-5">
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

      <div>
        <h3 className="text-sm font-semibold text-gray-900">
          Récapitulatif de commande
        </h3>
        <div className="mt-2 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-800">{planName}</p>
            <p className="text-xs text-gray-500">{intervalLabel}</p>
          </div>
          <p className="text-sm font-semibold text-gray-900">{priceLabel}</p>
        </div>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-gray-700">
            Nom sur la carte
          </Label>
          <Input
            type="text"
            value={cardholderName}
            onChange={(event) => setCardholderName(event.target.value)}
            placeholder="Jean Dupont"
            required
            className="text-gray-900 placeholder:text-gray-400"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-700">
            Numéro de carte
          </label>
          <div className="rounded-lg border border-gray-200 px-3 py-2.5">
            <CardNumberElement options={CARD_ELEMENT_OPTIONS} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">
              Date d'expiration
            </label>
            <div className="rounded-lg border border-gray-200 px-3 py-2.5">
              <CardExpiryElement options={CARD_ELEMENT_OPTIONS} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-700">
              CVC
            </label>
            <div className="rounded-lg border border-gray-200 px-3 py-2.5">
              <CardCvcElement options={CARD_ELEMENT_OPTIONS} />
            </div>
          </div>
        </div>

        <Button
          type="submit"
          disabled={!stripe || isLoading}
          className="w-full bg-lumenjuris text-white hover:bg-lumenjuris/90 disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              Traitement…
            </span>
          ) : (
            `Payer ${formatPrice(paymentAmount)}`
          )}
        </Button>
      </form>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
        <Lock className="h-3.5 w-3.5" />
        Paiement sécurisé par Stripe
      </p>
    </div>
  );
}
