import { fetchProxy } from "../../utils/fetchProxy";

/**
 * Achat ponctuel d'un contrat (« Pack Contrat ») : appels au backend.
 *
 * Le paiement suit le même principe que les abonnements (voir PlansPanel) :
 * 1. `POST /billing/create-one-shot-checkout` crée une session Stripe Checkout ;
 * 2. le front redirige vers la page hébergée par Stripe ;
 * 3. le paiement n'est acquis que lorsque le webhook l'a enregistré en base :
 *    seul `GET /billing/one-shot/:item/:contractRef` fait foi, jamais le retour Stripe.
 */

/** Article vendu à l'unité côté backend (enum Prisma ItemVente). */
export const CONTRACT_PACK_ITEM = "CONTRACT_SANS_FILIGRANE";

export type CheckoutResult =
  | { success: true; url: string }
  | { success: false; message: string };

/** Crée la session de paiement Stripe pour un contrat enregistré en contrathèque. */
export async function startContractPackCheckout(contractRef: string): Promise<CheckoutResult> {
  try {
    const res = await fetchProxy("/api/billing/create-one-shot-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ item: CONTRACT_PACK_ITEM, contractRef }),
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
