/**
 * Offre « Pack Contrat Professionnel » : prix affiché et livrables.
 *
 * Le prix réellement débité est celui du produit Stripe (seedItemBilling côté
 * backend). Celui-ci n'est qu'un affichage : penser à le garder aligné via
 * VITE_PRICE_CONTRAT_GENERATION.
 */
export const CONTRACT_PACK_PRICE: string =
  import.meta.env.VITE_PRICE_CONTRAT_GENERATION || "4,90 €";

export type ContractPackDeliverable = {
  label: string;
  /**
   * false tant que le backend ne fournit pas ce livrable : il n'est alors ni
   * affiché dans l'offre ni promis à l'utilisateur.
   */
  available: boolean;
};

export const CONTRACT_PACK_DELIVERABLES: ContractPackDeliverable[] = [
  { label: "Contrat PDF sans filigrane", available: true },
  { label: "Contrat Word (.docx) modifiable", available: true },
  // À activer quand le backend générera la fiche de synthèse
  { label: "Fiche récapitulative PDF", available: false },
  // À activer quand le backend enverra les livrables en pièces jointes
  { label: "Envoi des documents par e-mail", available: false },
  { label: "Conservation dans votre contrathèque", available: true },
];

/** Livrables réellement proposés aujourd'hui. */
export const AVAILABLE_CONTRACT_PACK_DELIVERABLES = CONTRACT_PACK_DELIVERABLES.filter(
  (deliverable) => deliverable.available,
);
