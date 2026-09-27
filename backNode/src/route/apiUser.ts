import express from "express";
import type { Request, Response, Router } from "express";
import { User } from "../services/classUser.js";
import { Token } from "../services/classToken.js";
import { Mailer } from "../infrastructure/mailer/classMailer.js";
import {
  createCookieAuth,
  createPendingTwoFactorCookie,
} from "../securite/cookieAuth.js";
import { prisma } from "../../prisma/singletonPrisma.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { Google } from "../services/classGoogle.js";
import { Enterprise } from "../services/classEnterprise.js";
import { Subscription } from "../services/classSubscription.js";
import { normalizeAccountParameters } from "../utils/normalizeAccountParameters.js";
import { normalizePreferenceUI } from "../utils/normalizePreferenceUI.js";
import { validatePasswordStrength } from "../utils/passwordPolicy.js";
import { getUserFullExport } from "../services/getUserData.js";
import { readLog, writeLog } from "./apiFeedback.js";
import { hashToken } from "../services/encryption.js";

import {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  twoFactorLimiter,
} from "../securite/limiter.js";
const routerUser: Router = express.Router();

type TokenValidationResult =
  | {
    valid: true;
    tokenEntry: {
      idToken: number;
      userId: number;
      tokenHash: string;
      type: string;
      status: string;
      expiresAt: Date;
    };
  }
  | { valid: false; reason: "invalid" | "already-used" | "expired" };

async function validateToken(
  token: string,
  expectedType?: string,
): Promise<TokenValidationResult> {
  // On ne stocke que l'empreinte du token : on la recalcule pour retrouver la ligne.
  const tokenEntry = await prisma.token.findUnique({ where: { tokenHash: hashToken(token) } });

  // Token introuvable
  if (!tokenEntry || (expectedType && tokenEntry.type !== expectedType)) {
    return { valid: false, reason: "invalid" };
  }

  // Token déjà utilisé
  if (tokenEntry.status === "USED") {
    return { valid: false, reason: "already-used" };
  }

  // Token expiré
  if (tokenEntry.expiresAt < new Date()) {
    await prisma.token.update({
      where: { idToken: tokenEntry.idToken },
      data: { status: "EXPIRED" },
    });
    return { valid: false, reason: "expired" };
  }

  // Etat inconnu (failback)
  if (tokenEntry.status !== "ACTIVE") {
    return { valid: false, reason: "invalid" };
  }
  return { valid: true, tokenEntry };
}

