import type { JNode } from "../DashboardComponents/cdd/smart/contractExport";

/**
 * Contenu du contrat mémorisé avant la redirection vers Stripe.
 *
 * Les documents (PDF, Word) sont construits dans le navigateur à partir de
 * l'éditeur, qui est perdu pendant le paiement. On garde donc son contenu dans
 * le sessionStorage de l'onglet pour reconstruire les documents sans filigrane
 * au retour, avec leur mise en forme. Si ce contenu est perdu (autre onglet,
 * autre appareil), les documents sont reconstruits depuis le texte enregistré
 * en contrathèque.
 */
export type PendingPurchase = {
  contractRef: string;
  /** Nom de fichier sans extension, ex : "CDD-accroissement" */
  fileBase: string;
  document: JNode;
};

const storageKey = (contractRef: string) => `lumenjuris.contractPack.${contractRef}`;

export function savePendingPurchase(purchase: PendingPurchase): void {
  try {
    sessionStorage.setItem(storageKey(purchase.contractRef), JSON.stringify(purchase));
  } catch (err) {
    // Stockage indisponible (navigation privée, quota) : le paiement reste possible,
    // les documents seront reconstruits depuis la contrathèque.
    console.warn("Impossible de mémoriser le contrat avant paiement :", err);
  }
}

export function loadPendingPurchase(contractRef: string): PendingPurchase | null {
  try {
    const raw = sessionStorage.getItem(storageKey(contractRef));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPurchase;
    return parsed?.contractRef === contractRef && parsed.document ? parsed : null;
  } catch {
    // Valeur corrompue ou stockage inaccessible
    return null;
  }
}
