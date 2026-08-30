import express from "express";
import type { Request, Response } from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import path from "path";
import routerGoogleAuth from "./src/route/authGoogle.js";
import routerLlm from "./src/route/apiLlm.js";
import routerUser from "./src/route/apiUser.js";
import routerEnterprise from "./src/route/apiEnterprise.js";
import routerContractHistory from "./src/route/apiContractHistory.js";
import routerChatHistory from "./src/route/apiChatHistory.js";
import routerBilling from "./src/route/apiBilling.js";
import routerVeille from "./src/route/apiVeille.js";
import routerUserUploads from "./src/route/apiUserUploads.js";
import routerFeedback from "./src/route/apiFeedback.js";
import routerTemplate from "./src/route/apiTemplate.js";
import routerSignature from "./src/route/apiSignature.js";
import routerContract from "./src/route/apiContract.js";
import routerClause from "./src/route/apiClause.js";
import routerAdmin from "./src/route/apiAdmin.js";
import routerNegotiation from "./src/route/apiNegotiation.js";
import routerLegalWatch from "./src/route/apiLegalWatch.js";
import routerLogger from "./src/route/apiLogger.js";

import routerFeatureEvent from "./src/route/apiFeatureEvent.js";
import cors from "cors";
import { seedBootstrapUsers } from "./src/services/bootstrapUsers.js";
import { Mailer } from "./src/infrastructure/mailer/classMailer.js";
import { globalLimiter } from "./src/securite/limiter.js";
import { authMiddleware } from "./src/middleware/authMiddleware.js";
import { prisma } from "./prisma/singletonPrisma.js";
import fs from "fs";
import { internalApiKeyMiddleware } from "./src/middleware/internalApiKeyMiddleware.js";
import { methodOverrideMiddleware } from "./src/middleware/methodOverrideMiddleware.js";
import { addErrorFeedbackLogger } from "./src/middleware/loggerFeedback.js";
import { globalErrorHandler } from "./src/middleware/globalErrorHandle.js";

import { seedPlans } from "./prisma/seedPlans.js";
import { StripeLumenJuris } from "./billing/stripe.service.js";
/**
 * Préparation du serveur nodejs/express pour ce backend
 * Ici sera traité toute les opérations avec la base de données
 */

const HOST_PROXY: string =
  process.env.HOST_PROXY ||
  (process.env.NODE_ENV == "dev"
    ? "http://localhost:3000"
    : "https://proxy.lumenjuris.com");

const app = express();

//SECURITE
app.set("etag", false);
const port = process.env.PORT || 3020;

//NE PAS DEPLACER CETTE ROUTE
//Le reste de la route est gérer dans le controller billing mais celle-ci est déclarer avant express.json()
//Pour conserver le corp non parse (indispensable pour la signature de stripe!)
app.use(
  "/billing/stripe/webhook",
  express.raw({ type: "application/json" })
);

app.use(express.json({ limit: "20mb" }));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Retablit la methode PATCH que le proxy a du deguiser en POST : l'hebergeur
// bloque PATCH avant Express. Doit rester AVANT les routers.
app.use(methodOverrideMiddleware);


app.use(cors({
  origin:
    process.env.NODE_ENV === "dev"
      ? ["http://localhost:5173", "http://localhost:3020", HOST_PROXY]
      : HOST_PROXY,
  credentials: true,
}),
);
// Rate-limiter global, SAUF le webhook Stripe : Stripe peut envoyer des rafales
// d'events (renouvellements groupés) et un 429 déclencherait des rejeux inutiles.
app.use((req, res, next) => {
  if (req.path.startsWith("/billing/stripe/webhook")) return next();
  return globalLimiter(req, res, next);
});
app.set("trust-proxy", 1);

// Frontière de sécurité : backNode n'accepte QUE les requêtes portant la clé
// interne (posée par le proxy et le cron). Sans elle, un appel direct pourrait
// injecter lui-même `x-user-id`/`x-user-role` et usurper un rôle. Les routes
// OAuth Google et /health, atteintes directement par le navigateur, sont
// exemptées dans le middleware.
app.use(internalApiKeyMiddleware);
// Doit rester AVANT les limiteurs : sans ce reglage, req.ip vaut l'adresse du
// proxy pour tout le monde et les quotas sont partages par tous les utilisateurs.
app.set("trust proxy", 1);
app.use(globalLimiter);
// app.use(internalApiKeyMiddleware);
app.use(addErrorFeedbackLogger);

app.use("/", routerGoogleAuth);
app.use("/llm", routerLlm);
app.use("/user", routerUser);
app.use("/enterprise", routerEnterprise);
app.use("/contract-history", routerContractHistory);
app.use("/chat-history", routerChatHistory);
app.use("/billing", routerBilling);
app.use("/veille", routerVeille);
app.use("/legal-watch", routerLegalWatch);
app.use("/user-uploads", routerUserUploads);
app.use("/feedback", routerFeedback);
app.use("/logger", routerLogger);
app.use("/template", routerTemplate);
app.use("/signature-envelope", routerSignature);
app.use("/contract", routerContract);
app.use("/clause", routerClause);
app.use("/admin", routerAdmin);
app.use("/feature-event", routerFeatureEvent);
app.use("/negotiation", routerNegotiation);

app.get("/health", (req: Request, res: Response) => {
  return res.status(200).json({
    health: true,
    port,
  });
});





app.get("/userassets/:filename", authMiddleware, async (req, res) => {
  try {
    const filename = req.params.filename as string;
    const userId = Number(req.idUser);
    const userUpload = await prisma.userUpload.findUnique({ where: { userId } });
    const images = (userUpload?.uploadedImages ?? []) as { filename: string }[];
    const owned = images.some(img => img.filename === filename);

    if (!owned) {
      return res.status(403).json({ success: false, message: "Accès refusé à ce fichier." });
    }

    const filepath = path.join(process.cwd(), "userassets", filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ success: false, message: "Fichier non trouvé." });
    }

    return res.sendFile(filepath);
  } catch (error) {
    console.error("Erreur assets :", error);
    return res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

app.use(globalErrorHandler);



app.listen(port, async () => {
  try {
    //Initialisation des seed de plan. 
    void await seedPlans()

    //Initialisation des utilisateurs de developpement
    void await seedBootstrapUsers();

    //Initialisation du transporteur pour s'assurer qu'il soit bien ok au démarrage
    void Mailer.initTransporter();

    // Purge des events Stripe traités (idempotence) : au démarrage puis 1×/jour,
    // pour éviter que la table ProcessedStripeEvent grossisse indéfiniment.
    void StripeLumenJuris.purgeOldProcessedEvents();
    setInterval(
      () => void StripeLumenJuris.purgeOldProcessedEvents(),
      24 * 60 * 60 * 1000,
    );

    console.log(`Serveur backend nodejs running on port ${port}`);
  } catch (err) {
    console.error(
      "Une erreur est survenue lors de demarage du serveur backNode, error :",
      err,
    );
  }
});