routerUser.post(
  "/create",
  registerLimiter,
  async (req: Request, res: Response) => {
    try {
      const { email, nom, prenom, password, cgu, enterprise } = req.body;

      // Les controles du formulaire ne protegent que le formulaire : la route
      // reste appelable directement. Sans ces verifications, une adresse vide
      // ou un mot de passe trop court partaient en erreur Prisma, renvoyee a
      // l'utilisateur sous la forme d'un "une erreur est survenue" opaque.
      if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({
          success: false,
          message: "Une adresse email valide est requise.",
        });
      }

      const forcePassword = validatePasswordStrength(password);
      if (!forcePassword.valide) {
        return res.status(400).json({
          success: false,
          message: forcePassword.message,
        });
      }

      if (cgu !== true) {
        return res.status(400).json({
          success: false,
          message: "Les conditions générales d'utilisation doivent être acceptées.",
        });
      }

      const user = new User();
      const createdUser = await user.create({
        // Trim seulement : passer l'adresse en minuscules ici la desaccorderait
        // de la connexion, qui cherche l'email tel qu'il est saisi.
        email: email.trim(),
        nom,
        prenom,
        password,
        cgu,
      });

      if (!createdUser.success || !createdUser.data) {
        // Adresse deja inscrite : le cas le plus frequent, et le seul que
        // l'utilisateur peut corriger lui-meme. Il etait masque par un message
        // generique en 500, qui laissait croire a une panne du serveur.
        const dejaInscrit = createdUser.message === "Cet email est déjà utilisé.";

        return res.status(dejaInscrit ? 409 : 500).json({
          success: false,
          reason: dejaInscrit ? "email-existant" : "serveur",
          message: dejaInscrit
            ? "Un compte existe déjà avec cette adresse email. Connectez-vous, ou utilisez « Mot de passe oublié ? » si vous ne vous en souvenez plus."
            : "Une erreur est survenue avec le serveur, nous n'avons pas pu créer votre compte utilisateur.",
        });
      }

      const { idUser } = createdUser.data;
      // Activation par code (saisi dans le formulaire) plutôt que par lien.
      const codeResult = await new Token().createVerifyAccountCode(idUser);

      if (
        enterprise &&
        typeof enterprise === "object" &&
        !Array.isArray(enterprise)
      ) {
        const nested = enterprise as any;
        const enterpriseInput = {
          ...nested,
          address: nested.address?.address ?? nested.address ?? null,
          codePostal: nested.address?.codePostal ?? nested.codePostal ?? null,
          pays: nested.address?.pays ?? nested.pays ?? null,
        };
        await new Enterprise().updateByUser(idUser, enterpriseInput);
      }

      // L'inscription n'attend plus la fin de l'echange SMTP : on laisse au
      // mail un court delai pour aboutir (cas normal, on confirme l'envoi),
      // au-dela la reponse part sans lui et l'envoi se termine en arriere-plan.
      // Avant, un SMTP lent bloquait le formulaire jusqu'a 10 secondes.
      // Une poignee de main SMTP vers o2switch coute environ 1 s : au-dela de
      // ce delai l'envoi n'a pas abouti normalement, inutile de retenir le
      // formulaire plus longtemps.
      const MAIL_ATTENTE_MS = 1500;

      const envoi = codeResult.success
        ? new Mailer(email)
            .sendVerifyAccountCode(codeResult.code, `${prenom} ${nom}`)
            .catch((err) => {
              console.error("Envoi du code d'activation échoué:", err);
              return { success: false as const };
            })
        : Promise.resolve({ success: false as const });

      const resultat = await Promise.race([
        envoi,
        new Promise<"en-cours">((resolve) =>
          setTimeout(() => resolve("en-cours"), MAIL_ATTENTE_MS),
        ),
      ]);

      // Envoi encore en cours : le compte existe, on ne fait pas patienter.
      if (resultat === "en-cours") {
        return res.status(200).json({
          success: true,
          mailSent: "pending",
          message: `Votre compte a été créé. Le code d'activation part à l'instant vers ${email} : consultez votre boîte de réception, et vos spams.`,
        });
      }

      // Echec avere : on cesse d'annoncer un envoi qui n'a pas eu lieu, sinon
      // l'utilisateur attend un e-mail qui ne viendra jamais au lieu d'utiliser
      // le renvoi depuis /verify-account.
      if (!resultat.success) {
        return res.status(200).json({
          success: false,
          mailSent: false,
          message:
            "Votre compte a bien été créé, mais le code d'activation n'a pas pu être envoyé. " +
            "Utilisez le bouton de renvoi, ou contactez contact@lumenjuris.com.",
        });
      }

      return res.status(200).json({
        success: true,
        mailSent: true,
        message: resultat.message,
      });
    } catch (err) {
      console.error(
        `Une erreur avec le serveur est survenue dans la route apiUser/create, error : \n ${err}`,
      );
      return res.status(500).json({
        success: false,
        message:
          "Une erreur est survenue avec le serveur, nous n'avons pas pu créer votre compte utilisateur.",
      });
    }
  },
);

// Route d'envoi d'e-mail sans quota : n'importe qui pouvait la marteler avec
// l'adresse d'un tiers et inonder sa boite. Meme quota que "mot de passe
// oublie", qui repond au meme besoin.
routerUser.post("/resend-verify", forgotPasswordLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "E-mail requis" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.isVerified) {
      return res.status(200).json({ success: true });
    }

    const codeResult = await new Token().createVerifyAccountCode(user.idUser);

    if (codeResult.success) {
      const prenom = user.prenom;
      const nom = user.nom;
      // Envoi en arriere-plan : la reponse ne depend plus de la poignee de main
      // SMTP (environ 1 seconde vers o2switch, plus la remise du message).
      void new Mailer(user.email)
        .sendVerifyAccountCode(codeResult.code, `${prenom} ${nom}`)
        .catch((err) => console.error("Renvoi du code d'activation échoué:", err));
    }

    return res.status(200).json({ success: true, message: "Un nouveau code d'activation a été envoyé." })
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "L'e-mail de vérification n'a pas pu être envoyé." })
  }
})

routerUser.get(
  "/verify/:token",
  async (req: Request<{ token: string }>, res: Response) => {
    try {
      const { token } = req.params;

      const result = await validateToken(token);
      if (!result.valid) {
        return res.redirect(
          `${process.env.HOST_FRONT}/verify-account?reason=${result.reason}`,
        );
      }

      const idUser = result.tokenEntry.userId;

      const updatedUser = await prisma.user.update({
        where: { idUser },
        data: {
          isVerified: true,
        },
      });

      await prisma.token.update({
        where: { idToken: result.tokenEntry.idToken },
        data: { status: "USED" },
      });

      // Auth cookie
      createCookieAuth(idUser, updatedUser.role, res);

      // Activation freemium plan
      new Subscription().activateFreemium(idUser).catch(console.error);

      return res.redirect(`${process.env.HOST_FRONT}/dashboard?verified=true`);
    } catch (err) {
      console.error("Erreur lors de la validation utilisateur:", err);

      return res.redirect(
        `${process.env.HOST_FRONT}/verify-account?reason=server`,
      );
    }
  },
);

