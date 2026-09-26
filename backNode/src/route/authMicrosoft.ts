import express from "express";
import type { Request, Response, Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { createCookieAuth } from "../securite/cookieAuth.js";
import { User } from "../services/classUser.js";
import { Microsoft } from "../services/classMicrosoft.js";
import { prisma } from "../../prisma/singletonPrisma.js";
import { Subscription } from "../services/classSubscription.js";
import { Mailer } from "../infrastructure/mailer/classMailer.js";

/** Le paramètre `state` OAuth n'est valable que quelques minutes. */
const DUREE_STATE_OAUTH = "5m";

// Configuration du client Microsoft, initialisée au démarrage pour ne pas
// dupliquer la création à chaque appel.
const microsoftConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || "common"}`,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
  },
};
const microsoftClient = new ConfidentialClientApplication(microsoftConfig);

const microsoftScopes = ["openid", "profile", "email"];

// L'URI de redirection doit être identique à l'aller (getAuthCodeUrl) et au
// retour (acquireTokenByCode), et enregistrée côté Azure. On choisit selon
// l'environnement, comme le HOST de la route Google.
const microsoftRedirectUri =
  process.env.NODE_ENV === "dev"
    ? process.env.MICROSOFT_REDIRECT_URI_LOCAL!
    : process.env.MICROSOFT_REDIRECT_URI_PROD!;

export const microsoftRouter: Router = express.Router();

// Route d'appel par le front : configure l'URL d'auth Microsoft puis redirige
// vers leurs pages pour la connexion.
microsoftRouter.get("/auth/microsoft", async (req: Request, res: Response) => {
  try {
    // État anti-CSRF signé et auto-expirant, plutôt que stocké en session :
    // aucune fuite (rien à purger) et le callback peut tomber sur n'importe
    // quelle instance. Le nonce aléatoire rend chaque état unique.
    // (Même mécanisme que la route Google, le projet n'a pas de express-session.)
    const state = jwt.sign(
      { nonce: crypto.randomUUID(), purpose: "microsoft-oauth" },
      process.env.JWT_SECRET!,
      { expiresIn: DUREE_STATE_OAUTH },
    );

    const authCodeUrl = await microsoftClient.getAuthCodeUrl({
      scopes: microsoftScopes,
      redirectUri: microsoftRedirectUri,
      state,
      prompt: "select_account",
    });

    return res.redirect(authCodeUrl);
  } catch (err) {
    console.error(
      "Erreur lors de la redirection vers microsoft auth, error : \n",
      err,
    );
    return res.redirect(
      `${process.env.HOST_FRONT}?error=microsoft_redirect_error`,
    );
  }
});

// Route callback de l'auth Microsoft
microsoftRouter.get(
  "/auth/microsoft/callback",
  async (req: Request, res: Response) => {
    const FRONT = process.env.HOST_FRONT;
    try {
      const { code, state, error, error_description } = req.query;

      // Contrôle de tous les champs nécessaires dans la réponse avant de
      // poursuivre sur la logique métier.
      if (error) {
        console.error("Microsoft OAuth error:", { error, error_description });
        return res.redirect(`${FRONT}?error=microsoft_denied`);
      }
      if (!code) {
        console.error("Code indisponible dans la réponse microsoft");
        return res.redirect(`${FRONT}?error=microsoft_no_code`);
      }

      // L'état doit être un jeton que NOUS avons signé et qui n'a pas expiré.
      // La signature suffit à écarter un state forgé ; l'expiration borne sa
      // durée de vie. (Le `code` Microsoft, lui, n'est de toute façon utilisable
      // qu'une fois.)
      try {
        const payload = jwt.verify(
          typeof state === "string" ? state : "",
          process.env.JWT_SECRET!,
        ) as { purpose?: string };
        if (payload.purpose !== "microsoft-oauth") {
          return res.redirect(`${FRONT}?error=microsoft_invalid_state`);
        }
      } catch {
        return res.redirect(`${FRONT}?error=microsoft_invalid_state`);
      }

      // Échange du code d'autorisation contre un token.
      const token = await microsoftClient.acquireTokenByCode({
        code: code as string,
        scopes: microsoftScopes,
        redirectUri: microsoftRedirectUri,
      });

      if (!token) {
        throw new Error("Token microsoft absent lors du callback auth");
      }

      const idTokenClaims = token.idTokenClaims as
        | Record<string, string | undefined>
        | undefined;
      if (!idTokenClaims) {
        throw new Error("Id du token claims absent");
      }

      // `oid` = identifiant stable de l'utilisateur chez Microsoft (équivalent
      // du `sub` Google), qu'on stocke comme providerId.
      const microsoftId = idTokenClaims.oid;
      const email = idTokenClaims.email || idTokenClaims.preferred_username;
      const name = idTokenClaims.name || undefined;

      if (!microsoftId || !email) {
        console.error("Claims Microsoft incomplets (oid ou email manquant)");
        return res.redirect(`${FRONT}?error=microsoft_auth_error`);
      }

      // Recherche dans la BDD d'un utilisateur inscrit avec cet e-mail.
      const findUser = await prisma.user.findUnique({
        where: { email: email },
      });

      if (findUser) {
        if (findUser.isBanned) {
          // /inscription n'existe plus : la connexion se fait depuis l'accueil,
          // qui lit ce paramètre et affiche le message de blocage.
          return res.redirect(`${FRONT}/dashboard?error=banned`);
        }
        return (
          createCookieAuth(findUser.idUser, findUser.role, res),
          res.redirect(`${FRONT}/dashboard`)
        );
      }

      // Enregistrer un nouvel utilisateur dans la BDD.
      const newUser = await new User().create({
        email,
        nom: name,
        cgu: true,
        isVerified: true,
      });

      if (!("data" in newUser)) {
        return res.redirect(`${FRONT}/verify-account?reason=userNotCreated`);
      }

      // Nouveau AuthProviderAccount Microsoft.
      await new Microsoft().create({
        providerId: microsoftId,
        userId: newUser.data?.idUser!,
      });

      // Activation freemium.
      new Subscription()
        .activateFreemium(newUser.data?.idUser!)
        .catch(console.error);

      // Envoyer l'email de bienvenue.
      await new Mailer(newUser.data.email).sendWelcomeFreemium();

      // Créer session JWT cookie http only.
      createCookieAuth(newUser.data?.idUser!, "USER", res);
      return res.redirect(`${FRONT}`);
    } catch (err) {
      console.error(
        "Erreur lors du callback de microsoft auth, error : \n",
        err,
      );
      return res.redirect(`${FRONT}?error=microsoft_auth_error`);
    }
  },
);

export default microsoftRouter;
