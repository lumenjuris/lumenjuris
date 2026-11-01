import { PlanName, ItemVente } from "@prisma/client"


//Valide le typage de l'enum PlanName de prisma
export const isPlanName = (value: unknown): value is PlanName => {
    return Object.values(PlanName).includes(value as PlanName)
}

//Valide le typage de l'enum ItemVente de prisma
export const isItemVente = (value: unknown): value is ItemVente => {
    return Object.values(ItemVente).includes(value as ItemVente)
}