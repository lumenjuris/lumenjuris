import { useNavigate } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

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

const MOCK_CREDITS: CreditsData = {
  creditAnalyse: 7,
  creditSignature: 1,
  creditGenerationDoc: 2,
  totalAnalyse: 10,
  totalSignature: 5,
  totalGenerationDoc: 3,
};

export function SubscriptionSettingsPanel(
  _props: Partial<SubscriptionSettingsPanelProps> = {},
) {
  const { subscription = null, credits = MOCK_CREDITS } = _props;
  const navigate = useNavigate();

  const isActive = subscription?.status === "ACTIVE";
  const isAnnual = subscription?.interval === "year";
  const priceLabel = isAnnual ? "paiement unique" : "mois";

  const expiresAtLabel = (() => {
    if (!isActive) return "Date de fin";
    return isAnnual ? "Accès valable jusqu'au" : "Prochain prélèvement";
  })();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Abonnement</h2>
        <p className="mt-1 text-sm text-gray-500">
          Gérez votre formule d'abonnement LumenJuris.
        </p>
      </div>

      {subscription === null ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center">
          <CreditCard className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-800">
            Aucun abonnement actif
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Souscrivez à un abonnement LumenJuris pour accéder à toutes les
            fonctionnalités.
          </p>
          <Button
            type="button"
            onClick={() => navigate("/souscription")}
            className="mt-4 bg-lumenjuris text-white hover:bg-lumenjuris/90"
          >
            Voir les offres
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">
                  {subscription.planName}
                </p>
                <Badge variant={subscription.status}>
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
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="hover:bg-gray-100"
            onClick={() => navigate("/souscription")}
          >
            Changer d'offre
          </Button>
          <Button
            type="button"
            variant="outline"
            className="hover:bg-gray-100"
            onClick={_props.onManageSubscriptionClick ?? (() => {})}
          >
            Gérer mon abonnement
          </Button>
        </div>
      )}
    </div>
  );
}
