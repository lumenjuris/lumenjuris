<<<<<<< HEAD
import { prisma } from "../../prisma/singletonPrisma";
import bcrypt from "bcrypt";

type createDataDTO = {
  email: string;
  nom?: string;
  prenom?: string;
  password?: string;
  cgu: boolean;
  isVerified?: boolean;
};

type UserAuthData = {
  idUser: number;
  email: string;
  role: string;
  isVerified: boolean;
};

type dataUpdatedDTO = {
  email?: string;
  nom?: string;
  prenom?: string;
  password?: string;
};

type returnData<T = any> = {
  success: boolean;
  message?: string;
  data?: T;
};
=======
import { prisma } from "../../prisma/singletonPrisma"
import bcrypt from "bcrypt"
import { formatCompanyProfile } from "./classEnterprise"

type CreateDataDTO = {
    email: string
    nom?: string
    prenom?: string
    password?: string
    cgu: boolean
    isVerified?: boolean
}

type UserAuthData = {
    idUser: number
    email: string
    role: string
    isVerified: boolean
}

type DataUpdatedDTO = {
    email?: string
    nom?: string
    prenom?: string
    password?: string
}

type ReturnData<T = any> = {
    success: boolean
    message?: string
    data?: T
}
>>>>>>> main

export class User {
  //Cacthing d'erreur global
  private errorCatching(
    err: unknown,
    fn: string,
  ): { success: boolean; message: string } {
    const e = err as any;

<<<<<<< HEAD
    console.error(`Erreur dans la fonction ${fn} : \n\n`, err);

    //object des erreur de contrainte
    const constraintMap: Record<string, string> = {
      User_email_key: "Cet email est déjà utilisé.",
    };

    //Erreur de contrainte
    if (e?.code === "P2002") {
      const message: string = e?.message || "";
      //Gestion erreur champ unique non respecté
      for (const key in constraintMap) {
        if (message.includes(key)) {
          return {
            success: false,
            message: constraintMap[key],
          };
=======

    private errorCatching(
        err: unknown,
        fn: string
    ): ReturnData {
        const e = err as any

        console.error(`Erreur dans la fonction ${fn} :\n`, err)

        const constraintMap: Record<string, string> = {
            User_email_key: "Cet email est déjà utilisé.",
        }

        if (e?.code === "P2002") {
            const message = e?.message || ""

            for (const key in constraintMap) {
                if (message.includes(key)) {
                    return {
                        success: false,
                        message: constraintMap[key],
                    }
                }
            }

            return {
                success: false,
                message: "Une valeur unique est déjà utilisée.",
            }
        }

        if (e?.code === "P2005") {
            return {
                success: false,
                message: "Aucun compte utilisateur n'a été retrouvé.",
            }
        }

        return {
            success: false,
            message: "Erreur serveur, veuillez réessayer plus tard.",
        }
    }


    private async hashPassword(password: string): Promise<string> {
        const salt = await bcrypt.genSalt(10)
        return bcrypt.hash(password, salt)
    }


    private async findById(idUser: number) {
        return prisma.user.findUnique({
            where: { idUser },
            include: {
                enterprise: {
                    include: {
                        address: true,
                    },
                },
            },
        })
    }


    async create(data: CreateDataDTO): Promise<ReturnData> {
        try {
            const { email, nom, prenom, password, cgu, isVerified } = data

            const passwordHash = password
                ? await this.hashPassword(password)
                : null

            const newUser = await prisma.user.create({
                data: {
                    email,
                    nom,
                    prenom,
                    password: passwordHash,
                    cgu,
                    isVerified: isVerified ?? false,
                },
            })

            return {
                success: true,
                message: "Compte utilisateur créé avec succès.",
                data: newUser,
            }

        } catch (err) {
            return this.errorCatching(err, "User.create")
>>>>>>> main
        }
      }

      return {
        success: false,
        message: "Une valeur unique est déjà utilisée.",
      };
    }

<<<<<<< HEAD
    if (e?.code === "P2005") {
      return {
        success: false,
        message: "Aucun compte utilisateur n'a été retrouvé.",
      };
=======

    async authenticate(
        password: string,
        email: string
    ): Promise<ReturnData<UserAuthData>> {
        try {
            const findUser = await prisma.user.findUnique({
                where: { email },
            })

            if (!findUser?.password) {
                return {
                    success: false,
                    message: "Email ou mot de passe invalide",
                }
            }

            const isValid = await bcrypt.compare(password, findUser.password)

            return {
                success: isValid,
                message: isValid
                    ? "Connexion réussie"
                    : "Email ou mot de passe invalide",
                data: {
                    idUser: findUser.idUser,
                    email: findUser.email,
                    role: findUser.role,
                    isVerified: findUser.isVerified,
                },
            }

        } catch (err) {
            return this.errorCatching(err, "User.authenticate")
        }
>>>>>>> main
    }

    return {
      success: false,
      message:
        "Une erreur est survenue avec le serveur, merci de réessayer plus tard.",
    };
  }

<<<<<<< HEAD
  //Hash d'un password avec bcrypt
  private async hashPassword(password: string): Promise<string> {
    const saltRound = 10;
    const salt = await bcrypt.genSalt(saltRound);
    const passwordHash = await bcrypt.hash(password, salt);
    return passwordHash;
  }

  //Création d'un nouvel utilisateur dans la bdd
  async create(data: createDataDTO) {
    try {
      const { email, nom, prenom, password, cgu, isVerified } = data;

      let passwordHash = null;

      if (password) {
        passwordHash = await this.hashPassword(password);
      }

      const newUser = await prisma.user.create({
        data: {
          email,
          nom,
          prenom,
          password: passwordHash,
          cgu,
          isVerified: isVerified! ? true : false,
        },
      });

      console.log("New user create with prisma : ", newUser);
      return {
        success: true,
        message: "Le compte utilisateur a été créé avec succès.",
        data: newUser,
      };
    } catch (err) {
      return this.errorCatching(err, "User.create");
=======
    async update(
        idUser: number,
        dataUpdated: DataUpdatedDTO
    ): Promise<ReturnData> {
        try {
            const nextData = { ...dataUpdated }

            if (nextData.password) {
                nextData.password = await this.hashPassword(nextData.password)
            }

            await prisma.user.update({
                where: { idUser },
                data: nextData,
            })

            return {
                success: true,
                message: "Utilisateur mis à jour avec succès.",
            }

        } catch (err) {
            return this.errorCatching(err, "User.update")
        }
    }


    async get(idUser: number): Promise<ReturnData> {
        try {
            const user = await this.findById(idUser)

            if (!user) {
                return {
                    success: false,
                    message: "Utilisateur introuvable.",
                }
            }

            return {
                success: true,
                message: "Utilisateur récupéré avec succès.",
                data: {
                    email: user.email,
                    nom: user.nom,
                    prenom: user.prenom,
                    role: user.role,
                    isVerified: user.isVerified,
                    stripeCustomerId: user.stripeCustomerId,
                    enterprise: user.enterprise
                        ? formatCompanyProfile(user.enterprise)
                        : null,
                },
            }

        } catch (err) {
            return this.errorCatching(err, "User.get")
        }
>>>>>>> main
    }
  }

  //Authentification d'un utilisateur lors d'une connexion
  async authenticate(
    password: string,
    email: string,
  ): Promise<returnData<UserAuthData>> {
    try {
      const findUser = await prisma.user.findUnique({
        where: { email },
      });

      if (!findUser?.password)
        return { success: false, message: "Email ou mot de passe invalide" };

      const verifyPassword = await bcrypt.compare(password, findUser?.password);

      return {
        success: verifyPassword,
        message: verifyPassword
          ? "Connexion réussite"
          : "Email ou mot de passe invalide",
        data: {
          email: findUser.email,
          role: findUser.role,
          isVerified: findUser.isVerified,
          idUser: findUser.idUser,
        },
      };
    } catch (err) {
      return this.errorCatching(err, "User.authenticate");
    }
  }

  //Mise à jour des données d'un utilisateur
  async update(
    idUser: number,
    dataUpdated: dataUpdatedDTO,
  ): Promise<returnData> {
    try {
      if (dataUpdated.password) {
        dataUpdated.password = await this.hashPassword(dataUpdated.password);
      }
      const userUpdated = await prisma.user.update({
        where: { idUser: idUser },
        data: { ...dataUpdated },
      });
      return {
        success: true,
        message: "Les informations ont été mises à jour",
      };
    } catch (err) {
      return this.errorCatching(err, "User.update");
    }
  }

  async get(idUser: number) {
    try {
      const dataUser = await prisma.user.findUnique({
        where: { idUser },
      });
      return {
        success: true,
        message: "Les données de l'utilisateurs ont été récupérés avec succès.",
        data: {
          email: dataUser?.email,
          nom: dataUser?.nom,
          prenom: dataUser?.prenom,
          role: dataUser?.role,
          enterpriseId: dataUser?.enterpriseId,
          isVerified: dataUser?.isVerified,
          stripeCustomerId: dataUser?.stripeCustomerId,
        },
      };
    } catch (err) {
      return this.errorCatching(err, "User.get");
    }
  }
}
