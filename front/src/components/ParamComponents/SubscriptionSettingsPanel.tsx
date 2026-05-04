import { useState } from "react";
import { CreditCard, Check } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { StripePaymentForm } from "./StripePaymentForm";

type SubscriptionStatus = "ACTIVE" | "CANCELLED" | "EXPIRED" | "PENDING";
export type BillingInterval = "month" | "year";

export type SubscriptionData = {
  status: SubscriptionStatus;
  planName: string;
  price: number;
  interval: BillingInterval;
  startAt: string;
  expiresAt: string;
};

export type CreditsData = {
  creditAnalyse: number;
  creditSignature: number;
  creditGenerationDoc: number;
  totalAnalyse: number;
  totalSignature: number;
  totalGenerationDoc: number;
};

type SubscriptionSettingsPanelProps = {
  subscription: SubscriptionData | null;
  credits: CreditsData | null;
  onSubscribeClick: (interval: BillingInterval) => void;
  onManageSubscriptionClick: () => void;
};

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: "Actif",
  CANCELLED: "Annulé",
  EXPIRED: "Expiré",
  PENDING: "En attente",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const formatPrice = (price: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(price / 100);

function BillingToggle({
  value,
  onChange,
}: {
  value: BillingInterval;
  onChange: (v: BillingInterval) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-gray-200 bg-gray-100 p-0.5">
      <button
        type="button"
        onClick={() => onChange("month")}
        className={`rounded-full px-4 py-1.5 text-sm transition-all ${
          value === "month"
            ? "bg-white font-medium text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Mensuel
      </button>
      <button
        type="button"
        onClick={() => onChange("year")}
        className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-all ${
          value === "year"
            ? "bg-white font-medium text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Annuel
        <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
          2 mois offerts
        </span>
      </button>
    </div>
  );
}

function CreditBar({
  label,
  used,
  total,
}: {
  label: string;
  used: number;
  total: number;
}) {
  const remaining = Math.max(0, total - used);
  const pct = total > 0 ? Math.round((remaining / total) * 100) : 0;
  const isLow = pct <= 20;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">{label}</span>
        <span
          className={isLow ? "font-semibold text-red-600" : "text-gray-500"}
        >
          {remaining} / {total}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-all ${isLow ? "bg-red-500" : "bg-lumenjuris"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const MOCK_SUBSCRIPTION: SubscriptionData = {
  status: "ACTIVE",
  planName: "Plan Essentiel",
  price: 2900,
  interval: "year",
  startAt: "2025-01-15",
  expiresAt: "2026-01-15",
};

const MOCK_CREDITS: CreditsData = {
  creditAnalyse: 7,
  creditSignature: 1,
  creditGenerationDoc: 2,
  totalAnalyse: 10,
  totalSignature: 5,
  totalGenerationDoc: 3,
};

const PRICE_MONTHLY_CENTS = 3590;
const PRICE_ANNUAL_CENTS = 35900;
const PLAN_FEATURES = [
  "Analyse de contrats illimitée",
  "Recherche Légifrance & Judilibre",
  "Génération de documents",
  "Signatures électroniques",
];

export function SubscriptionSettingsPanel(
  _props: Partial<SubscriptionSettingsPanelProps> = {},
) {
  const { subscription = null, credits = MOCK_CREDITS } = _props;
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("month");
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const isActive = subscription?.status === "ACTIVE";
  const isAnnual = subscription?.interval === "year";

  const expiresAtLabel = (() => {
    if (!isActive) return "Date de fin";
    return isAnnual ? "Accès valable jusqu'au" : "Prochain prélèvement";
  })();

  const priceLabel = isAnnual ? "paiement unique" : "mois";

  const displayMonthly = formatPrice(PRICE_MONTHLY_CENTS);
  const displayAnnual = formatPrice(PRICE_ANNUAL_CENTS);
  const displayAnnualMonthly = formatPrice(Math.round(PRICE_ANNUAL_CENTS / 12));

  if (showPaymentForm && !paymentSuccess) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Abonnement</h2>
          <p className="mt-1 text-sm text-gray-500">
            Gérez votre formule d'abonnement LumenJuris.
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-5">
          <StripePaymentForm
            interval={billingInterval}
            onBack={() => setShowPaymentForm(false)}
            onSuccess={() => setPaymentSuccess(true)}
          />
        </div>
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Abonnement</h2>
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-green-200 bg-green-50 px-6 py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-sm font-semibold text-gray-900">
            Abonnement activé !
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Votre paiement a été accepté. Vous avez maintenant accès à toutes
            les fonctionnalités LumenJuris.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Abonnement</h2>
        <p className="mt-1 text-sm text-gray-500">
          Choisissez votre formule d'abonnement LumenJuris.
        </p>
      </div>

      {subscription === null ? (
        <div className="space-y-4">
          <div className="flex justify-center">
            <BillingToggle
              value={billingInterval}
              onChange={setBillingInterval}
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Plan Essentiel
                  </p>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    {billingInterval === "year" ? (
                      <>
                        <span className="text-2xl font-bold text-gray-900">
                          {displayAnnualMonthly}
                        </span>
                        <span className="text-sm text-gray-500">/ mois</span>
                        <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          2 mois offerts
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl font-bold text-gray-900">
                          {displayMonthly}
                        </span>
                        <span className="text-sm text-gray-500">/ mois</span>
                      </>
                    )}
                  </div>
                  {billingInterval === "year" && (
                    <p className="mt-0.5 text-xs text-gray-400">
                      Facturé {displayAnnual} en une seule fois
                    </p>
                  )}
                </div>
                <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
              </div>
            </div>

            <ul className="divide-y divide-gray-50 px-5">
              {PLAN_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-2.5 py-2.5 text-sm text-gray-700"
                >
                  <Check className="h-4 w-4 shrink-0 text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>

            <div className="border-t border-gray-100 px-5 py-4">
              <Button
                type="button"
                onClick={() => setShowPaymentForm(true)}
                className="w-full bg-lumenjuris text-white hover:bg-lumenjuris/90"
              >
                Souscrire
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">
                  {subscription.planName}
                </p>
                <Badge variant={MOCK_SUBSCRIPTION.status}>
                  {STATUS_LABEL[subscription.status]}
                </Badge>
                {isAnnual && <Badge variant="ACTIVE">Annuel</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-gray-500">
                {formatPrice(subscription.price)} /{" "}
                <span className={isAnnual ? "text-gray-400" : undefined}>
                  {priceLabel}
                </span>
              </p>
            </div>
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
          </div>

          <div className="grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <div className="px-5 py-3">
              <p className="text-xs text-gray-500">Date de début</p>
              <p className="mt-0.5 text-sm font-medium text-gray-800">
                {formatDate(subscription.startAt)}
              </p>
            </div>
            <div className="px-5 py-3">
              <p className="text-xs text-gray-500">{expiresAtLabel}</p>
              <p
                className={`mt-0.5 text-sm font-medium ${!isActive ? "text-red-600" : "text-gray-800"}`}
              >
                {formatDate(subscription.expiresAt)}
              </p>
            </div>
          </div>
        </div>
      )}

      {credits !== null && (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white px-5 py-4">
          <p className="text-sm font-semibold text-gray-900">
            Crédits restants ce mois
          </p>
          <div className="space-y-3">
            <CreditBar
              label="Analyses"
              used={credits.totalAnalyse - credits.creditAnalyse}
              total={credits.totalAnalyse}
            />
            <CreditBar
              label="Signatures"
              used={credits.totalSignature - credits.creditSignature}
              total={credits.totalSignature}
            />
            <CreditBar
              label="Génération de documents"
              used={credits.totalGenerationDoc - credits.creditGenerationDoc}
              total={credits.totalGenerationDoc}
            />
          </div>
        </div>
      )}

      {subscription !== null && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            className="hover:bg-gray-100"
            onClick={() => {}}
          >
            Gérer mon abonnement
          </Button>
        </div>
      )}
    </div>
  );
}
