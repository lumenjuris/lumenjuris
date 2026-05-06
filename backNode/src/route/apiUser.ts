import express from "express";
import type { Request, Response, Router } from "express";
import { User } from "../services/classUser";
import { Token } from "../services/classToken";
import { Mailer } from "../infrastructure/mailer/classMailer";
import { createCookieAuth } from "../securite/cookieAuth";
import { prisma } from "../../prisma/singletonPrisma";
import { authMiddleware } from "../middleware/authMiddleware";
import { Google } from "../services/classGoogle";
import { Enterprise } from "../services/classEnterprise";
//import { TokenState } from "../../prisma/generated/enums"

const routerUser: Router = express.Router();

function normalizePreferenceUI(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      dyslexicMode: false,
    };
  }
  const candidate = input as { dyslexicMode?: unknown };

  return {
    dyslexicMode: Boolean(candidate.dyslexicMode),
  };
}

routerUser.post("/create", async (req: Request, res: Response) => {
  try {
    const { email, nom, prenom, password, cgu, enterprise } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message:
          "Un mot de passe est requis pour la création d'un compte utilisateur.",
      });
    }

    const user = new User();
    const createdUser = await user.create({
      email,
      nom,
      prenom,
      password,
      cgu,
    });

    if (!createdUser.success || !createdUser.data) {
      return res.status(500).json({
        success: false,
        message:
          "Une erreur est survenue avec le serveur, nous n'avons pas pu créer votre compte utilisateur.",
      });
    }

    const { idUser } = createdUser.data;
    const token = await new Token().createToken(idUser, "verifyAccount");
    const url = `${process.env.HOST}/user/verify/${token.token}`;
    const mailer = await new Mailer(email).sendVerifyAccount(
      url,
      `${prenom} ${nom}`,
    );

    // Le signup n'appelle plus INSEE côté serveur.
    // Si le front a déjà présenté puis validé un profil entreprise, il peut l'envoyer tel quel ici.
    const enterpriseSave =
      enterprise && typeof enterprise === "object" && !Array.isArray(enterprise)
        ? await new Enterprise().updateByUser(idUser, enterprise)
        : null;

    return res.status(200).json({
      success: mailer.success,
      message: mailer.message,
      enterpriseSave,
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
});

