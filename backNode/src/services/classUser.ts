import { prisma } from "../../prisma/singletonPrisma"
import bcrypt from "bcrypt"

type createDataDTO = {
    email: string
    nom: string
    prenom: string
    password: string,
    cgu:boolean
}


export class User {



    private errorCatching(err: unknown, fn: string) {
        const e = err as any;

        console.error(`Erreur dans la fonction ${fn} : \n\n`, err);

        //object des erreur de contrainte
        const constraintMap: Record<string, string> = {
            User_email_key: "Cet email est déjà utilisé.",
        }

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
                }
            }

            return {
                success: false,
                message: "Une valeur unique est déjà utilisée.",
            };
        }

        return {
            success: false,
            message: "Une erreur est survenue avec le serveur, merci de réessayer plus tard.",
        };
    }


    private async hashPassword(password: string): Promise<string> {
        const saltRound = 10;
        const salt = await bcrypt.genSalt(saltRound)
        const passwordHash = await bcrypt.hash(password, salt)
        return passwordHash
    }


    //Création d'un nouvel utilisateur dans la bdd
    async create(data: createDataDTO) {
        try {
            const { email, nom, prenom, password, cgu } = data
            const passwordHash = await this.hashPassword(password)
            const newUser = await prisma.user.create({
                data: {
                    email,
                    nom,
                    prenom,
                    password: passwordHash,
                    cgu
                }
            })

            console.log("New user create with prisma : ", newUser)
            return {
                success: true,
                data: newUser,
            }
        } catch (err) {
            return this.errorCatching(err, "User.create")
        }
    }


    //Authentification d'un utilisateur lors d'une connexion
    async authenticate(password: string, email: string) {
        try {

            const hashedPassword = await prisma.user.findUnique({
                where: { email }
            })
            console.log(hashedPassword)
            if (!hashedPassword?.password) return
            const verifyPassword = await bcrypt.compare(password, hashedPassword?.password)
            console.log(verifyPassword)

        } catch (err) {
            this.errorCatching(err, "User.authenticate")
        }
    }

    async update() {
        try {

        } catch (err) {
            this.errorCatching(err, "User.update")
        }
    }
}