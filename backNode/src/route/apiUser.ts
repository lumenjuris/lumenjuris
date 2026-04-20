import express from "express"
import type { Request, Response, Router } from "express"
import { User } from "../services/classUser"
import { Token } from "../services/classToken"
import { Mailer } from "../infrastructure/mailer/classMailer"
import { createCookieAuth } from "../securite/cookieAuth"
import { prisma } from "../../prisma/singletonPrisma"
import { authMiddleware } from "../middleware/authMiddleware"
import { Google } from "../services/classGoogle"
import { Enterprise } from "../services/classEnterprise"
import { TokenState } from "../../prisma/generated/enums"

const routerUser: Router = express.Router()



function normalizePreferenceUI(input: unknown) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return {
            dyslexicMode: false,
        }
    }

    const candidate = input as { dyslexicMode?: unknown }

    return {
        dyslexicMode: Boolean(candidate.dyslexicMode),
    }
}




routerUser.post("/create", async (req: Request, res: Response) => {

    try {
        const { email, nom, prenom, password, cgu, enterprise } = req.body

        if (!password) {
            return res.status(400).json({
                success: false,
                message: "Un mot de passe est requis pour la création d'un compte utilisateur.",
            })
        }

        const user = new User()
        const createdUser = await user.create({
            email,
            nom,
            prenom,
            password,
            cgu,
        })

        if (!createdUser.success || !createdUser.data) {
            return res.status(500).json({
                success: false,
                message: "Une erreur est survenue avec le serveur, nous n'avons pas pu créer votre compte utilisateur.",
            })
        }

        const { idUser } = createdUser.data
        const token = await new Token().createToken(idUser, "verifyAccount")
        const url = `${process.env.HOST}/user/verify/${token.token}`
        const mailer = await new Mailer(email).sendVerifyAccount(url, `${prenom} ${nom}`)

        // Le signup n'appelle plus INSEE côté serveur.
        // Si le front a déjà présenté puis validé un profil entreprise, il peut l'envoyer tel quel ici.
        const enterpriseSave =
            enterprise && typeof enterprise === "object" && !Array.isArray(enterprise)
                ? await new Enterprise().updateByUser(idUser, enterprise)
                : null

        return res.status(200).json({
            success: mailer.success,
            message: mailer.message,
            enterpriseSave,
        })
    } catch (err) {
        console.error(`Une erreur avec le serveur est survenue dans la route apiUser/create, error : \n ${err}`)
        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue avec le serveur, nous n'avons pas pu créer votre compte utilisateur.",
        })
    }

);

















interface PutVerifyUser extends Record<string, string> {
  token: string;
}

routerUser.get(
  "/verify/:token",
  async (req: Request<{ token: string }>, res: Response) => {
    try {
      const { token } = req.params

      const tokenEntry = await prisma.token.findUnique({
        where: { token },
        include: { user: true },
      })

      // Token introuvable
      if (!tokenEntry) {
        return res.redirect(
          `${process.env.HOST_FRONT}/verify-account?reason=invalid`
        )
      }

      // Token déjà utilisé
      if (tokenEntry.status === "USED") {
        return res.redirect(
          `${process.env.HOST_FRONT}/verify-account?reason=already-used`
        )
      }

      // Token expiré
      if (tokenEntry.expiresAt < new Date()) {
        await prisma.token.update({
          where: { token },
          data: { status: "EXPIRED" },
        })

        return res.redirect(
          `${process.env.HOST_FRONT}/verify-account?reason=expired`
        )
      }

      if (tokenEntry.status !== "ACTIVE") {
        return res.redirect(
          `${process.env.HOST_FRONT}/verify-account?reason=already-used`
        )
      }

      const idUser = tokenEntry.userId

      const updatedUser = await prisma.user.update({
        where: { idUser },
        data: {
          isVerified: true,
        },
      })

      await prisma.token.update({
        where: { token },
        data: { status: "USED" },
      })

      // Auth cookie
      createCookieAuth(idUser, updatedUser.role, res)

      return res.redirect(
        `${process.env.HOST_FRONT}/dashboard?verified=true`
      )
    } catch (err) {
      console.error("Erreur lors de la validation utilisateur:", err)

      return res.redirect(
        `${process.env.HOST_FRONT}/verify-account?reason=server`
      )
    }
  }
)







/**
 * Endpoint utilisateur pour se deconnecter
 */

routerUser.post("/auth/logout", authMiddleware, (_req: Request, res: Response) => {
    try {

      return res
        .cookie("authLumenJuris", "", {
          httpOnly: true,
          secure: process.env.ENV === "production",
          sameSite: "strict",
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
        message:"Une erreur est survenue lors de la déconnexion d'un utilisateur.",
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
        const { password, email } = req.body
        const logUser = await new User().authenticate(password, email)

        if (!logUser.success) {
            return res.status(401).json({
                success: false,
                message: "Email ou mot de passe invalide",
            })
        }

        if (logUser.data) {
            createCookieAuth(logUser.data.idUser, "USER", res)
        }

        return res.status(logUser.success ? 200 : 400).json({
            success: logUser.success,
            message: logUser.message,
            data: logUser.data ?? null,
        })
    } catch (err) {
        console.error(`Une erreur est survenue lors de la connexion d'un utilisateur : \n ${err}`)
        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de la connexion d'un utilisateur",
        })
    }
  
});












