import { useState } from "react";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Lock, ArrowLeft } from "lucide-react";
import { Button } from "../ui/Button";
import type { BillingInterval } from "./SubscriptionSettingsPanel";
import { Input } from "../ui/Input";
import { Label } from "../ui/Label";

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "",
);

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

const PRICE_MONTHLY = 3590;
const PRICE_ANNUAL = 35900;

function formatPrice(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

type PaymentFormInnerProps = {
  interval: BillingInterval;
  onBack: () => void;
  onSuccess: () => void;
};

function PaymentFormInner({
  interval,
  onBack,
  onSuccess,
}: PaymentFormInnerProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardholderName, setCardholderName] = useState("");

  const price = interval === "year" ? PRICE_ANNUAL : PRICE_MONTHLY;
  const priceLabel =
    interval === "year"
      ? `${formatPrice(PRICE_ANNUAL)} — paiement unique (12 mois)`
      : `${formatPrice(PRICE_MONTHLY)} / mois`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsLoading(true);
    setError(null);

    const cardNumber = elements.getElement(CardNumberElement);
    if (!cardNumber) {
      setIsLoading(false);
      return;
    }

    const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
      type: "card",
      card: cardNumber,
      billing_details: { name: cardholderName },
    });

    if (pmError) {
      setError(pmError.message ?? "Une erreur est survenue.");
      setIsLoading(false);
      return;
    }

    console.log(
      "PaymentMethod created:",
      paymentMethod.id,
      "interval:",
      interval,
    );

    setIsLoading(false);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          type="button"
          onClick={onBack}
          className=" text-gray-500 hover:text-gray-700"
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
            <p className="text-sm font-medium text-gray-800">Plan Essentiel</p>
            <p className="text-xs text-gray-500">
              {interval === "year" ? "Abonnement annuel" : "Abonnement mensuel"}
            </p>
          </div>
          <p className="text-sm font-semibold text-gray-900">{priceLabel}</p>
        </div>
      </div>

      <div className="space-y-3">
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
            className=" text-gray-900 placeholder:text-gray-400"
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
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

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

      <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
        <Lock className="h-3.5 w-3.5" />
        Paiement sécurisé par Stripe
      </p>
    </form>
  );
}

type StripePaymentFormProps = {
  interval: BillingInterval;
  onBack: () => void;
  onSuccess: () => void;
};

export function StripePaymentForm({
  interval,
  onBack,
  onSuccess,
}: StripePaymentFormProps) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentFormInner
        interval={interval}
        onBack={onBack}
        onSuccess={onSuccess}
      />
    </Elements>
  );
}
