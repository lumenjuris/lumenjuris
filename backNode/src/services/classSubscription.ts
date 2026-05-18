import { prisma } from "../../prisma/singletonPrisma";
import { SubscriptionStatus } from "../../prisma/generated/enums";
import { Mailer } from "../infrastructure/mailer/classMailer";

type ReturnData<T = any> = {
  success: boolean;
  message?: string;
  data?: T;
};

function buildInvoiceNumber(idFacture: number, date: Date): string {
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `LJ-${yyyymmdd}-${String(idFacture).padStart(4, "0")}`;
}

export class Subscription {
  async createOrUpdate(
    userId: number,
    planName: string,
    interval: string,
    chargedAmountCents: number,
    stripePaymentIntentId?: string,
  ): Promise<ReturnData> {
    try {
      const plan = await prisma.plan.findFirst({
        where: { name: planName, interval },
      });

      if (!plan) {
        return {
          success: false,
          message: `Plan "${planName}" (${interval}) introuvable en BDD.`,
        };
      }

      const user = await prisma.user.findUnique({
        where: { idUser: userId },
        select: { email: true, prenom: true, nom: true },
      });

      if (!user) {
        return { success: false, message: "Utilisateur introuvable." };
      }

      const now = new Date();
      const expiresAt =
        interval === "year"
          ? new Date(new Date(now).setFullYear(now.getFullYear() + 1))
          : new Date(new Date(now).setMonth(now.getMonth() + 1));

      const subscription = await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          planId: plan.idPlan,
          status: SubscriptionStatus.ACTIVE,
          startAt: now,
          expiresAt,
        },
        update: {
          planId: plan.idPlan,
          status: SubscriptionStatus.ACTIVE,
          startAt: now,
          expiresAt,
        },
      });

      const facture = await prisma.facture.create({
        data: {
          subscriptionId: subscription.idSubscription,
          price: chargedAmountCents,
          stripeInvoiceId: stripePaymentIntentId ?? `manual_${Date.now()}`,
        },
      });

      await prisma.userCredit.upsert({
        where: { userId },
        create: {
          userId,
          creditIncluded: plan.creditIncluded,
          creditAdded: 0,
        },
        update: {
          creditIncluded: plan.creditIncluded,
        },
      });

      // Envoi de la facture par email
      const invoiceNumber = buildInvoiceNumber(facture.idFacture, now);
      const customerName =
        [user.prenom, user.nom].filter(Boolean).join(" ") || user.email;

      new Mailer(user.email)
        .sendInvoice(
          {
            invoiceNumber,
            date: now,
            customerName,
            customerEmail: user.email,
            planName,
            interval,
            amountTTCCents: chargedAmountCents,
            stripePaymentIntentId,
          },
          user.prenom ?? undefined,
        )
        .catch((error) =>
          console.error(
            "Erreur lors de l'envoi de la facture par email:",
            error,
          ),
        );

      return { success: true, message: "Abonnement activé avec succès." };
    } catch (error) {
      console.error("CREATE SUBSCRIPTION ERROR:", error);
      return {
        success: false,
        message: "Erreur lors de l'activation de l'abonnement.",
      };
    }
  }

  async get(userId: number): Promise<ReturnData> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
        include: { plan: true },
      });

      const credits = await prisma.userCredit.findUnique({
        where: { userId },
      });

      if (!subscription) {
        return { success: true, data: { subscription: null, credits: null } };
      }

      return {
        success: true,
        data: {
          subscription: {
            status: subscription.status,
            planName: subscription.plan.name,
            price: subscription.plan.price,
            interval: subscription.plan.interval,
            startAt: subscription.startAt.toISOString(),
            expiresAt: subscription.expiresAt.toISOString(),
          },
          credits: credits
            ? {
                creditIncluded: credits.creditIncluded,
                totalIncluded: subscription.plan.creditIncluded,
              }
            : null,
        },
      };
    } catch (error) {
      console.error("GET SUBSCRIPTION ERROR:", error);
      return {
        success: false,
        message: "Erreur lors de la récupération de l'abonnement.",
      };
    }
  }

  async activateFreemium(userId: number): Promise<void> {
    try {
      const existingSubscription = await prisma.subscription.findUnique({
        where: { userId },
      });
      if (existingSubscription) return;

      const plan = await prisma.plan.findFirst({
        where: { name: "Freemium", interval: "month" },
      });
      if (!plan) {
        console.error("Plan Freemium introuvable en BDD");
        return;
      }

      const now = new Date();
      const expiresAt = new Date(new Date(now).setMonth(now.getMonth() + 1));

      await prisma.subscription.create({
        data: {
          userId,
          planId: plan.idPlan,
          status: SubscriptionStatus.ACTIVE,
          startAt: now,
          expiresAt,
        },
      });

      await prisma.userCredit.create({
        data: {
          userId,
          creditIncluded: plan.creditIncluded,
          creditAdded: 0,
        },
      });

      const user = await prisma.user.findUnique({
        where: { idUser: userId },
        select: { email: true, prenom: true },
      });

      if (user) {
        new Mailer(user.email)
          .sendWelcomeFreemium(user.prenom ?? undefined)
          .catch(console.error);
      }
    } catch (error) {
      console.error("activateFreemium error:", error);
    }
  }
}
