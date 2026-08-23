import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Download, FileText, Loader2, Search, CheckCircle2 } from "lucide-react";
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
import { QuotasDisplay } from "../common/QuotasDisplay";
import type {
  SubscriptionData,
  SubscriptionStatus,
} from "../../types/subscriptionData";
import type { CreditsData } from "../../types/creditsData";
import { useSubscriptionPortal } from "../../hooks/useSubscription";

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: "Actif",
  CANCELLED: "Annulé",
  EXPIRED: "Expiré",
  PENDING: "En attente",
};

/** Une facture telle que renvoyée par GET /api/billing/invoices. */
type Invoice = {
  id: number;
  invoiceNumber: string;
  date: string;
  amountCents: number;
  status: string;
  planName: string;
};

export function SubscriptionSettingsPanel() {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(
    null,
  );
  const [credits, setCredits] = useState<CreditsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const { handleManageBilling, portalLoading, portalError } = useSubscriptionPortal();

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

  const fetchInvoices = useCallback(() => {
    setInvoicesLoading(true);
    fetchProxy("/api/billing/invoices", {
      method: "GET",
      credentials: "include",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) setInvoices(data.data);
      })
      .catch(console.error)
      .finally(() => setInvoicesLoading(false));
  }, []);

  useEffect(() => {
    fetchSubscription();
    fetchInvoices();
  }, [fetchSubscription, fetchInvoices]);

  const handleDownloadInvoice = async (invoice: Invoice) => {
    setDownloadingId(invoice.id);
    try {
      const res = await fetchProxy(`/api/billing/invoices/${invoice.id}/pdf`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCreditSuccess = () => {
    setDialogOpen(false);
    fetchSubscription();
  };

  // Ouvre le Stripe Customer Portal (gestion de l'abonnement en self-service).
  // const handleManageBilling = async () => {
  //   setPortalError(null);
  //   setPortalLoading(true);
  //   try {
  //     const res = await fetchProxy("/api/billing/portal", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       credentials: "include",
  //     });
  //     const data = await res.json();
  //     if (data.success && data.url) {
  //       window.location.href = data.url; // redirection vers le portail Stripe
  //       return;
  //     }
  //     setPortalError(
  //       typeof data?.message === "string"
  //         ? data.message
  //         : "Impossible d'ouvrir le portail. Réessayez.",
  //     );
  //   } catch (e) {
  //     console.error(e);
  //     setPortalError("Une erreur est survenue. Réessayez.");
  //   }
  //   setPortalLoading(false);
  // };

  const isActive = subscription?.status === "ACTIVE";
  const isAnnual = subscription?.interval === "yearly";
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
            Gérez votre formule d'abonnement Lumen Juris.
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
          Gérez votre formule d'abonnement Lumen Juris.
        </p>
      </div>

      {subscription === null ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center">
          <CreditCard className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-800">
            Aucun abonnement actif
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Souscrivez à un abonnement Lumen Juris pour accéder à toutes les
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

          {subscription.canManageBilling && (
            <div className="border-t border-gray-100 px-5 py-3">
              <Button
                type="button"
                variant="outline"
                disabled={portalLoading}
                onClick={handleManageBilling}
                className="w-full hover:bg-gray-100"
              >
                {portalLoading ? "Ouverture…" : "Gérer mon abonnement"}
              </Button>
              {portalError && (
                <p className="mt-2 text-xs text-red-600">{portalError}</p>
              )}
            </div>
          )}
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

          <QuotasDisplay quotas={credits.quotas} planQuotas={credits.planQuotas} />
        </div>
      )}

      {/* Factures */}
      <InvoicesSection
        invoices={invoices}
        loading={invoicesLoading}
        downloadingId={downloadingId}
        onDownload={handleDownloadInvoice}
      />

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

// ─── Section Factures ─────────────────────────────────────────────────────────

const INVOICES_INITIAL_VISIBLE = 6;

/**
 * Liste des factures avec recherche, pastille de statut et « voir tout ».
 * S'inspire des sections de facturation classiques (Stripe / Linear) : table
 * lisible, montants alignés à droite, numéro en monospace.
 */
function InvoicesSection({
  invoices,
  loading,
  downloadingId,
  onDownload,
}: {
  invoices: Invoice[];
  loading: boolean;
  downloadingId: number | null;
  onDownload: (invoice: Invoice) => void;
}) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? invoices.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.planName.toLowerCase().includes(q) ||
          formatPrice(inv.amountCents).toLowerCase().includes(q),
      )
    : invoices;
  const visible = showAll ? filtered : filtered.slice(0, INVOICES_INITIAL_VISIBLE);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Factures</h2>
          <p className="mt-1 text-sm text-gray-500">
            Retrouvez et téléchargez vos factures au format PDF.
          </p>
        </div>
        {invoices.length > 0 && (
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowAll(false);
              }}
              placeholder="Rechercher une facture…"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-lumenjuris focus:outline-none focus:ring-1 focus:ring-lumenjuris"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white py-8">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : invoices.length === 0 ? (
        <EmptyInvoices
          icon={FileText}
          title="Aucune facture"
          detail="Vos factures apparaîtront ici après votre premier paiement."
        />
      ) : filtered.length === 0 ? (
        <EmptyInvoices
          icon={Search}
          title="Aucun résultat"
          detail={`Aucune facture ne correspond à « ${query.trim()} ».`}
        />
      ) : (
        <>
          {/* En-tête de colonnes (desktop) */}
          <div className="hidden grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 sm:grid">
            <span>Facture</span>
            <span className="text-right">Montant</span>
            <span className="text-center">Statut</span>
            <span className="text-right">PDF</span>
          </div>

          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {visible.map((invoice) => (
              <div
                key={invoice.id}
                className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50 sm:grid-cols-[1fr_auto_auto_auto] sm:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400 sm:flex">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-medium text-gray-900">
                      {invoice.invoiceNumber}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {formatDate(invoice.date)} · {invoice.planName}
                    </p>
                  </div>
                </div>

                <p className="text-right text-sm font-semibold text-gray-800 sm:min-w-[90px]">
                  {formatPrice(invoice.amountCents)}
                </p>

                <div className="hidden justify-center sm:flex">
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Payée
                  </span>
                </div>

                <div className="col-span-2 flex justify-end sm:col-span-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 gap-1.5 text-xs hover:bg-gray-100"
                    disabled={downloadingId === invoice.id}
                    onClick={() => onDownload(invoice)}
                  >
                    {downloadingId === invoice.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {filtered.length > INVOICES_INITIAL_VISIBLE && (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-gray-500">
                {showAll
                  ? `${filtered.length} facture${filtered.length > 1 ? "s" : ""}`
                  : `${Math.min(INVOICES_INITIAL_VISIBLE, filtered.length)} sur ${filtered.length}`}
              </span>
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="text-xs font-medium text-lumenjuris hover:underline"
              >
                {showAll ? "Réduire" : `Voir tout (${filtered.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** État vide réutilisable (aucune facture / aucun résultat de recherche). */
function EmptyInvoices({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof FileText;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center">
      <Icon className="mb-3 h-8 w-8 text-gray-300" />
      <p className="text-sm font-medium text-gray-800">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{detail}</p>
    </div>
  );
}
