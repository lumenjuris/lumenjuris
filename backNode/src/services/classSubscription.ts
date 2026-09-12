import { prisma } from "../../prisma/singletonPrisma.js";
import { Prisma, SubscriptionStatus, PlanName, PlanInterval } from "@prisma/client";
import { Mailer } from "../infrastructure/mailer/classMailer.js";
import { generateInvoicePDF } from "../infrastructure/pdf/invoicePDF.js";

export type ReturnData<T = any> = {
  success: boolean;
  message?: string;
  data?: T;
};

export type ReturnDataSubscription<T = any> = {
  data?: T;
};

export function buildInvoiceNumber(idFacture: number, date: Date): string {
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `LJ-${yyyymmdd}-${String(idFacture).padStart(4, "0")}`;
}

/** Utilisateur + entreprise nécessaires pour l'en-tête client d'une facture. */
type UserInvoiceInfo = {
  email: string;
  prenom: string | null;
  nom: string | null;
  enterprise: {
  name: string | null;
  siren: string | null;
  address: {
    address: string | null;
    codePostal: string | null;
    pays: string | null;
    } | null;
  } | null;
};

/** Select Prisma partagé par les deux chemins de facturation (email + download). */
export const USER_INVOICE_SELECT = {
  email: true,
  prenom: true,
  nom: true,
  enterprise: {
    select: {
      name: true,
      siren: true,
      address: { select: { address: true, codePostal: true, pays: true } },
    },
  },
} as const;

/**
 * Construit l'en-tête client d'une facture (source unique de vérité).
 * Priorité à l'entreprise : si `enterprise.name` est présent, la facture est
 * établie à son nom avec son adresse (rue, CP/pays) et son SIREN ; sinon,
 * fallback sur le nom/prénom de la personne (ou l'email en dernier recours).
 * L'adresse n'est ajoutée que si au moins une ligne est connue.
 */
export function buildCustomerInvoiceInfo(user: UserInvoiceInfo): {
  customerName: string;
  customerEmail: string;
  customerAddress?: string;
} {
  const enterprise = user.enterprise;
  const personName =
    [user.prenom, user.nom].filter(Boolean).join(" ") || user.email;
  const customerName = enterprise?.name || personName;

  const addressLines: string[] = [];
  if (enterprise?.address?.address) addressLines.push(enterprise.address.address);
  const cpPays = [enterprise?.address?.codePostal, enterprise?.address?.pays]
    .filter(Boolean)
    .join(" ");
  if (cpPays) addressLines.push(cpPays);
  if (enterprise?.siren) addressLines.push(`SIREN : ${enterprise.siren}`);
  const customerAddress = addressLines.length
    ? addressLines.join("\n")
    : undefined;

  return {
    customerName,
    customerEmail: user.email,
    ...(customerAddress ? { customerAddress } : {}),
  };
}

export class Subscription {
  

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
            // Vrai seulement pour un abonnement Stripe payant : conditionne
            // l'affichage du bouton "Gérer mon abonnement" côté front.
            canManageBilling: subscription.stripeSubscriptionId != null,
          },
          credits: credits
            ? {
              // Quotas restants de l'utilisateur (structure par feature)
              quotas: credits.quotas,
              // Quotas pleins du plan (référence pour calculer la conso côté front)
              planQuotas: subscription.plan.creditsIncluded,
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

  /**
   * Liste les factures payées de l'utilisateur (via son abonnement), triées de
   * la plus récente à la plus ancienne. Renvoie une liste vide si l'utilisateur
   * n'a pas d'abonnement.
   */
  async listInvoices(userId: number): Promise<ReturnData> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
        include: {
          plan: true,
          facture: {
            where: { status: "PAID" },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!subscription) {
        return { success: true, data: [] };
      }

      const data = subscription.facture.map((f) => ({
        id: f.idFacture,
        invoiceNumber: buildInvoiceNumber(f.idFacture, f.createdAt),
        date: f.createdAt.toISOString(),
        amountCents: f.price,
        status: f.status,
        planName: subscription.plan.name,
      }));

      return { success: true, data };
    } catch (error) {
      console.error("LIST INVOICES ERROR:", error);
      return {
        success: false,
        message: "Erreur lors de la récupération des factures.",
      };
    }
  }

  /**
   * Régénère le PDF d'une facture appartenant à l'utilisateur. Renvoie `null`
   * si la facture n'existe pas ou n'appartient pas à l'abonnement de
   * l'utilisateur (contrôle d'accès).
   */
  async getInvoicePdf(
    userId: number,
    idFacture: number,
  ): Promise<{ buffer: Buffer; invoiceNumber: string } | null> {
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });
    if (!subscription) return null;

    const facture = await prisma.facture.findFirst({
      where: { idFacture, subscriptionId: subscription.idSubscription },
    });
    if (!facture) return null;

    const user = await prisma.user.findUnique({
      where: { idUser: userId },
      select: USER_INVOICE_SELECT,
    });
    if (!user) return null;

    const invoiceNumber = buildInvoiceNumber(facture.idFacture, facture.createdAt);

    const buffer = await generateInvoicePDF({
      invoiceNumber,
      date: facture.createdAt,
      ...buildCustomerInvoiceInfo(user),
      planName: subscription.plan.name,
      interval: subscription.plan.interval,
      amountTTCCents: facture.price,
      stripePaymentIntentId: facture.stripeInvoiceId,
    });

    return { buffer, invoiceNumber };
  }

  /**
   * Variante ADMIN de {@link getInvoicePdf} : régénère le PDF d'une facture
   * SANS la restreindre à un utilisateur donné (réservé au monitoring/fiscalité,
   * derrière requireAdmin). Renvoie `null` si la facture n'existe pas.
   */
  async getInvoicePdfAdmin(
    idFacture: number,
  ): Promise<{ buffer: Buffer; invoiceNumber: string } | null> {
    const facture = await prisma.facture.findUnique({
      where: { idFacture },
      include: {
        subscription: {
          include: {
            plan: true,
            user: { select: USER_INVOICE_SELECT },
          },
        },
      },
    });
    if (!facture) return null;

    const user = facture.subscription.user;
    const plan = facture.subscription.plan;

    const invoiceNumber = buildInvoiceNumber(facture.idFacture, facture.createdAt);

    const buffer = await generateInvoicePDF({
      invoiceNumber,
      date: facture.createdAt,
      ...buildCustomerInvoiceInfo(user),
      planName: plan.name,
      interval: plan.interval,
      amountTTCCents: facture.price,
      stripePaymentIntentId: facture.stripeInvoiceId,
    });

    return { buffer, invoiceNumber };
  }

  async activateFreemium(userId: number): Promise<void> {
    try {
      const existingSubscription = await prisma.subscription.findUnique({
        where: { userId },
      });
      if (existingSubscription) return;

      const plan = await prisma.plan.findFirst({
        where: { name: PlanName.Freemium, interval: PlanInterval.monthly },
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
          quotas: plan.creditsIncluded as Prisma.InputJsonValue,
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
