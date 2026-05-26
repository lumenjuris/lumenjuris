import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "../ui/Button";
import { BillingStripePanel } from "./BillingStripePanel";
import { AlertBanner } from "../common/AlertBanner";
import { formatPrice } from "../../utils/format/formatPrice";

const BLOCK_SIZE = 100;
const PRICE_PER_BLOCK = 500;

type View = "select" | "pay" | "result";
type PaymentResult = "success" | "error";

type CreditsPanelProps = {
  onSuccess: () => void;
  onClose: () => void;
};

export function CreditsPanel({ onSuccess, onClose }: CreditsPanelProps) {
  const [view, setView] = useState<View>("select");
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(
    null,
  );
  const [blocks, setBlocks] = useState(0);

  const increment = () => setBlocks((prev) => prev + 1);
  const decrement = () => setBlocks((prev) => Math.max(0, prev - 1));

  const totalCredits = blocks * BLOCK_SIZE;
  const totalPrice = blocks * PRICE_PER_BLOCK;
  const isEmpty = blocks === 0;

  const creditsPayload = { addCredit: totalCredits };
  const planLabel = `${totalCredits} crédits`;

  const handlePaymentSuccess = () => {
    setPaymentResult("success");
    setView("result");
  };

  const handlePaymentError = () => {
    setPaymentResult("error");
    setView("result");
  };

  if (view === "result" && paymentResult !== null) {
    const isSuccess = paymentResult === "success";
    return (
      <AlertBanner
        variant={isSuccess ? "success" : "error"}
        accent
        title={
          isSuccess
            ? "Paiement accepté — crédits ajoutés !"
            : "Le paiement a échoué"
        }
        detail={
          isSuccess
            ? "Vos nouveaux crédits sont immédiatement disponibles sur votre compte."
            : "Vérifiez vos informations bancaires et réessayez."
        }
        onClose={isSuccess ? onSuccess : onClose}
      />
    );
  }

  if (view === "pay") {
    return (
      <BillingStripePanel
        planName={planLabel || "Crédits supplémentaires"}
        price={totalPrice}
        mode="credits"
        creditsPayload={creditsPayload}
        onBack={() => setView("select")}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Sélectionnez le nombre de crédits à ajouter.
      </p>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800">Crédits</p>
            <p className="text-xs text-gray-400">
              +{BLOCK_SIZE} crédits / ajout — {formatPrice(PRICE_PER_BLOCK)} / ajout
            </p>
          </div>

          <div className="ml-4 flex items-center gap-2">
            <button
              type="button"
              onClick={decrement}
              disabled={blocks === 0}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>

            <span className="w-6 text-center text-sm font-semibold text-gray-900 tabular-nums">
              {blocks}
            </span>

            <button
              type="button"
              onClick={increment}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-lumenjuris/40 bg-lumenjuris/5 text-lumenjuris transition hover:bg-lumenjuris/10"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Total */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <span className="text-sm font-medium text-gray-700">Total TTC</span>
        <span className="text-sm font-bold text-gray-900">
          {isEmpty ? "—" : formatPrice(totalPrice)}
        </span>
      </div>

      <Button
        type="button"
        disabled={isEmpty}
        onClick={() => setView("pay")}
        className="w-full bg-lumenjuris text-white hover:bg-lumenjuris/90 disabled:opacity-40"
      >
        Valider et payer
      </Button>
    </div>
  );
}