/**
 * Activation d'un compte par code (nouveau flux) : l'utilisateur saisit dans le
 * formulaire le code reçu par e-mail. En cas de succès, le compte passe
 * `isVerified` et la session est ouverte, l'utilisateur poursuit sa navigation.
 *
 * Limité en fréquence : le code n'a que 6 chiffres, il se forcerait par balayage
 * sans plafond.
 */
routerUser.post(
  "/verify-code",
  twoFactorLimiter,
  async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;

      if (
        typeof email !== "string" ||
        typeof code !== "string" ||
        !email ||
        !code
      ) {
        return res.status(400).json({
          success: false,
          message: "Une adresse e-mail et un code sont requis.",
        });
      }

      const user = await prisma.user.findUnique({
        where: { email: email.trim() },
        select: {
          idUser: true,
          email: true,
          role: true,
          isVerified: true,
          twoFactorEnabled: true,
        },
      });

      // Réponse volontairement identique à « code invalide » quand l'utilisateur
      // n'existe pas : on ne révèle pas quelles adresses sont inscrites.
      if (!user) {
        return res.status(400).json({ success: false, message: "Code invalide." });
      }

      if (user.isVerified) {
        return res.status(200).json({
          success: true,
          alreadyVerified: true,
          message: "Ce compte est déjà activé. Vous pouvez vous connecter.",
        });
      }

      const tokenEntry = await prisma.token.findFirst({
        where: {
          tokenHash: hashToken(code),
          userId: user.idUser,
          type: "verifyAccount",
        },
      });

      if (!tokenEntry) {
        return res.status(400).json({ success: false, message: "Code invalide." });
      }

      if (tokenEntry.status === "USED") {
        return res
          .status(400)
          .json({ success: false, message: "Ce code a déjà été utilisé." });
      }

      if (tokenEntry.expiresAt < new Date() || tokenEntry.status === "EXPIRED") {
        await prisma.token.update({
          where: { idToken: tokenEntry.idToken },
          data: { status: "EXPIRED" },
        });
        return res.status(400).json({
          success: false,
          message: "Ce code a expiré. Demandez-en un nouveau.",
        });
      }

      await prisma.$transaction([
        prisma.token.update({
          where: { idToken: tokenEntry.idToken },
          data: { status: "USED" },
        }),
        prisma.user.update({
          where: { idUser: user.idUser },
          data: { isVerified: true },
        }),
      ]);

      // Comme l'ancien lien de validation : on active la formule Freemium et on
      // ouvre la session pour que l'utilisateur poursuive sans se reconnecter.
      new Subscription().activateFreemium(user.idUser).catch(console.error);
      createCookieAuth(user.idUser, user.role, res);

      return res.status(200).json({
        success: true,
        message: "Votre compte a été activé.",
        data: {
          idUser: user.idUser,
          email: user.email,
          role: user.role,
          isVerified: true,
          twoFactorEnabled: user.twoFactorEnabled,
        },
      });
    } catch (err) {
      console.error("Erreur lors de l'activation par code:", err);
      return res.status(500).json({
        success: false,
        message: "Une erreur est survenue lors de l'activation du compte.",
      });
    }
  },
);

/**
 * Endpoint utilisateur pour se deconnecter
 */

routerUser.post(
  "/auth/logout",
  authMiddleware,
  (_req: Request, res: Response) => {
    try {
      return res
        .cookie("authLumenJuris", "", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          // Mêmes attributs qu'à la pose (voir cookieAuth) : sinon le logout
          // vide un cookie qui n'existe pas et la session reste active.
          sameSite: "lax",
          domain: process.env.COOKIE_DOMAIN || undefined,
          path: "/",
          maxAge: 0,
        })
        .json({
          success: true,
          message: "L'utilisateur a été déconnecté avec succès.",
        });
    } catch (err) {
      console.error(
        `Une erreur est survenue lors de la déconnexion d'un utilisateur, error : \n ${err}`,
      );
      return res.status(500).json({
        success: false,
        message:
          "Une erreur est survenue lors de la déconnexion d'un utilisateur.",
      });
    }
  },
);

