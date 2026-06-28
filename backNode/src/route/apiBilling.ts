import express from "express";
import type { Request, Response, Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { StripeLumenJuris } from "../../billing/stripe.service.js";
import { prisma } from "../../prisma/singletonPrisma.js";
import { Subscription } from "../services/classSubscription.js";
import { Credit } from "../services/classCredit.js";

const routerBilling: Router = express.Router();

// Crée un customer Stripe pour l'utilisateur connecté (ou renvoie l'existant)
routerBilling.post(
  "/customer",
  authMiddleware,
  async (req: Request, res: Response) => {
    const idUser = Number(req.idUser);

    const user = await prisma.user.findUnique({
      where: { idUser },
      select: { email: true, prenom: true, nom: true, stripeCustomerId: true },
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Utilisateur introuvable." });
    }

    // Customer déjà créé — on le renvoie directement
    if (user.stripeCustomerId) {
      return res
        .status(200)
        .json({ success: true, stripeCustomerId: user.stripeCustomerId });
    }

    const name =
      [user.prenom, user.nom].filter(Boolean).join(" ") || user.email;

    const result = await new StripeLumenJuris().createCustomer(
      user.email,
      name,
    );

    if (!result.success || !result.customerId) {
      return res.status(500).json({ success: false, message: result.message });
    }

    await prisma.user.update({
      where: { idUser },
      data: { stripeCustomerId: result.customerId },
    });

    return res
      .status(201)
      .json({ success: true, stripeCustomerId: result.customerId });
  },
);

// Retourne le ClientSecret
routerBilling.post(
  "/payment-intent",
  authMiddleware,
  async (req: Request, res: Response) => {
    const idUser = Number(req.idUser);
    const { amount, automaticPayment = true } = req.body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Montant invalide." });
    }

    const user = await prisma.user.findUnique({
      where: { idUser },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        message: "Cet utilisateur n'a pas encore d'identifiant Stripe.",
      });
    }

    const result = await new StripeLumenJuris().createPayementIntent(
      user.stripeCustomerId,
      amount,
      automaticPayment,
    );

    if (!result.success) {
      return res.status(500).json({ success: false, message: result.message });
    }

    return res
      .status(200)
      .json({ success: true, clientSecret: result.clientSecret });
  },
);

// Retourne tous les plans disponibles
routerBilling.get("/plans", async (_req: Request, res: Response) => {
  try {
    const plans = await prisma.plan.findMany({
      orderBy: { price: "asc" },
    });
    return res.status(200).json({ success: true, plans });
  } catch (err) {
    console.error("GET /billing/plans error:", err);
    return res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// Enregistre un abonnement en BDD après confirmation du paiement Stripe
routerBilling.post(
  "/subscription",
  authMiddleware,
  async (req: Request, res: Response) => {
    const idUser = Number(req.idUser);
    const { planName, interval, amount, stripePaymentIntentId } = req.body;

    if (!planName || !interval || typeof amount !== "number") {
      return res.status(400).json({
        success: false,
        message: "Paramètres manquants : planName, interval, amount requis.",
      });
    }

    const result = await new Subscription().createOrUpdate(
      idUser,
      planName,
      interval,
      amount,
      stripePaymentIntentId,
    );

    return res.status(result.success ? 201 : 400).json(result);
  },
);

routerBilling.get(
  "/subscription",
  authMiddleware,
  async (req: Request, res: Response) => {
    const idUser = Number(req.idUser);

    const result = await new Subscription().get(idUser);

    return res.status(result.success ? 200 : 500).json(result);
  },
);

routerBilling.put(
  "/add-credits",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = Number(req.idUser);
    const { addCredit } = req.body;

    if (!addCredit || typeof addCredit !== "number" || addCredit < 0) {
      return res.status(500).json({
        success: false,
        message:
          "L'ajout de crédit doit-être défini par un nombre entier positif.",
      });
    }

    const addedCredits = await new Credit().addCredit(userId, addCredit);

    return res.status(addedCredits.success ? 200 : 500).json(addedCredits);
  },
);

routerBilling.put(
  "/remove-credits",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = Number(req.idUser);
    const { removeCredit } = req.body;

    if (!removeCredit || typeof removeCredit !== "number" || removeCredit < 0) {
      return res.status(500).json({
        success: false,
        message:
          "Le retrait de crédit doit-être défini par un nombre entier positif.",
      });
    }

    const removedCredits = await new Credit().removeCredit(
      userId,
      removeCredit,
    );
    console.log("REMOVE CREDIT : ", removedCredits);

    return res.status(removedCredits.success ? 200 : 500).json(removedCredits);
  },

  routerBilling.get(
    "/credits",
    authMiddleware,
    async (req: Request, res: Response) => {
      const userId = Number(req.idUser);

      const result = await new Credit().getUserCredits(userId);

      return res.status(result.success ? 200 : 500).json(result);
    },
  ),
);
export default routerBilling;
