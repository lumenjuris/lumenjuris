import express from "express";
import type { Request, Response, Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { StripeLumenJuris } from "../../billing/stripe.service.js";
import { prisma } from "../../prisma/singletonPrisma.js";
import { Subscription } from "../services/classSubscription.js";
import { Credit } from "../services/classCredit.js";
import Stripe from "stripe"

import { isPlanName } from "../utils/typeGuard.js";
import { PlanName } from "@prisma/client";

const routerBilling: Router = express.Router();

const stripeService = new StripeLumenJuris();


/* === STRIPE WEBHOOK ===
 Ultra important, c'est le webhook de stripe.
 Lors d'une transaction avec stripe, le status de stripe sera directement envoyé sur cette route afin d'empecher
 les manipulations.
 On peut içi traiter tout les mises à jour des users suite à un achat/ou un echec de façon safe 
*/
routerBilling.post("/stripe/webhook", async (req: Request, res: Response) => {
  //Adress du webhook https://lumenjurisbackendnodejs.lumenjuris.com/billing/stripe/webhook
  try {
    const signature = req.headers["stripe-signature"];

    const stripeClient = new Stripe(process.env.STRIPE_SK!, {
      maxNetworkRetries: 2,
      telemetry: process.env.NODE_ENV == "dev" ? true : false
    });

    const webhookSecret = process.env.NODE_ENV == "dev"
      ? process.env.STRIPE_WEBHOOK_SECRET_TEST
      : process.env.STRIPE_WEBHOOK_SECRET_PRODUCTION;

    if (!webhookSecret) {
      throw new Error("Variable d'environnement STRIPE_WEBHOOK_SECRET est absente, veuillez remplir le .env !");
    };

    if (!signature) {
      return res.status(400).send("Missing Stripe signature");
    };

    const event = stripeClient.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );

    const handlerEvent = await stripeService.handleEvent(event);


    //Gestion d'erreur côté serveur à stripe
    if (handlerEvent && handlerEvent.success === false) {
      return res.status(500).send("Webhook handler failed");
    }

    return res.sendStatus(200);

  } catch (err) {
    console.error(err)
    return res.status(400).send("Error server")
  }
})


routerBilling.post("/create-checkout", authMiddleware, async (req, res) => {
  try {
    if (!req.idUser) {
      return res.status(401).json({
        success: false,
        message: "Utilisateur non authentifié."
      })
    }

    if (!isPlanName(req.body.planName)) {
      return res.status(400).json({
        success: false,
        error: "Bad Request",
        message: `Le plan name ${req.body.planName} ne fait pas partie des listes de plans proposés.`
      })
    }


    if(req.body.planName == PlanName.Freemium || req.body.planName == PlanName.Betatesteur){
      return res.status(400).json({
        success:false,
        error: "Bad Request",
        message : `Le plan d'abonnement ${req.body.planName} ne fait pas partis des listes d'achat de Lumen Juris`
      })
    }
    
    const userId = Number(req.idUser);
    const checkout = await stripeService.createCheckout(userId, req.body.planName);

    // Statut HTTP relayé depuis le service : 409 si abonnement déjà actif,
    // 404 si plan introuvable, 500 par défaut en cas d'échec.
    const httpStatus = checkout.success
      ? 200
      : "status" in checkout && typeof checkout.status === "number"
        ? checkout.status
        : 500;

    return res.status(httpStatus).json({
      success: checkout.success,
      message: "message" in checkout ? checkout.message : undefined,
      data: checkout ?? null
    })
  } catch (err) {
    console.error("Une erreur est survenue lors de la la mthode post /create-checkout. Error : ", err)
    return res.status(500).json({
      success:false,
      message : "Une erreur serveur est survenue lors de la creation de la souscription."
    })
  }
})


// Ouvre le Stripe Customer Portal (gestion de l'abonnement en self-service).
routerBilling.post("/portal", authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.idUser) {
      return res.status(401).json({ success: false, message: "Utilisateur non authentifié." })
    }

    const userId = Number(req.idUser);
    const portal = await stripeService.createPortalSession(userId);

    const httpStatus = portal.success
      ? 200
      : "status" in portal && typeof portal.status === "number"
        ? portal.status
        : 500;

    return res.status(httpStatus).json({
      success: portal.success,
      message: "message" in portal ? portal.message : undefined,
      url: portal.success ? portal.url : undefined,
    })
  } catch (err) {
    console.error("Erreur POST /billing/portal:", err)
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de l'ouverture du portail de facturation."
    })
  }
})