/**
 * Endpoint utilisateur pour s'authentifier.
 * Necessite email et password accessible dans req.body
 */
routerUser.post("/auth/login", loginLimiter, async (req: Request, res: Response) => {
  try {
    const { password, email } = req.body;
    // Meme normalisation qu'a l'inscription : une adresse collee avec une
    // espace de trop ne doit pas passer pour un identifiant different.
    const logUser = await new User().authenticate(
      password,
      typeof email === "string" ? email.trim() : email,
    );

    if (!logUser.success || !logUser.data) {
      return res.status(401).json({
        success: false,
        message: "Email ou mot de passe invalide",
      });
    }

    const userStatus = await prisma.user.findUnique({
      where: { idUser: logUser.data.idUser },
      select: { isBanned: true },
    })


    if (userStatus?.isBanned) {
      return res.status(403).json({
        success: false,
        reason: "banned",
        message: "Cet utilisateur est banni et ne peut donc pas se connecter."
      })
    }

    if (!logUser.data.isVerified) {
      return res.status(403).json({
        success: false,
        reason: "unverified",
        message:
          "Votre compte n'est pas encore validé. Cliquez sur le lien reçu par email pour l'activer.",
      });
    }


    if (logUser.data.twoFactorEnabled) {
      const codeResult = await new Token().createTwoFactorCode(
        logUser.data.idUser,
      );
      if (codeResult.success && codeResult.code) {
        // Envoi en arriere-plan : la reponse ne depend plus du SMTP. Le
        // resultat n'etait de toute facon pas exploite, l'attente ne servait
        // qu'a retarder l'ouverture de la fenetre de saisie du code.
        void new Mailer(logUser.data.email)
          .sendTwoFactor(codeResult.code, logUser.data.email)
          .catch((err) =>
            console.error("Envoi du code de double authentification échoué:", err),
          );
      }

      // Cookie d'attente uniquement : la session complète n'est ouverte qu'à la
      // validation du code, par /two-factor/verify. Sans cela, il suffisait de
      // fermer la fenêtre de saisie pour être déjà connecté.
      createPendingTwoFactorCookie(logUser.data.idUser, logUser.data.role, res);

      return res.status(200).json({
        success: true,
        twoFactorRequired: true,
        message: `Un code de vérification a été envoyé à ${logUser.data.email}.`,
        data: logUser.data,
      });
    }

    // Pas de second facteur : l'identité est vérifiée, on ouvre la session.
    // Le role vient du compte : le figer a "USER" retirait ses droits a un
    // administrateur des qu'il se connectait par ce formulaire.
    createCookieAuth(logUser.data.idUser, logUser.data.role, res);

    return res.status(200).json({
      success: true,
      twoFactorRequired: false,
      message: logUser.message,
      data: logUser.data,
    });
  } catch (err) {
    console.error(
      `Une erreur est survenue lors de la connexion d'un utilisateur : \n ${err}`,
    );
    return res.status(500).json({
      success: false,
      message:
        "Une erreur est survenue lors de la connexion d'un utilisateur",
    });
  }
},
);

/**
 * Endpoint User pour récuperer les données de l'utilisateur d'après son id dans le token d'authentification
 */

routerUser.get("/get", authMiddleware, async (req: Request, res: Response) => {
  try {
    const idUser = Number(req.idUser);
    const user = await new User().get(idUser);

    if (!user.success || !user.data) {
      return res.status(404).json({
        success: false,
        message: user.message || "Aucune donnée utilisateur retrouvée",
      });
    }


    const dataReturn = {
      profile: {
        id: idUser,
        email: user.data.email,
        nom: user.data.nom,
        prenom: user.data.prenom,
        role: user.data.role,
        isVerified: user.data.isVerified,
        twoFactorEnabled: user.data.twoFactorEnabled,
      },
      billing: {
        stripeCustomerId: user.data.stripeCustomerId,
      },
      provider: {},
      enterprise: user.data.enterprise,
    };

    const userProviderGoogle = await new Google().get(idUser);

    if (userProviderGoogle?.data) {
      dataReturn.provider = userProviderGoogle.data;
    }

    return res.status(200).json({
      success: true,
      message: "Les données de l'utilisateur ont été récupérées avec succès.",
      data: dataReturn,
    });
  } catch (err) {
    console.error("Erreur récupération utilisateur:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération utilisateur.",
    });
  }
});

