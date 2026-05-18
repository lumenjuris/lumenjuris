import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/Dialog";
import { fetchProxy } from "../../utils/fetchProxy";
import { CreditsPanel } from "../SubscriptionComponents/CreditsPanel";
import { formatPrice } from "../../utils/format/formatPrice";
import { formatDate } from "../../utils/format/formatDate";
import { CreditBar } from "../common/CreditBar";
import type {
  SubscriptionData,
  SubscriptionStatus,
} from "../../types/subscriptionData";
import type { CreditsData } from "../../types/creditsData";

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: "Actif",
  CANCELLED: "Annulé",
  EXPIRED: "Expiré",
  PENDING: "En attente",
};

export function SubscriptionSettingsPanel() {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(
    null,
  );
  const [credits, setCredits] = useState<CreditsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchSubscription = useCallback(() => {
    fetchProxy("/api/billing/subscription", {
      method: "GET",
      credentials: "include",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setSubscription(data.data.subscription ?? null);
          setCredits(data.data.credits ?? null);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const handleCreditSuccess = () => {
    setDialogOpen(false);
    fetchSubscription();
  };

  const isActive = subscription?.status === "ACTIVE";
  const isAnnual = subscription?.interval === "year";
  const priceLabel = isAnnual ? "paiement unique" : "mois";

  const expiresAtLabel = (() => {
    if (!isActive) return "Date de fin";
    return isAnnual ? "Accès valable jusqu'au" : "Prochain prélèvement";
  })();

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Abonnement</h2>
          <p className="mt-1 text-sm text-gray-500">
            Gérez votre formule d'abonnement LumenJuris.
          </p>
        </div>
        <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

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
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">
              Crédits restants ce mois
            </p>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    className="text-xs hover:bg-gray-100"
                  >
                    Ajouter des crédits
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Ajouter des crédits</DialogTitle>
                </DialogHeader>
                <CreditsPanel
                  onSuccess={handleCreditSuccess}
                  onClose={() => setDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            <CreditBar
              label="Crédits inclus"
              used={credits.totalIncluded - credits.creditIncluded}
              total={credits.totalIncluded}
            />
            {credits.creditAdded > 0 && (
              <CreditBar
                label="Crédits achetés"
                used={0}
                total={credits.creditAdded}
              />
            )}
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
        </div>
      )}
    </div>
  );
}
