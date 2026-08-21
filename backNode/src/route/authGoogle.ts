import express from "express";
import type { Request, Response, Router } from "express";
import axios from "axios";
import crypto from "crypto";
import { createCookieAuth } from "../securite/cookieAuth.js";
import { User } from "../services/classUser.js";
import { Google } from "../services/classGoogle.js";
import { prisma } from "../../prisma/singletonPrisma.js";
import { Subscription } from "../services/classSubscription.js";

const routerAuthGoogle: Router = express.Router();

const oauthStates = new Map<string, number>()

//Route auth vers Google
routerAuthGoogle.get("/auth/google", (req: Request, res: Response) => {
  const state = crypto.randomUUID();
  
  oauthStates.set(state, Date.now() +5 * 60 * 1000);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.HOST}/auth/google/callback`;
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
routerAuthGoogle.get(
  "/auth/google/callback",
  async (req: Request, res: Response) => {
    
    const { code, state } = req.query;

    const storedAt = oauthStates.get(state as string);

    if (!storedAt || Date.now() > storedAt) {
      return res.status(400).send("Invalid State");
    }
    oauthStates.delete(state as string);

    //Echanger le code contre un token
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code: code as string,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.HOST}/auth/google/callback`,
        grant_type: "authorization_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    //Recuperer les data user de google
    const userInfo = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` },
      },
    );

    console.log(userInfo);

    const { sub, email, name, picture } = userInfo.data;
    console.log(userInfo.data);

    // Recherche dans la BDD d'un utilisateur inscrit avec un compte Google
    const findUser = await prisma.user.findUnique({
      where: { email: email },
    });

    const FRONT = process.env.HOST_FRONT;

    if (findUser) {
      if (findUser.isBanned) {
        return res.redirect(`${FRONT}/inscription?error=banned`);
      }
      return (
        createCookieAuth(findUser.idUser, "USER", res),
        res.redirect(`${process.env.HOST_FRONT}`)
      );
    }

    //Enregistrer dans la bdd
    //New user dans la bdd
    const newUser = await new User().create({
      email,
      nom: name,
      cgu: true,
      isVerified: true,
    });

    console.log(newUser);

    if (!("data" in newUser)) {
      return res.redirect(
        `${process.env.HOST_FRONT}/verify-account?reason=userNotCreated`,
      );
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
    createCookieAuth(newUser.data?.idUser!, "USER", res);
    res.redirect(`${process.env.HOST_FRONT}`);
  },
);

export default routerAuthGoogle;
