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

export class User {


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
        }
    }


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
    }


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
    }
}