import express from "express";
import type { Request, Response, Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { StripeLumenJuris } from "../../billing/stripe.service";
import { prisma } from "../../prisma/singletonPrisma";

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

export default routerBilling;
