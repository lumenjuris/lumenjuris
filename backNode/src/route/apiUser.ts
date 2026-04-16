import express from "express";
import type { Request, Response, Router } from "express";
import { User } from "../services/classUser";
import { Token } from "../services/classToken";
import { Mailer } from "../infrastructure/mailer/classMailer";
import { createCookieAuth } from "../securite/cookieAuth";
import { prisma } from "../../prisma/singletonPrisma";
import { authMiddleware } from "../middleware/authMiddleware";
import { Google } from "../services/classGoogle";
import { TokenState } from "../../prisma/generated/enums";

const routerUser: Router = express.Router();

routerUser.post("/create", async (req: Request, res: Response) => {
  try {
    const { email, nom, prenom, password, cgu } = req.body;

    //créer l'user dans la base de données
    const data = {
      email,
      nom,
      prenom,
      password,
      cgu,
    };
    const user = new User();
    const createdUser = await user.create(data);

    if (!createdUser.success || !("data" in createdUser)) {
      return res.status(500).json({
        success: false,
        message:
          "Une erreur est survenue avec le serveur, nous n'avons pas pu créer votre compte utilisateur.",
      });
    }
    //envoyer un email pour confirmer la création du compte
    if (!createdUser.data) return;

    const { idUser } = createdUser.data;

    const token = new Token().createToken(idUser, "verifyAccount");

    const url = `${process.env.HOST}/user/verify/${token}`;
    const mailer = await new Mailer(email).sendVerifyAccount(
      url,
      `${prenom} ${nom}`,
    );

    return res.status(200).json({
      success: mailer.success,
      message: mailer.message,
    });
  } catch (err) {
    console.error(
      `Une erreur avec le serveur est survenue dans la route apiUSer/create, error : \n ${err}`,
    );
    return res.status(500).json({
      success: false,
      message:
        "Une erreur est survenue avec le serveur, nous n'avons pas pu créer votre compte utilisateur.",
    });
  }
});

interface PutVerifyUser extends Record<string, string> {
  token: string;
}
routerUser.get(
  "/verify/:token",
  async (req: Request<PutVerifyUser>, res: Response) => {
    try {
      const { token } = req.params;

      const tokenEntry = await prisma.token.findUnique({
        where: { token },
        include: { user: true },
      });

      //Le token n'existe pas
      if (!tokenEntry) {
        return res.redirect(
          `${process.env.HOST_FRONT}/verify-account?reason=invalid`,
        );
      }

      // Le token est déjà utilisé
      if (tokenEntry.status === TokenState.USED) {
        return res.redirect(
          `${process.env.HOST_FRONT}/verify-account?reason=already-used`,
        );
      }

      if (tokenEntry.status !== "ACTIVE") {
        return res.redirect(
          `${process.env.HOST_FRONT}/verify-account?reason=already-used`,
        );
      }

      //Le token est expiré
      if (tokenEntry.expiresAt < new Date()) {
        await prisma.token.update({
          where: { token },
          data: { status: "EXPIRED" },
        });

        return res.redirect(
          `${process.env.HOST_FRONT}/verify-account?reason=expired`,
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

      createCookieAuth(idUser, updatedUser.role, res);
      return res.redirect(`${process.env.HOST_FRONT}/dashboard?verified=true`);
    } catch (err) {
      console.error(`Erreur lors de la validation utilisateur:\n${err}`);
      return res.redirect(
        `${process.env.HOST_FRONT}/verify-account?reason=server`,
      );
    }
  },
);

/**
 * Endpoint utilisateur pour se deconnecter
 */
routerUser.post("/auth/logout", authMiddleware, (res: Response) => {
  try {
    res.clearCookie("authLumenJuris", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({
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
});

/**
 * Endpoint utilisateur pour s'authentifier.
 * Necessite email et password accesseible dans req.body
 */
routerUser.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { password, email } = req.body;
    const logUser = await new User().authenticate(password, email);

    if (!logUser.success) {
      return res.status(401).json({
        success: false,
        message: "Email ou mot de passe invalide",
      });
    }

    if (logUser.success && logUser.data) {
      createCookieAuth(logUser.data.idUser, "USER", res);
    }

    return res.status(logUser.success ? 200 : 400).json({
      success: logUser.success,
      message: logUser.message,
      data: logUser.data ? logUser.data : null,
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

    if (!("data" in user)) {
      return res.status(400).json({
        success: false,
        message: "Aucune données utilisateur retrouvées",
      });
    }
    let dataReturn = {
      profile: {
        email: user.data.email,
        nom: user.data.nom,
        prenom: user.data.prenom,
        role: user.data.role,
        isVerified: user.data.isVerified,
      },
      billing: {
        stripeCustomerId: user.data.stripeCustomerId,
      },
      provider: {},
      enterprise: {
        enterpriseId: user.data.enterpriseId,
      },
    };

    const userProviderGoogle = await new Google().get(idUser);

    if (userProviderGoogle.data) {
      dataReturn.provider = {
        ...userProviderGoogle.data,
      };
    }

    return res.status(200).json({
      success: true,
      message: "Les données de l'utilisateur ont été récupéré avec succès.",
      data: dataReturn,
    });
  } catch (err) {
    console.error(
      `Une erreur est survenue lors de la récupération des données de l'utilisateur, error : \n ${err}`,
    );
  }
});

export default routerUser;