routerUser.put("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const idUser = Number(req.idUser);
    const { email, nom, prenom, password, currentPassword, twoFactorEnabled } =
      req.body ?? {};

    const nouveauMotDePasse =
      typeof password === "string" ? password.trim() : "";

    // Un nouveau mot de passe doit respecter la même politique qu'à
    // l'inscription.
    if (nouveauMotDePasse) {
      const forcePassword = validatePasswordStrength(nouveauMotDePasse);
      if (!forcePassword.valide) {
        return res.status(400).json({
          success: false,
          message: forcePassword.message,
        });
      }
    }

    // On lit l'état actuel pour savoir si la mise à jour touche quelque chose
    // de sensible : changer le mot de passe, changer l'e-mail, ou désactiver la
    // double authentification. Chacune de ces actions exige de reconfirmer le
    // mot de passe actuel — sans quoi un cookie volé suffisait à prendre le
    // compte (nouveau mot de passe, e-mail détourné, 2FA coupée).
    const compteActuel = await prisma.user.findUnique({
      where: { idUser },
      select: { email: true, twoFactorEnabled: true },
    });

    const changeEmail =
      typeof email === "string" &&
      email.trim() !== "" &&
      email.trim() !== compteActuel?.email;
    const desactive2FA =
      twoFactorEnabled === false && compteActuel?.twoFactorEnabled === true;
    const changementSensible =
      Boolean(nouveauMotDePasse) || changeEmail || desactive2FA;

    if (changementSensible) {
      // Un compte Google sans mot de passe (`hasPassword` faux) n'a rien à
      // confirmer : il ne peut de toute façon pas changer de mot de passe ici.
      const controle = await new User().verifyPassword(
        idUser,
        typeof currentPassword === "string" ? currentPassword : "",
      );
      if (controle.hasPassword && !controle.valid) {
        return res.status(400).json({
          success: false,
          reason: "wrong-current-password",
          message: "Le mot de passe actuel est incorrect.",
        });
      }
    }

    const update = await new User().update(idUser, {
      ...(typeof email === "string" ? { email } : {}),
      ...(typeof nom === "string" ? { nom } : {}),
      ...(typeof prenom === "string" ? { prenom } : {}),
      ...(nouveauMotDePasse ? { password: nouveauMotDePasse } : {}),
      ...(typeof twoFactorEnabled === "boolean" ? { twoFactorEnabled } : {}),
    });

    if (!update.success) {
      return res.status(400).json(update);
    }

    const user = await new User().get(idUser);

    if (!user.success || !user.data) {
      return res.status(404).json({
        success: false,
        message:
          user.message ||
          "Impossible de relire le profil utilisateur après mise à jour.",
      });
    }

    const userMeta = await prisma.user.findUnique({
      where: { idUser },
      select: {
        cgu: true,
      },
    });

    const userProviderGoogle = await new Google().get(idUser);

    return res.status(200).json({
      success: true,
      message: "Les informations du compte ont été mises à jour avec succès.",
      data: {
        profile: {
          prenom: user.data.prenom ?? "",
          nom: user.data.nom ?? "",
          email: user.data.email ?? "",
          isVerified: Boolean(user.data.isVerified),
          cgu: Boolean(userMeta?.cgu),
        },
        provider: userProviderGoogle?.data ?? null,
      },
    });
  } catch (err) {
    console.error(
      `Une erreur est survenue lors de la mise à jour de l'utilisateur, error : \n ${err}`,
    );
    return res.status(500).json({
      success: false,
      message:
        "Une erreur est survenue lors de la mise à jour de l'utilisateur.",
    });
  }
});

routerUser.get(
  "/preferences",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const idUser = Number(req.idUser);
      const userPreference = await prisma.userPreference.findUnique({
        where: { userId: idUser },
      });

      return res.status(200).json({
        success: true,
        message: "Les préférences utilisateur ont été récupérées avec succès.",
        data: {
          accountParameters: normalizeAccountParameters(
            userPreference?.accountParameters,
          ),
        },
      });
    } catch (err) {
      console.error(
        `Une erreur est survenue lors de la récupération des préférences utilisateur, error : \n ${err}`,
      );
      return res.status(500).json({
        success: false,
        message:
          "Une erreur est survenue lors de la récupération des préférences utilisateur.",
      });
    }
  },
);