/**
 * Endpoint User pour récuperer les données de l'utilisateur d'après son id dans le token d'authentification
 */

routerUser.get("/get", authMiddleware, async (req: Request, res: Response) => {
    try {
        const idUser = Number(req.idUser)

        const user = await new User().get(idUser)

        if (!user.success || !user.data) {
            return res.status(404).json({
                success: false,
                message: user.message || "Aucune donnée utilisateur retrouvée",
            })
        }

        const dataReturn = {
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
            enterprise: user.data.enterprise,
        }

        const userProviderGoogle = await new Google().get(idUser)

        if (userProviderGoogle.data) {
            dataReturn.provider = userProviderGoogle.data
        }

        return res.status(200).json({
            success: true,
            message: "Les données de l'utilisateur ont été récupérées avec succès.",
            data: dataReturn,
        })

    } catch (err) {
        console.error( "Erreur récupération utilisateur:", err )
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la récupération utilisateur.",
        })
    }
})







routerUser.put("/", authMiddleware, async (req: Request, res: Response) => {
    try {
        const idUser = Number(req.idUser)
        const { email, nom, prenom, password } = req.body ?? {}

        const update = await new User().update(idUser, {
            ...(typeof email === "string" ? { email } : {}),
            ...(typeof nom === "string" ? { nom } : {}),
            ...(typeof prenom === "string" ? { prenom } : {}),
            ...(typeof password === "string" && password.trim()
                ? { password: password.trim() }
                : {}),
        })

        if (!update.success) {
            return res.status(400).json(update)
        }

        const user = await new User().get(idUser)

        if (!user.success || !user.data) {
            return res.status(404).json({
                success: false,
                message: user.message || "Impossible de relire le profil utilisateur après mise à jour.",
            })
        }

        const userMeta = await prisma.user.findUnique({
            where: { idUser },
            select: {
                cgu: true,
            },
        })

        const userProviderGoogle = await new Google().get(idUser)

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
                provider: userProviderGoogle.data ?? null,
            },
        })
    } catch (err) {
        console.error(`Une erreur est survenue lors de la mise à jour de l'utilisateur, error : \n ${err}`)
        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de la mise à jour de l'utilisateur.",
        })
    }
})




routerUser.get("/preferences", authMiddleware, async (req: Request, res: Response) => {
    try {
        const idUser = Number(req.idUser)
        const userPreference = await prisma.userPreference.findUnique({
            where: { userId: idUser },
        })

        return res.status(200).json({
            success: true,
            message: "Les préférences utilisateur ont été récupérées avec succès.",
            data: {
                preferenceUI: normalizePreferenceUI(userPreference?.preferenceUI),
            },
        })
    } catch (err) {
        console.error(`Une erreur est survenue lors de la récupération des préférences utilisateur, error : \n ${err}`)
        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de la récupération des préférences utilisateur.",
        })
    }
})





routerUser.put("/preferences", authMiddleware, async (req: Request, res: Response) => {
    try {
        const idUser = Number(req.idUser)
        const preferenceUI = normalizePreferenceUI(req.body?.preferenceUI)

        await prisma.userPreference.upsert({
            where: { userId: idUser },
            update: {
                preferenceUI,
            },
            create: {
                userId: idUser,
                preferenceUI,
            },
        })

        return res.status(200).json({
            success: true,
            message: "Les préférences utilisateur ont été mises à jour avec succès.",
            data: {
                preferenceUI,
            },
        })
    } catch (err) {
        console.error(`Une erreur est survenue lors de la mise à jour des préférences utilisateur, error : \n ${err}`)
        return res.status(500).json({
            success: false,
            message: "Une erreur est survenue lors de la mise à jour des préférences utilisateur.",
        })
    }
})





routerUser.post("/two-factor", authMiddleware, async (_req: Request, res: Response) => {
    return res.status(200).json({
        success: true,
        message: "La double authentification n'est pas encore disponible.",
        data: {
            enabled: false,
        },
    })
})


routerUser.post("/export-data", authMiddleware, async (_req: Request, res: Response) => {
    return res.status(200).json({
        success: true,
        message: "L'export des données n'est pas pas encore branché.",
    })
})

routerUser.delete("/account", authMiddleware, async (_req: Request, res: Response) => {
    return res.status(200).json({
        success: true,
        message: "La suppression du compte n'est pas encore branchée.",
    })
})

export default routerUser
