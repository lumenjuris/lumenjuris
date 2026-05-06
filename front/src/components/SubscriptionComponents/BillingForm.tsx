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

type BillingInterval = "month" | "year";

type BillingFormProps = {
  planName: string;
  price: number;
  interval: BillingInterval;
  onBack: () => void;
  onSuccess: () => void;
};

async function ensureStripeCustomer(): Promise<string | null> {
  const res = await fetch("/api/billing/customer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  const data = await res.json();
  if (!data.success) return null;
  return data.stripeCustomerId as string;
}

async function createPaymentIntent(amount: number): Promise<string | null> {
  const res = await fetch("/api/billing/payment-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ amount, automaticPayment: true }),
  });
  const data = await res.json();
  if (!data.success || !data.clientSecret) return null;
  return data.clientSecret as string;
}

export function BillingForm({
  planName,
  price,
  interval,
  onBack,
  onSuccess,
}: BillingFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardholderName, setCardholderName] = useState("");

  const priceLabel =
    interval === "year"
      ? `${formatPrice(price)} — paiement unique (12 mois)`
      : `${formatPrice(price)} / mois`;

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
    const clientSecret = await createPaymentIntent(price);
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
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    onSuccess();
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
            <p className="text-xs text-gray-500">
              {interval === "year" ? "Abonnement annuel" : "Abonnement mensuel"}
            </p>
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
            `Payer ${formatPrice(price)}`
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
