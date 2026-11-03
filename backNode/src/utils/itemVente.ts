import { ItemVente } from "@prisma/client"


// Libellé affiché (facture, email, export) pour chaque article vendu à l'unité
export const ITEM_VENTE_LABELS: Record<ItemVente, string> = {
    [ItemVente.CONTRACT_SANS_FILIGRANE]: "Contrat sans filigrane",
}
