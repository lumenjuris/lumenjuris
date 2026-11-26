import express from "express";
import type { Request, Response, Router } from "express";
import axios from "axios";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { createCookieAuth } from "../securite/cookieAuth.js";
import { User } from "../services/classUser.js";
import { Google } from "../services/classGoogle.js";
import { prisma } from "../../prisma/singletonPrisma.js";
import { Subscription } from "../services/classSubscription.js";
import { logger } from "../logger/logger.js";
import { redirectAddin, signAddinToken, trackAddinLogin } from "../securite/addinAuth.js";



const routerAuthGoogle: Router = express.Router();

/** Le paramètre `state` OAuth n'est valable que quelques minutes. */
const DUREE_STATE_OAUTH = "5m";

//Route auth vers Google
routerAuthGoogle.get("/auth/google", (req: Request, res: Response) => {
  // État anti-CSRF signé et auto-expirant, plutôt que stocké en mémoire :
  // aucune fuite (rien à purger) et le callback peut tomber sur n'importe quelle
  // instance (la Map précédente cassait dès qu'il y avait plusieurs process).
  // Le nonce aléatoire rend chaque état unique.
  const state = jwt.sign(
    { nonce: crypto.randomUUID(), purpose: "google-oauth", addin: req.query.addin === "1" },
    process.env.JWT_SECRET!,
    { expiresIn: DUREE_STATE_OAUTH },
  );

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = (process.env.GOOGLE_REDIRECT_URI || `${process.env.HOST}/auth/google/callback`);
  const scope = "openid email profile";

  const url =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${state}`;

  res.redirect(url);
});





//Route callback de l'auth google
routerAuthGoogle.get("/auth/google/callback", async (req: Request, res: Response) => {

  const { code, state } = req.query;
  let addin = false;

  // L'état doit être un jeton que NOUS avons signé et qui n'a pas expiré.
  // La signature suffit à écarter un state forgé ; l'expiration borne sa
  // durée de vie. (Le `code` Google, lui, n'est de toute façon utilisable
  // qu'une fois.)
  try {
    const payload = jwt.verify(
      typeof state === "string" ? state : "",
      process.env.JWT_SECRET!,
    ) as { purpose?: string; addin?: boolean };
    addin = payload.addin === true;
    if (payload.purpose !== "google-oauth") {
      return res.status(400).send("Invalid State");
    }
  } catch {
    return res.status(400).send("Invalid State");
  }

  try {
    //Echanger le code contre un token
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code: code as string,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: (process.env.GOOGLE_REDIRECT_URI || `${process.env.HOST}/auth/google/callback`),
        grant_type: "authorization_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    //Recupérer les data user de google
    const userInfo = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` },
      },
    );


    const { sub, email, email_verified, name, picture } = userInfo.data;

    const FRONT = process.env.HOST_FRONT;

    // Complément Word : pas de cookie, le JWT repart vers la fenêtre de dialogue.
    const erreur = (url: string, code: string) =>
      addin ? redirectAddin(res, { error: code }) : res.redirect(url);
    const connecter = (idUser: number, role: string) =>
      addin
        ? (void trackAddinLogin(idUser, "google"), redirectAddin(res, { token: signAddinToken(idUser, role) }))
        : (createCookieAuth(idUser, role, res), res.redirect(`${FRONT}/dashboard`));


    const emailVerifie = email_verified === true || email_verified === "true";
    if (!email || !emailVerifie) {
      return erreur(`${FRONT}/dashboard?error=google-email-non-verifie`, "google-email-non-verifie");
    }

    // Recherche dans la BDD d'un utilisateur inscrit avec un compte Google
    const findUser = await prisma.user.findUnique({
      where: { email: email },
    });

    if (findUser) {
      if (findUser.isBanned) {
        return erreur(`${FRONT}/dashboard?error=banned`, "banned");
      }
      return connecter(findUser.idUser, findUser.role);
    }



    //New user dans la bdd
    const newUser = await new User().create({
      email,
      nom: name,
      cgu: true,
      isVerified: true,
    });

    if (!("data" in newUser)) {
      return erreur(`${FRONT}/verify-account?reason=userNotCreated`, "userNotCreated");
    }



    //New AuthProviderAccount
    const newGoogle = await new Google().create({
      providerId: sub,
      avatarUrl: picture,
      userId: newUser.data?.idUser!,
    });

    // Activation freemium
    new Subscription()
      .activateFreemium(newUser.data?.idUser!)
      .catch(console.error);


    //Créer session JWT cookie http only
    connecter(newUser.data?.idUser!, "USER");
  } catch (err) {
    console.log(err);
    logger.error("Erreur lors de l'enregistrement d'un nouvel user via google", err)
    // Sans réponse, le navigateur resterait suspendu sur le callback.
    if (!res.headersSent) {
      if (addin) redirectAddin(res, { error: "google-erreur" });
      else res.redirect(`${process.env.HOST_FRONT}/dashboard?error=google-erreur`);
    }
  }
},
);

export default routerAuthGoogle;
