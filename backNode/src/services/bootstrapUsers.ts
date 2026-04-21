import bcrypt from "bcrypt"
import { prisma } from "../../prisma/singletonPrisma"
import { Role } from "../../prisma/generated/enums"

type BootstrapUser = {
    email: string
    password: string
    nom: string
    prenom: string
    role: Role
}

const bootstrapUsers: BootstrapUser[] = [
    {
        email: "test@lumenjuris.local",
        password: "password123",
        nom: "User",
        prenom: "Test",
        role: Role.USER,
    },
    {
        email: process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@lumenjuris.local",
        password: process.env.BOOTSTRAP_ADMIN_PASSWORD || "admin123",
        nom: "Admin",
        prenom: "LumenJuris",
        role: Role.ADMIN,
    },
]

function shouldSeedBootstrapUsers() {
    return process.env.ENV !== "production" && process.env.NODE_ENV !== "production"
}

export async function seedBootstrapUsers() {
    if (!shouldSeedBootstrapUsers()) {
        return
    }

    for (const user of bootstrapUsers) {
        const passwordHash = await bcrypt.hash(user.password, 10)

        await prisma.user.upsert({
            where: { email: user.email },
            update: {
                password: passwordHash,
                nom: user.nom,
                prenom: user.prenom,
                role: user.role,
                cgu: true,
                isVerified: true,
            },
            create: {
                email: user.email,
                password: passwordHash,
                nom: user.nom,
                prenom: user.prenom,
                role: user.role,
                cgu: true,
                isVerified: true,
            },
        })
    }

    console.log("Bootstrap users ready.")
}