routerUser.put(
  "/preferences",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const idUser = Number(req.idUser);

      // Fusion avec les paramètres déjà enregistrés : chaque écran n'envoie
      // que ce qu'il modifie (les notifications d'un côté, le téléphone de
      // l'autre). Sans fusion, régler les notifications effaçait le téléphone.
      const existant = await prisma.userPreference.findUnique({
        where: { userId: idUser },
        select: { accountParameters: true },
      });
      const estObjet = (v: unknown): v is Record<string, unknown> =>
        !!v && typeof v === "object" && !Array.isArray(v);
      const accountParameters = normalizeAccountParameters({
        ...(estObjet(existant?.accountParameters) ? existant.accountParameters : {}),
        ...(estObjet(req.body?.accountParameters) ? req.body.accountParameters : {}),
      });

      await prisma.userPreference.upsert({
        where: { userId: idUser },
        update: { accountParameters },
        create: { userId: idUser, accountParameters },
      });

      return res.status(200).json({
        success: true,
        message:
          "Les préférences utilisateur ont été mises à jour avec succès.",
        data: { accountParameters },
      });
    } catch (err) {
      console.error(
        `Une erreur est survenue lors de la mise à jour des préférences utilisateur, error : \n ${err}`,
      );
      return res.status(500).json({
        success: false,
        message:
          "Une erreur est survenue lors de la mise à jour des préférences utilisateur.",
      });
    }
  },
);

routerUser.get(
  "/preferences/ui",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const idUser = Number(req.idUser);
      const userPreference = await prisma.userPreference.findUnique({
        where: { userId: idUser },
      });

      return res.status(200).json({
        success: true,
        message: "Les préférences UI ont été récupérées avec succès.",
        data: {
          preferenceUI: normalizePreferenceUI(userPreference?.preferenceUI),
        },
      });
    } catch (err) {
      console.error(
        `Erreur lors de la récupération des préférences UI, error : \n ${err}`,
      );
      return res.status(500).json({
        success: false,
        message:
          "Une erreur est survenue lors de la récupération des préférences UI.",
      });
    }
  },
);

routerUser.put(
  "/preferences/ui",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const idUser = Number(req.idUser);
      const preferenceUI = normalizePreferenceUI(req.body?.preferenceUI);

      await prisma.userPreference.upsert({
        where: { userId: idUser },
        update: { preferenceUI },
        create: { userId: idUser, preferenceUI },
      });

      return res.status(200).json({
        success: true,
        message: "Les préférences UI ont été mises à jour avec succès.",
        data: { preferenceUI },
      });
    } catch (err) {
      console.error(
        `Erreur lors de la mise à jour des préférences UI, error : \n ${err}`,
      );
      return res.status(500).json({
        success: false,
        message:
          "Une erreur est survenue lors de la mise à jour des préférences UI.",
      });
    }
  },
);

// Route d'activation de l'auth à deux facteurs avec envoi d'un code à l'utilisateur pour valider l'activation
routerUser.post(
  "/two-factor",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const idUser = Number(req.idUser);

      const user = await prisma.user.findUnique({
        where: { idUser },
        select: { email: true, prenom: true, nom: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Utilisateur introuvable.",
        });
      }

      const tokenService = new Token();
      const result = await tokenService.createTwoFactorCode(idUser);

      if (!result.success || !result.code) {
        return res.status(500).json({
          success: false,
          message: "Impossible de générer le code de vérification.",
        });
      }

      // Envoi en arriere-plan : le code est deja genere et enregistre, faire
      // patienter le navigateur pendant l'echange SMTP ne le fait pas arriver
      // plus vite et retarde l'ouverture de la saisie du code.
      void new Mailer(user.email)
        .sendTwoFactor(result.code, `${user.prenom ?? ""} ${user.nom ?? ""}`.trim())
        .catch((err) => console.error("Envoi du code de double authentification échoué:", err));

      return res.status(200).json({
        success: true,
        message: `Un code de vérification a été envoyé à ${user.email}.`,
        data: { enabled: false },
      });
    } catch (err) {
      console.error(
        `Une erreur est survenue dans la route /two-factor : \n ${err}`,
      );
      return res.status(500).json({
        success: false,
        message: "Une erreur serveur est survenue lors de l'envoi du code.",
      });
    }
  },
);

