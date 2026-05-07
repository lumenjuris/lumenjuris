import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { ArrowLeft } from "lucide-react";
import { Button } from "../ui/Button";

import { BillingForm } from "./BillingForm";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_CLIENT ?? "");

type BillingInterval = "month" | "year";

type BillingStripePanelProps = {
  planName: string;
  price: number;
  interval: BillingInterval;
  onBack: () => void;
  onSuccess: () => void;
};

export function BillingStripePanel({
  planName,
  price,
  interval,
  onBack,
  onSuccess,
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
    <Elements stripe={stripePromise} options={options} key={price}>
      <BillingForm
        planName={planName}
        price={price}
        interval={interval}
        onBack={onBack}
        onSuccess={onSuccess}
      />
    </Elements>
  );
}