// Crée un customer Stripe pour l'utilisateur connecté (ou renvoie l'existant)
routerBilling.post("/customer", authMiddleware, async (req: Request, res: Response) => {
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
routerBilling.post("/payment-intent", authMiddleware, async (req: Request, res: Response) => {
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



/* ─── OBSOLÈTE ─────────────────────────────────────────────────────────────
 * Enregistrait un abonnement en BDD après un paiement carte (ancien flux
 * PaymentIntent). Remplacé par Stripe Checkout + webhook : l'activation se fait
 * désormais dans stripe.service (onCheckoutCompleted / onPaymentSucceeded).
 * Conservé commenté le temps de la refonte crédits, à supprimer ensuite.
 *
// Enregistre un abonnement en BDD après confirmation du paiement Stripe
routerBilling.post("/subscription", authMiddleware, async (req: Request, res: Response) => {
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
 * ─────────────────────────────────────────────────────────────────────────── */




routerBilling.get(
  "/subscription",
  authMiddleware,
  async (req: Request, res: Response) => {
    const idUser = Number(req.idUser);

    const result = await new Subscription().get(idUser);

    return res.status(result.success ? 200 : 500).json(result);
  },
);




// Liste des factures payées de l'utilisateur (JSON).
routerBilling.get(
  "/invoices",
  authMiddleware,
  async (req: Request, res: Response) => {
    const idUser = Number(req.idUser);

    const result = await new Subscription().listInvoices(idUser);

    return res.status(result.success ? 200 : 500).json(result);
  },
);




// Téléchargement du PDF d'une facture (régénéré à la volée).
routerBilling.get(
  "/invoices/:idFacture/pdf",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const idUser = Number(req.idUser);
      const idFacture = Number(req.params.idFacture);
      if (!Number.isInteger(idFacture) || idFacture <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "Identifiant de facture invalide." });
      }

      const result = await new Subscription().getInvoicePdf(idUser, idFacture);
      if (!result) {
        return res
          .status(404)
          .json({ success: false, message: "Facture introuvable." });
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${result.invoiceNumber}.pdf"`,
      );
      return res.send(result.buffer);
    } catch (err) {
      console.error("GET /billing/invoices/:idFacture/pdf error:", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },
);




// Enregistre une tentative de paiement échouée (appelé par le front quand
// stripe.confirmCardPayment renvoie une erreur). Rattachée à l'abonnement
// existant de l'utilisateur ; sans abonnement, l'échec n'est pas traçable
// en base (Facture exige un subscriptionId) et est simplement ignoré.
routerBilling.post(
  "/payment-failed",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const idUser = Number(req.idUser);
      const { amount, stripePaymentIntentId } = req.body as {
        amount?: unknown;
        stripePaymentIntentId?: unknown;
      };

      if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "Montant invalide." });
      }

      const sub = await prisma.subscription.findUnique({
        where: { userId: idUser },
        select: { idSubscription: true },
      });
      if (!sub) {
        return res.status(200).json({ success: true, recorded: false });
      }

      await prisma.facture.create({
        data: {
          price: Math.round(amount),
          stripeInvoiceId:
            typeof stripePaymentIntentId === "string"
              ? stripePaymentIntentId.slice(0, 191)
              : "",
          status: "FAILED",
          subscriptionId: sub.idSubscription,
        },
      });

      return res.status(201).json({ success: true, recorded: true });
    } catch (err) {
      console.error("POST /billing/payment-failed error:", err);
      return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  },
);






// Ajoute un bonus à un quota consommable (feature ciblée).
routerBilling.put(
  "/add-credits",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = Number(req.idUser);
    const { feature, amount } = req.body;

    if (typeof feature !== "string" || !feature) {
      return res.status(400).json({
        success: false,
        message: "La feature ciblée est requise.",
      });
    }
    if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Le montant doit être un entier positif.",
      });
    }

    const addedCredits = await new Credit().addQuota(userId, feature, amount);

    return res.status(addedCredits.success ? 200 : 400).json(addedCredits);
  },
);




// Consomme une ou plusieurs unités d'un quota (feature ciblée).
routerBilling.put("/remove-credits", authMiddleware, async (req: Request, res: Response) => {
  const userId = Number(req.idUser);
  const { feature, amount = 1 } = req.body;

  if (typeof feature !== "string" || !feature) {
    return res.status(400).json({
      success: false,
      message: "La feature ciblée est requise.",
    });
  }
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Le montant doit être un entier positif.",
    });
  }

  const removedCredits = await new Credit().consumeQuota(userId, feature, amount);

  return res.status(removedCredits.success ? 200 : 400).json(removedCredits);
})







routerBilling.get("/credits", authMiddleware, async (req: Request, res: Response) => {
  const userId = Number(req.idUser);

  const result = await new Credit().getUserCredits(userId);

  return res.status(result.success ? 200 : 500).json(result);
})


// Vérifie (sans décrémenter) si l'utilisateur a encore du quota pour une feature.
// Appelé par le proxy avant de lancer une feature coûteuse (ex: analyzer).
routerBilling.get("/quota/:feature", authMiddleware, async (req: Request, res: Response) => {
  const userId = Number(req.idUser);
  const feature = String(req.params.feature);

  const result = await new Credit().hasFeatureQuota(userId, feature);

  return res.status(result.success ? 200 : 400).json(result);
})

export default routerBilling;
