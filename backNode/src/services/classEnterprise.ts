import { prisma } from "../../prisma/singletonPrisma";
import { Insee } from "./classInsee";
import axios from "axios";

// Données manipulées lors des mises à jour manuelles côté application.
type EnterpriseInput = {
    siren?: string | null
    codeNaf?: string | null
    name?: string | null
    conventionCollective?: string | null
    statusJuridique?: string | null
    address?: string | null
    codePostal?: string | null
    pays?: string | null
}

export class Enterprise {
    private insee = new Insee()

    // Transforme les erreurs Axios / métier en message lisible pour les routes.
    private getErrorMessage(err: unknown) {
        if (axios.isAxiosError(err)) {
            const status = err.response?.status
            const data = err.response?.data

            if (typeof data === "string" && data.trim()) {
                return status ? `Erreur INSEE ${status}: ${data}` : data
            }

            if (data?.header?.message) {
                return status ? `Erreur INSEE ${status}: ${data.header.message}` : data.header.message
            }

            if (data?.message) {
                return status ? `Erreur INSEE ${status}: ${data.message}` : data.message
            }

            return status
                ? `Erreur INSEE ${status}: ${err.message}`
                : err.message
        }

        if (err instanceof Error) {
            return err.message
        }

        return "Une erreur inconnue est survenue."
    }

    private formatData(enterprise: any) {
        return {
            idEnterprise: enterprise.idEnterprise,
            siren: enterprise.siren,
            codeNaf: enterprise.codeNaf,
            name: enterprise.name,
            conventionCollective: enterprise.conventionCollective,
            statusJuridique: enterprise.statusJuridique,
            address: enterprise.address
                ? {
                    idAddress: enterprise.address.idAddress,
                    address: enterprise.address.address,
                    codePostal: enterprise.address.codePostal,
                    pays: enterprise.address.pays,
                    enterpriseId: enterprise.address.enterpriseId,
                }
                : null,
        }
    }

    // Charge l'entreprise déjà rattachée à un utilisateur, avec sa relation Address.
    private async findUserEnterprise(userId: number) {
        const user = await prisma.user.findUnique({
            where: { idUser: userId },
            include: {
                enterprise: {
                    include: {
                        address: true,
                    },
                },
            },
        })

        return user?.enterprise || null
    }

    // Address est stockée dans une table séparée de Enterprise dans le schéma Prisma.
    private async upsertAddress(idEnterprise: number, address: string | null, codePostal: string | null, pays: string | null) {
        if (!address || !codePostal) {
            return null
        }

        const existingAddress = await prisma.address.findUnique({
            where: { enterpriseId: idEnterprise },
        })

        if (existingAddress) {
            return prisma.address.update({
                where: { enterpriseId: idEnterprise },
                data: {
                    address,
                    codePostal,
                    pays: pays || "FRANCE",
                },
            })
        }

        return prisma.address.create({
            data: {
                address,
                codePostal,
                pays: pays || "FRANCE",
                enterpriseId: idEnterprise,
            },
        })
    }

    // Prévisualisation simple: appelle INSEE sans écrire en base.
    async previewFromSiren(siren: string) {
        try {
            const data = await this.insee.getEnterpriseDataBySiren(siren)
            return {
                success: true,
                message: "Les données INSEE ont été récupérées avec succès.",
                data,
            }
        } catch (err) {
            console.error(err)
            return {
                success: false,
                message: this.getErrorMessage(err),
            }
        }
    }