routerUser.post(
  "/two-factor/verify",
  twoFactorLimiter,
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const idUser = Number(req.idUser);
      const { code } = req.body;

      if (!code || typeof code !== "string") {
        return res.status(400).json({
          success: false,
          message: "Un code de vérification est requis.",
        });
      }

      const tokenEntry = await prisma.token.findFirst({
        where: { tokenHash: hashToken(code), userId: idUser, type: "twoFactor" },
      });

      if (!tokenEntry) {
        return res.status(400).json({
          success: false,
          message: "Code invalide.",
        });
      }

      if (tokenEntry.status === "USED") {
        return res.status(400).json({
          success: false,
          message: "Ce code a déjà été utilisé.",
        });
      }

      if (
        tokenEntry.expiresAt < new Date() ||
        tokenEntry.status === "EXPIRED"
      ) {
        await prisma.token.update({
          where: { idToken: tokenEntry.idToken },
          data: { status: "EXPIRED" },
        });
        return res.status(400).json({
          success: false,
          message: "Ce code a expiré. Veuillez en demander un nouveau.",
        });
      }

      await Promise.all([
        prisma.token.update({
          where: { idToken: tokenEntry.idToken },
          data: { status: "USED" },
        }),
        prisma.user.update({
          where: { idUser },
          data: { twoFactorEnabled: true },
        }),
      ]);

      // Code validé : on échange le cookie d'attente (posé à la connexion)
      // contre un vrai cookie de session. Sur l'enrôlement depuis le profil,
      // la session était déjà complète : on la reconduit, sans effet de bord.
      createCookieAuth(idUser, req.role ?? "USER", res);

      return res.status(200).json({
        success: true,
        message: "Code vérifié avec succès.",
      });
    } catch (err) {
      console.error(
        `Une erreur est survenue dans la route /two-factor/verify : \n ${err}`,
      );
      return res.status(500).json({
        success: false,
        message:
          "Une erreur serveur est survenue lors de la vérification du code.",
      });
    }
  },
);

routerUser.post(
  "/export-data",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = Number(req.idUser);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Utilisateurs non identifiés.",
        });
      }
      const fullExport = await getUserFullExport(userId);
      const firstName = fullExport.profile?.prenom;
      const targetMail = fullExport.profile?.email;

      if (!targetMail) {
        return res.status(400).json({
          success: false,
          message:
            "Adresse e-mail de l'utilisateur introuvable dans la base de données",
        });
      }
      // Envoi en arriere-plan : l'export est deja constitue, et la piece jointe
      // rend l'echange SMTP d'autant plus long a attendre.
      void new Mailer(targetMail)
        .sendUserData(fullExport, firstName || undefined)
        .catch((err) => console.error("Envoi de l'export de données échoué:", err));
      return res.status(200).json({
        success: true,
        message: "Votre export de données a été envoyé par e-mail avec succès",
      });
    } catch (err) {
      console.error("Erreur détaillé de la route export-data", err);
      return res.status(500).json({
        success: false,
        message: "Erreur lors de la génération de l'export",
      });
    }
  },
);

routerUser.post(
  "/account",
  authMiddleware,
  async (req: Request, res: Response) => {
    const userId = Number(req.idUser);
    const user = await prisma.user.findUnique({
      where: {
        idUser: userId,
      },
    });

    if (!userId || !user) {
      return res.status(401).json({
        success: false,
        message: "Utilisateurs non identifiés.",
      });
    }

    const email = String(user.email);
    const prenom = String(user.prenom);

    try {
      const token = await new Token().createToken(userId, "deleteAccount");
      const url = `${process.env.HOST_FRONT}/user/deleteaccount/${token.token}`;
      // Envoi en arriere-plan : le jeton est enregistre, le lien reste valable.
      void new Mailer(email)
        .sendDeleteAccount(url, prenom)
        .catch((err) => console.error("Envoi du mail de suppression de compte échoué:", err));

      return res.status(200).json({
        success: true,
        message: "L'e-mail de suppression de compte a bien été envoyé",
      });
    } catch (error) {
      console.error(
        "Erreur lors de la demande de suppression de compte:",
        error,
      );
      return res.status(500).json({
        success: false,
        message: "Une erreur est survenue, veuillez réessayer.",
      });
    }
  },
);

routerUser.post("/confirm-delete", async (req: Request, res: Response) => {
  const { token, reason } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: "Token manquant" });
  }

  try {
    const tokenEntry = await prisma.token.findFirst({
      where: { tokenHash: hashToken(token), type: "deleteAccount" },
    });

    if (!tokenEntry || new Date() > tokenEntry.expiresAt) {
      return res.status(400).json({
        success: false,
        message: "Le lien est invalide ou a expiré",
      });
    }

    if (reason?.trim()) {
      try {
        const entries = readLog();
        entries.unshift({
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          comment: reason.trim().slice(0, 1000),
          context: "suppression_compte",
          page: "/user/deleteaccount",
          userId: String(tokenEntry.userId),
        })
        writeLog(entries);
      } catch (err) {
        console.error("Erreur de réception indiquant la raison de la suppression de compte");
        return res.status(500).json({ success: false, message: "Une erreur est survenue" });
      }
    }

    await prisma.$transaction([
      prisma.token.update({
        where: { idToken: tokenEntry.idToken },
        data: { status: "USED" },
      }),
      prisma.user.delete({
        where: { idUser: tokenEntry.userId },
      }),
    ]);

    return res
      .status(200)
      .json({ success: true, message: "Votre compte a bien été supprimé" });
  } catch (error) {
    console.error("Erreur de la confirmation de suppression du compte", error);
    return res
      .status(500)
      .json({ success: false, message: "Une erreur est survenue" });
  }
});