routerUser.get(
  "/verify/:token",
  async (req: Request<{ token: string }>, res: Response) => {
    try {
      const { token } = req.params;

      const tokenEntry = await prisma.token.findUnique({
        where: { token },
        include: { user: true },
      });

      // Token introuvable
      if (!tokenEntry) {
        return res.redirect(
          `${process.env.HOST_FRONT}/verify-account?reason=invalid`,
        );
      }

      // Token déjà utilisé
      if (tokenEntry.status === "USED") {
        return res.redirect(
          `${process.env.HOST_FRONT}/verify-account?reason=already-used`,
        );
      }

      // Token expiré
      if (tokenEntry.expiresAt < new Date()) {
        await prisma.token.update({
          where: { token },
          data: { status: "EXPIRED" },
        });

        return res.redirect(
          `${process.env.HOST_FRONT}/verify-account?reason=expired`,
        );
      }

      if (tokenEntry.status !== "ACTIVE") {
        return res.redirect(
          `${process.env.HOST_FRONT}/verify-account?reason=already-used`,
        );
      }

      const idUser = tokenEntry.userId;

      const updatedUser = await prisma.user.update({
        where: { idUser },
        data: {
          isVerified: true,
        },
      });

      await prisma.token.update({
        where: { token },
        data: { status: "USED" },
      });

      // Auth cookie
      createCookieAuth(idUser, updatedUser.role, res);

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
          secure: process.env.ENV === "production",
          //sameSite: "strict",
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
 * Necessite email et password accesseible dans req.body
 */

routerUser.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { password, email } = req.body;
    const logUser = await new User().authenticate(password, email);

    if (!logUser.success || !logUser.data) {
      return res.status(401).json({
        success: false,
        message: "Email ou mot de passe invalide",
      });
    }

    createCookieAuth(logUser.data.idUser, "USER", res);

    if (logUser.data.twoFactorEnabled) {
      const codeResult = await new Token().createTwoFactorCode(
        logUser.data.idUser,
      );

      if (codeResult.success && codeResult.code) {
        await new Mailer(logUser.data.email).sendTwoFactor(
          codeResult.code,
          logUser.data.email,
        );
      }

      return res.status(200).json({
        success: true,
        twoFactorRequired: true,
        message: `Un code de vérification a été envoyé à ${logUser.data.email}.`,
        data: logUser.data,
      });
    }

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
      message: "Une erreur est survenue lors de la connexion d'un utilisateur",
    });
  }
});

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
    const { email, nom, prenom, password, twoFactorEnabled } = req.body ?? {};

    const update = await new User().update(idUser, {
      ...(typeof email === "string" ? { email } : {}),
      ...(typeof nom === "string" ? { nom } : {}),
      ...(typeof prenom === "string" ? { prenom } : {}),
      ...(typeof password === "string" && password.trim()
        ? { password: password.trim() }
        : {}),
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
          preferenceUI: normalizePreferenceUI(userPreference?.preferenceUI),
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
      const preferenceUI = normalizePreferenceUI(req.body?.preferenceUI);

      await prisma.userPreference.upsert({
        where: { userId: idUser },
        update: {
          preferenceUI,
        },
        create: {
          userId: idUser,
          preferenceUI,
        },
      });

      return res.status(200).json({
        success: true,
        message:
          "Les préférences utilisateur ont été mises à jour avec succès.",
        data: {
          preferenceUI,
        },
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

      const mailer = await new Mailer(user.email).sendTwoFactor(
        result.code,
        `${user.prenom ?? ""} ${user.nom ?? ""}`.trim(),
      );

      return res.status(mailer.success ? 200 : 500).json({
        success: mailer.success,
        message: mailer.message,
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
        where: { token: code, userId: idUser, type: "twoFactor" },
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
  async (_req: Request, res: Response) => {
    return res.status(200).json({
      success: true,
      message: "L'export des données n'est pas pas encore branché.",
    });
  },
);

routerUser.delete(
  "/account",
  authMiddleware,
  async (_req: Request, res: Response) => {
    return res.status(200).json({
      success: true,
      message: "La suppression du compte n'est pas encore branchée.",
    });
  },
);

// Route forgot password pour l'envoi du mail de réinitialisation
routerUser.post("/forgotpassword", async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Un email est requis pour réinitialiser votre mot de passe",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email },
    });

    if (user) {
      const token = await new Token().createToken(
        user.idUser,
        "forgotPassword",
      );
      const url = `${process.env.HOST}/user/resetpassword/${token.token}`;
      const mailer = await new Mailer(email).sendResetPassword(
        url,
        `${user.prenom} ${user.nom}`,
      );

      return res.status(200).json({
        success: mailer.success,
        message: mailer.message,
      });
    } else {
      return;
    }
  } catch (error) {
    console.log("🛑🛑🛑🛑 USER RESET", error);
  }
});

// Vérification du token pour permettre la redirection vers la page de reset password
routerUser.get(
  "/resetpassword/:token",
  async (req: Request<{ token: string }>, res: Response) => {
    try {
      const { token } = req.params;

      const tokenEntry = await prisma.token.findUnique({
        where: { token },
      });

      if (!tokenEntry || tokenEntry.type !== "forgotPassword") {
        return res.redirect(
          `${process.env.HOST_FRONT}/reset-password?reason=invalid`,
        );
      }

      if (tokenEntry.status === "USED") {
        return res.redirect(
          `${process.env.HOST_FRONT}/reset-password?reason=already-used`,
        );
      }

      if (tokenEntry.expiresAt < new Date()) {
        await prisma.token.update({
          where: { token },
          data: { status: "EXPIRED" },
        });
        return res.redirect(
          `${process.env.HOST_FRONT}/reset-password?reason=expired`,
        );
      }

      if (tokenEntry.status !== "ACTIVE") {
        return res.redirect(
          `${process.env.HOST_FRONT}/reset-password?reason=already-used`,
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

    const tokenEntry = await prisma.token.findUnique({
      where: { token },
    });

    if (!tokenEntry || tokenEntry.type !== "forgotPassword") {
      return res.status(400).json({
        success: false,
        message: "Token invalide.",
      });
    }

    if (tokenEntry.status === "USED") {
      return res.status(400).json({
        success: false,
        message: "Ce lien a déjà été utilisé.",
      });
    }

    if (tokenEntry.expiresAt < new Date()) {
      await prisma.token.update({
        where: { token },
        data: { status: "EXPIRED" },
      });
      return res.status(400).json({
        success: false,
        message: "Ce lien a expiré. Veuillez effectuer une nouvelle demande.",
      });
    }

    if (tokenEntry.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: "Token invalide ou déjà utilisé.",
      });
    }

    const updated = await new User().update(tokenEntry.userId, { password });

    if (!updated.success) {
      return res.status(500).json({
        success: false,
        message:
          "Une erreur est survenue lors de la mise à jour du mot de passe.",
      });
    }

    await prisma.token.update({
      where: { token },
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
