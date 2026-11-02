import { fetchProxy } from "../../utils/fetchProxy";
import type { JNode } from "../DashboardComponents/cdd/smart/contractExport";

/**
 * Achat ponctuel d'un contrat (« Pack Contrat ») : appels au backend.
 *
 * Le paiement suit le même principe que les abonnements (voir PlansPanel) :
 * 1. `POST /billing/create-one-shot-checkout` crée une session Stripe Checkout ;
 * 2. le front redirige vers la page hébergée par Stripe ;
 * 3. le paiement n'est acquis que lorsque le webhook l'a enregistré en base :
 *    seul le backend fait foi, jamais le retour Stripe.
 * Après paiement, le backend génère les livrables (PDF, Word, fiche de synthèse),
 * les envoie par e-mail et les sert au téléchargement.
 */

/** Article vendu à l'unité côté backend (enum Prisma ItemVente). */
export const CONTRACT_PACK_ITEM = "CONTRACT_SANS_FILIGRANE";

/** Documents livrés avec un achat (enum Prisma LivrableKind). */
export type ContractPackFileKind = "PDF" | "DOCX" | "FICHE";

/** Achat payé, tel que renvoyé par `GET /billing/one-shot/purchases`. */
export type ContractPackPurchase = {
  idBilling: number;
  item: string;
  contractRef: string;
  paidAt: string | null;
  /** PENDING : documents en préparation · READY : prêts · FAILED : régénérés au téléchargement */
  deliveryStatus: "PENDING" | "READY" | "FAILED";
  emailSentAt: string | null;
  availableFiles: ContractPackFileKind[];
};

export type CheckoutResult =
  | { success: true; url: string }
  | { success: false; message: string };

/**
 * Crée la session de paiement Stripe pour un contrat enregistré en contrathèque.
 * `document` : contenu de l'éditeur, à partir duquel le backend génère les livrables.
 * `createdFromScratch` : contrat rédigé via « Créer de zéro » ; le backend rendra le
 * crédit de génération consommé une fois le paiement confirmé.
 */
export async function startContractPackCheckout(
  contractRef: string,
  options: { document?: JNode; createdFromScratch?: boolean } = {},
): Promise<CheckoutResult> {
  try {
    const res = await fetchProxy("/api/billing/create-one-shot-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        item: CONTRACT_PACK_ITEM,
        contractRef,
        documentContent: options.document,
        refundGenerationCredit: options.createdFromScratch === true,
      }),
    });
    const data = await res.json();
    const url = data?.data?.url;
    if (data?.success && typeof url === "string") {
      return { success: true, url };
    }
    // Message précis du backend (ex : contrat déjà payé), sinon message générique.
    return {
      success: false,
      message: typeof data?.message === "string"
        ? data.message
        : "Impossible de démarrer le paiement. Réessayez.",
    };
  } catch (err) {
    console.error("Erreur create-one-shot-checkout:", err);
    return {
      success: false,
      message: "Le service de paiement est momentanément indisponible. Vérifiez votre connexion puis réessayez.",
    };
  }
}

/**
 * Indique si le Pack Contrat a été payé pour ce contrat (confirmé par le webhook).
 * Lève une erreur si le backend ne répond pas : l'appelant distingue ainsi
 * « pas encore payé » d'une indisponibilité du service.
 */
export async function isContractPackPaid(contractRef: string): Promise<boolean> {
  const res = await fetchProxy(
    `/api/billing/one-shot/${CONTRACT_PACK_ITEM}/${encodeURIComponent(contractRef)}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data?.paid === true;
}

/** Achats payés de l'utilisateur (lève une erreur si le backend ne répond pas). */
export async function listContractPackPurchases(): Promise<ContractPackPurchase[]> {
  const res = await fetchProxy("/api/billing/one-shot/purchases", { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * Télécharge un livrable et l'enregistre sous `fileName`. Si les documents n'ont
 * pas encore été générés, le backend les génère à la volée.
 */
export async function downloadContractPackFile(
  idBilling: number,
  kind: ContractPackFileKind,
  fileName: string,
): Promise<void> {
  const res = await fetchProxy(`/api/billing/one-shot/${idBilling}/files/${kind}`, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const { saveAs } = await import("file-saver");
  saveAs(blob, fileName);
}

/** Renvoie les livrables par e-mail ; renvoie le message du backend. */
export async function resendContractPackEmail(idBilling: number): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetchProxy(`/api/billing/one-shot/${idBilling}/resend-email`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json();
    return {
      success: data?.success === true,
      message: typeof data?.message === "string" ? data.message : "L'envoi a échoué. Réessayez.",
    };
  } catch (err) {
    console.error("Erreur resend-email:", err);
    return { success: false, message: "Connexion au serveur impossible. Réessayez." };
  }
}
