import express from "express";
import type { Request, Response, Router } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { createCookieAuth } from "../securite/cookieAuth";
import { User } from "../services/classUser";
import { Google } from "../services/classGoogle";
import { prisma } from "../../prisma/singletonPrisma";

const routerAuthGoogle: Router = express.Router();

//Route auth vers Google
routerAuthGoogle.get("/auth/google", (req: Request, res: Response) => {
  const state = crypto.randomUUID();
  res.cookie("google_oauth_state", state, {
    httpOnly: true,
  });
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = "http://localhost:3020/auth/google/callback";
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
    console.log({
      code,
      state,
    });

    if (!process.env.JWT_SECRET) {
      throw new Error(".env JWT_SECRET is not defined");
    }

    //Verifier si le state est valide
    const storedState = req.cookies.google_oauth_state;

    if (!storedState || state !== storedState) {
      return res.status(400).send("Invalid State");
    }

    //state match on peut supprimer le cookie
    res.clearCookie("google_auth_state");

    //Echanger le code contre un token
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code: code as string,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: "http://localhost:3020/auth/google/callback",
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

    if (findUser) {
      return (
        createCookieAuth(findUser.idUser, "USER", res),
        res.redirect(`http://localhost:5173/dashboard`)
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

    //Créer session JWT cookie http only
    createCookieAuth(newUser.data?.idUser!, "USER", res);
    res.redirect(`http://localhost:5173/dashboard`);
  },
);

export default routerAuthGoogle;
