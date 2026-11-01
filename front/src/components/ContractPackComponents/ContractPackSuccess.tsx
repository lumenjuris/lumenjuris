import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, Loader2, AlertCircle } from "lucide-react";
import { Button } from "../ui/Button";
import { contractApi } from "../DashboardComponents/contratheque/api";
import { isContractPackPaid } from "./contractPackApi";
import { ContractPackDownloads } from "./ContractPackDownloads";

/** Délai entre deux vérifications du paiement. */
const POLL_INTERVAL_MS = 2000;
/** Nombre maximum de vérifications (15 × 2 s = 30 s). */
const MAX_POLL_ATTEMPTS = 15;

/**
 * - `checking`    : on attend que le webhook Stripe ait enregistré le paiement ;
 * - `paid`        : le backend confirme l'achat, les documents sont disponibles ;
 * - `pending`     : toujours pas confirmé après 30 s (le webhook peut arriver plus tard,
 *                   ex : paiement différé) ;
 * - `unavailable` : le backend n'a jamais répondu (service indisponible, réseau).
 */
type PaymentStatus = "checking" | "paid" | "pending" | "unavailable";

type ContractInfo = { title: string | null; plainText: string | null };

/**
 * Page de retour Stripe après un achat ponctuel (`/achat/success?contractRef=…`).
 * Le retour de Stripe ne prouve rien : seul le backend (webhook) confirme le paiement.
 */
export function ContractPackSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const contractRef = searchParams.get("contractRef");

  const [status, setStatus] = useState<PaymentStatus>("checking");
  const [contract, setContract] = useState<ContractInfo>({ title: null, plainText: null });
  // Incrémenté par « Vérifier à nouveau » pour relancer une série de vérifications
  const [checkRound, setCheckRound] = useState(0);

  useEffect(() => {
    if (!contractRef) return;
    let attempts = 0;
    let answeredOnce = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;

    setStatus("checking");

    const checkPayment = async () => {
      attempts += 1;
      try {
        const paid = await isContractPackPaid(contractRef);
        answeredOnce = true;
        if (isUnmounted) return;
        if (paid) {
          setStatus("paid");
          return;
        }
      } catch (error) {
        // Erreur ponctuelle : on retente simplement au tour suivant
        console.error(error);
      }

      if (isUnmounted) return;
      if (attempts >= MAX_POLL_ATTEMPTS) {
        setStatus(answeredOnce ? "pending" : "unavailable");
        return;
      }
      timeoutId = setTimeout(checkPayment, POLL_INTERVAL_MS);
    };

    void checkPayment();

    return () => {
      isUnmounted = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [contractRef, checkRound]);

  // Une fois payé : titre et texte du contrat, pour les documents de secours
  useEffect(() => {
    if (status !== "paid" || !contractRef) return;
    contractApi.get(contractRef)
      .then((detail) => setContract({ title: detail.title, plainText: detail.ocrText ?? null }))
      .catch((error) => console.error("Contrat introuvable en contrathèque :", error));
  }, [status, contractRef]);

  const checkAgain = useCallback(() => setCheckRound((round) => round + 1), []);
  const goToContract = () => navigate(contractRef ? `/contratheque/${contractRef}` : "/contratheque");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl rounded-2xl bg-blue-primary px-6 py-10 text-center shadow-sm sm:px-10">
        {!contractRef && (
          <StatusHeader
            icon={<AlertCircle className="h-6 w-6 text-red-600" />}
            iconBg="bg-red-100"
            title="Lien de retour incomplet"
            text="Nous ne retrouvons pas le contrat concerné. Si vous avez payé, votre achat apparaîtra dans votre contrathèque."
          />
        )}

        {contractRef && status === "checking" && (
          <StatusHeader
            icon={<Loader2 className="h-6 w-6 animate-spin text-white" />}
            iconBg="bg-white/10"
            title="Confirmation de votre paiement…"
            text="Nous attendons la confirmation de Stripe. Cela prend généralement quelques secondes."
          />
        )}

        {contractRef && status === "paid" && (
          <>
            <StatusHeader
              icon={<CheckCircle2 className="h-6 w-6 text-green-600" />}
              iconBg="bg-green-100"
              title="Paiement confirmé"
              text="Merci pour votre confiance. Vos documents sont prêts et votre facture vous est envoyée par e-mail."
            />
            <div className="mx-auto mt-6 max-w-xl rounded-panel bg-white p-5 text-left">
              <p className="mb-3 text-sm font-semibold text-ink">Vos documents</p>
              <ContractPackDownloads
                contractRef={contractRef}
                title={contract.title}
                plainText={contract.plainText}
              />
              <p className="mt-4 text-xs text-ink-muted">
                Ce contrat reste disponible dans votre contrathèque : vous pourrez retélécharger ces documents à tout moment.
              </p>
            </div>
          </>
        )}

        {contractRef && status === "pending" && (
          <StatusHeader
            icon={<Clock className="h-6 w-6 text-white" />}
            iconBg="bg-white/10"
            title="Paiement en cours de confirmation"
            text="La confirmation prend plus de temps que prévu. Si votre paiement est validé, votre contrat apparaîtra comme acheté dans votre contrathèque, avec ses documents. Vous n'avez rien à refaire : inutile de payer une seconde fois."
          />
        )}

        {contractRef && status === "unavailable" && (
          <StatusHeader
            icon={<AlertCircle className="h-6 w-6 text-amber-600" />}
            iconBg="bg-amber-100"
            title="Vérification momentanément impossible"
            text="Le service ne répond pas pour le moment. Votre paiement n'est pas perdu : réessayez dans quelques instants ou retrouvez votre contrat dans votre contrathèque."
          />
        )}

        <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          {contractRef && (status === "pending" || status === "unavailable") && (
            <Button
              type="button"
              className="w-full bg-white text-blue-primary hover:bg-gray-300 sm:w-auto"
              onClick={checkAgain}
            >
              Vérifier à nouveau
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={status === "checking" && !!contractRef}
            className="w-full text-blue-primary hover:bg-gray-300 sm:w-auto"
            onClick={goToContract}
          >
            Voir le contrat dans ma contrathèque
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={status === "checking" && !!contractRef}
            className="w-full text-blue-primary hover:bg-gray-300 sm:w-auto"
            onClick={() => navigate("/dashboard")}
          >
            Retour au tableau de bord
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Icône + titre + texte d'un état de la page. */
function StatusHeader({ icon, iconBg, title, text }: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  text: string;
}) {
  return (
    <>
      <div className="flex items-center justify-center gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
          {icon}
        </div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
      </div>
      <p className="mx-auto mt-3 max-w-xl text-sm text-gray-primary">{text}</p>
    </>
  );
}