// Route forgot password pour l'envoi du mail de réinitialisation
routerUser.post(
  "/forgotpassword",
  forgotPasswordLimiter,
  async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Un e-mail est requis pour réinitialiser votre mot de passe",
      });
    }

    try {
      // Ne charge que les champs utiles au mail : requête plus légère.
      const user = await prisma.user.findUnique({
        where: { email },
        select: { idUser: true, prenom: true, nom: true },
      });

      if (user) {
        // Une nouvelle demande invalide les précédentes : sans cela, tous les
        // liens de réinitialisation encore valides restaient utilisables en
        // parallèle. Seul le dernier lien envoyé doit fonctionner.
        await prisma.token.updateMany({
          where: { userId: user.idUser, type: "forgotPassword", status: "ACTIVE" },
          data: { status: "EXPIRED" },
        });

        const token = await new Token().createToken(
          user.idUser,
          "forgotPassword",
        );
        const url = `${process.env.HOST}/user/resetpassword/${token.token}`;

        // Envoi en arrière-plan : la réponse HTTP ne dépend plus du SMTP
        // (réponse immédiate, et un incident d'envoi ne casse pas la requête).
        void new Mailer(email)
          .sendResetPassword(url, `${user.prenom} ${user.nom}`)
          .catch((err) =>
            console.error("Envoi de l'email de réinitialisation échoué:", err),
          );
      }

      // Réponse identique que le compte existe ou non : pas d'énumération d'emails.
      return res.status(200).json({
        success: true,
        message:
          "Si cet e-mail est associé à un compte, vous recevrez un lien de réinitialisation.",
      });
    } catch (error) {
      console.error("Erreur lors de la demande de réinitialisation:", error);
      return res.status(500).json({
        success: false,
        message: "Une erreur est survenue, veuillez réessayer.",
      });
    }
  },
);

// Vérification du token pour permettre la redirection vers la page de reset password
routerUser.get(
  "/resetpassword/:token",
  async (req: Request<{ token: string }>, res: Response) => {
    try {
      const { token } = req.params;

      const result = await validateToken(token, "forgotPassword");
      if (!result.valid) {
        return res.redirect(
          `${process.env.HOST_FRONT}/reset-password?reason=${result.reason}`,
        );
      }

      return res.redirect(
        `${process.env.HOST_FRONT}/reset-password?token=${token}`,
      );
    } catch (err) {
      console.error(
        "Erreur lors de la validation du token reset password:",
        err,
      );
      return res.redirect(
        `${process.env.HOST_FRONT}/reset-password?reason=server`,
      );
    }
  },
);

// Route d'update password suite à une demande de réinitialisation
routerUser.post("/updatepassword", async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Un token et un mot de passe sont requis.",
      });
    }

    // Même exigence de robustesse qu'à l'inscription : sans ce contrôle, la
    // réinitialisation acceptait n'importe quel mot de passe, y compris un seul
    // caractère.
    const forcePassword = validatePasswordStrength(password);
    if (!forcePassword.valide) {
      return res.status(400).json({
        success: false,
        message: forcePassword.message,
      });
    }

    const result = await validateToken(token, "forgotPassword");
    if (!result.valid) {
      const messages = {
        invalid: "Token invalide.",
        "already-used": "Ce lien a déjà été utilisé.",
        expired: "Ce lien a expiré. Veuillez effectuer une nouvelle demande.",
      };
      return res
        .status(400)
        .json({ success: false, message: messages[result.reason] });
    }

    const updated = await new User().update(result.tokenEntry.userId, {
      password,
    });

    if (!updated.success) {
      return res.status(500).json({
        success: false,
        message:
          "Une erreur est survenue lors de la mise à jour du mot de passe.",
      });
    }

    await prisma.token.update({
      where: { idToken: result.tokenEntry.idToken },
      data: { status: "USED" },
    });

    return res.status(200).json({
      success: true,
      message: "Votre mot de passe a été réinitialisé avec succès.",
    });
  } catch (err) {
    console.error("Erreur lors de la réinitialisation du mot de passe:", err);
    return res.status(500).json({
      success: false,
      message:
        "Une erreur est survenue lors de la réinitialisation du mot de passe.",
    });
  }
});

export default routerUser;