    // Crée ou met à jour l'entreprise à partir d'INSEE, puis rattache l'utilisateur via enterpriseId.
    async createForUserFromSiren(userId: number, siren: string) {
        try {
            const data = await this.insee.getEnterpriseDataBySiren(siren)

            const enterprise = await prisma.enterprise.upsert({
                where: { idEnterprise: (await prisma.enterprise.findFirst({ where: { siren: data.siren } }))?.idEnterprise || -1 },
                update: {
                    siren: data.siren,
                    codeNaf: data.codeNaf,
                    name: data.name,
                    conventionCollective: data.conventionCollective,
                    statusJuridique: data.statusJuridique,
                },
                create: {
                    siren: data.siren,
                    codeNaf: data.codeNaf,
                    name: data.name,
                    conventionCollective: data.conventionCollective,
                    statusJuridique: data.statusJuridique,
                },
            })

            await this.upsertAddress(
                enterprise.idEnterprise,
                data.address.address,
                data.address.codePostal,
                data.address.pays,
            )

            await prisma.user.update({
                where: { idUser: userId },
                data: {
                    enterpriseId: enterprise.idEnterprise,
                },
            })

            const savedEnterprise = await prisma.enterprise.findUnique({
                where: { idEnterprise: enterprise.idEnterprise },
                include: { address: true },
            })

            return {
                success: true,
                message: "L'entreprise a été enregistrée avec succès.",
                data: this.formatData(savedEnterprise),
            }
        } catch (err) {
            console.error(err)
            return {
                success: false,
                message: this.getErrorMessage(err),
            }
        }
    }

    async getByUser(userId: number) {
        try {
            const enterprise = await this.findUserEnterprise(userId)

            if (!enterprise) {
                return {
                    success: false,
                    message: "Aucune entreprise n'est rattachée à cet utilisateur.",
                }
            }

            return {
                success: true,
                message: "Les données de l'entreprise ont été récupérées avec succès.",
                data: this.formatData(enterprise),
            }
        } catch (err) {
            console.error(err)
            return {
                success: false,
                message: "Une erreur est survenue lors de la récupération de l'entreprise.",
            }
        }
    }

    // Met à jour les champs société, puis l'adresse si des données adresse sont fournies.
    async updateByUser(userId: number, input: EnterpriseInput) {
        try {
            const enterprise = await this.findUserEnterprise(userId)

            if (!enterprise) {
                return {
                    success: false,
                    message: "Aucune entreprise n'est rattachée à cet utilisateur.",
                }
            }

            await prisma.enterprise.update({
                where: { idEnterprise: enterprise.idEnterprise },
                data: {
                    siren: input.siren ?? undefined,
                    codeNaf: input.codeNaf ?? undefined,
                    name: input.name ?? undefined,
                    conventionCollective: input.conventionCollective ?? undefined,
                    statusJuridique: input.statusJuridique ?? undefined,
                },
            })

            if (input.address !== undefined || input.codePostal !== undefined || input.pays !== undefined) {
                await this.upsertAddress(
                    enterprise.idEnterprise,
                    input.address ?? enterprise.address?.address ?? null,
                    input.codePostal ?? enterprise.address?.codePostal ?? null,
                    input.pays ?? enterprise.address?.pays ?? "FRANCE",
                )
            }

            const updatedEnterprise = await prisma.enterprise.findUnique({
                where: { idEnterprise: enterprise.idEnterprise },
                include: { address: true },
            })

            return {
                success: true,
                message: "L'entreprise a été mise à jour avec succès.",
                data: this.formatData(updatedEnterprise),
            }
        } catch (err) {
            console.error(err)
            return {
                success: false,
                message: "Une erreur est survenue lors de la mise à jour de l'entreprise.",
            }
        }
    }

    // On détache d'abord l'utilisateur. L'entreprise n'est supprimée que si elle n'est plus utilisée.
    async deleteByUser(userId: number) {
        try {
            const enterprise = await this.findUserEnterprise(userId)

            if (!enterprise) {
                return {
                    success: false,
                    message: "Aucune entreprise n'est rattachée à cet utilisateur.",
                }
            }

            await prisma.user.update({
                where: { idUser: userId },
                data: { enterpriseId: null },
            })

            const remainingUsers = await prisma.user.count({
                where: { enterpriseId: enterprise.idEnterprise },
            })

            if (remainingUsers === 0) {
                await prisma.address.deleteMany({
                    where: { enterpriseId: enterprise.idEnterprise },
                })

                await prisma.enterprise.delete({
                    where: { idEnterprise: enterprise.idEnterprise },
                })
            }

            return {
                success: true,
                message: "L'entreprise a été supprimée avec succès.",
            }
        } catch (err) {
            console.error(err)
            return {
                success: false,
                message: "Une erreur est survenue lors de la suppression de l'entreprise.",
            }
        }
    }
}
