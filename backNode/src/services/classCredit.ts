import { prisma } from "../../prisma/singletonPrisma.js";
import { SubscriptionStatus } from "@prisma/client";

type ReturnData<T = any> = {
  success: boolean;
  message?: string;
  data?: T;
};

export class Credit {
  async addCredit(userId: number, addCredit: number): Promise<ReturnData> {
    try {
      const user = await prisma.user.findUnique({ where: { idUser: userId } });
      if (!user)
        return { success: false, message: "Utilisateur introuvable !" };

      // On vérifie que l'utilisateur ai bien un abonnement actif pour pouvoir ajouter des crédits
      const activeSubscription = await prisma.subscription.findUnique({
        where: { userId },
        select: { status: true },
      });
      if (
        !activeSubscription ||
        activeSubscription.status !== SubscriptionStatus.ACTIVE
      )
        return { success: false, message: "Aucun abonnement actif !" };

      const addedCredits = await prisma.userCredit.update({
        where: { userId },
        data: { creditAdded: { increment: addCredit } },
      });

      return {
        success: true,
        message: "Les nouveaux crédits ont bien été ajoutés.",
        data: {
          creditAdded: addedCredits.creditAdded,
          creditIncluded: addedCredits.creditIncluded,
        },
      };
    } catch (error) {
      console.error("ADD CREDIT ERROR:", error);
      return {
        success: false,
        message: "Erreur lors de l'ajout des crédits.",
      };
    }
  }

  async removeCredit(
    userId: number,
    removeCredit: number,
  ): Promise<ReturnData> {
    try {
      const user = await prisma.user.findUnique({ where: { idUser: userId } });
      if (!user)
        return { success: false, message: "Utilisateur introuvable !" };

      // On vérifie que l'utilisateur ai bien un abonnement actif avec des crédits restants
      const activeSubscription = await prisma.subscription.findUnique({
        where: { userId },
        select: { status: true },
      });

      if (
        !activeSubscription ||
        activeSubscription.status !== SubscriptionStatus.ACTIVE
      )
        return { success: false, message: "Aucun abonnement actif !" };

      const remainingCredits = await prisma.userCredit.findUnique({
        where: { userId },
      });
      if (!remainingCredits)
        return {
          success: false,
          message: "Vous ne semblez pas avoir de crédits.",
        };
      if (
        remainingCredits.creditIncluded === 0 &&
        remainingCredits.creditAdded === 0
      )
        return { success: false, message: "Tous vos crédits sont épuisés !" };

      // On retire les crédits s'il en reste
      if (remainingCredits.creditAdded >= removeCredit) {
        const creditsRemoved = await prisma.userCredit.update({
          where: { userId },
          data: { creditAdded: { decrement: removeCredit } },
        });
        return {
          success: true,
          message: "Crédits retirés de vos crédits supplémentaires.",
          data: creditsRemoved.creditAdded,
        };
      } else if (
        remainingCredits.creditAdded < removeCredit &&
        remainingCredits.creditIncluded >= removeCredit
      ) {
        const creditsRemoved = await prisma.userCredit.update({
          where: { userId },
          data: { creditIncluded: { decrement: removeCredit } },
        });
        return {
          success: true,
          message: "Crédits retirés des crédits inclus dans votre abonnement.",
          data: creditsRemoved.creditIncluded,
        };
      }

      return {
        success: false,
        message: "Crédits insuffisants !",
        data: {
          creditAdded: remainingCredits.creditAdded,
          creditIncluded: remainingCredits.creditIncluded,
        },
      };
    } catch (error) {
      console.error("REMOVE CREDIT ERROR:", error);
      return {
        success: false,
        message: "Erreur lors du retrait de crédits.",
      };
    }
  }

  async getUserCredits(userId: number): Promise<ReturnData> {
    try {
      const user = await prisma.user.findUnique({ where: { idUser: userId } });
      if (!user)
        return { success: false, message: "Utilisateur introuvable !" };

      const remainingCredits = await prisma.userCredit.findUnique({
        where: { userId },
        select: {
          creditIncluded: true,
          creditAdded: true,
        },
      });

      return {
        success: true,
        message: "Crédits restant.",
        data: remainingCredits,
      };
    } catch (error) {
      console.error("GET CREDIT ERROR:", error);
      return {
        success: false,
        message: "Erreur lors de la récupération de vos crédits.",
      };
    }
  }
}
