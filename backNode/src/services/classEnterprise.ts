import { prisma } from "../../prisma/singletonPrisma"
import { Prisma } from "../../prisma/generated/client"
import axios from "axios"
import { Insee } from "./classInsee"
import {
    ConventionCollectiveItem,
    getConventionCollectiveContextFromCodeNaf,
    getSelectedConventionCollective,
    mergeConventionCollectiveLists,
    normalizeConventionCollectiveItem,
    normalizeConventionCollectiveList,
    resolveSelectedIdccKey,
} from "./nafResolver"

export type CompanyProfileInput = {
    siren?: string | null
    codeNaf?: string | null
    intituleNaf?: string | null
    name?: string | null
    statusJuridiqueCode?: string | null
    statusJuridique?: string | null
    address?: string | null
    codePostal?: string | null
    pays?: string | null
    idccSelections?: unknown
    selectedIdccKey?: string | null
    selectedIdcc?: unknown
}

export type CustomConventionCollectiveDTO = {
    name: string
    idccCode: string | null
}

export type ReturnData<T = any> = {
    success: boolean
    message?: string
    data?: T
}

export type CompanyProfileDTO = {
    idEnterprise: number | null
    siren: string | null
    codeNaf: string | null
    intituleNaf: string | null
    name: string | null
    statusJuridiqueCode: string | null
    statusJuridique: string | null
    address: {
        address: string | null
        codePostal: string | null
        pays: string
    } | null
    idccSelections: ConventionCollectiveItem[]
    selectedIdccKey: string | null
    selectedIdcc: ConventionCollectiveItem | null
}

// Toute lecture d'entreprise passe ici pour exposer au front une forme stable
export function formatCompanyProfile(enterprise: any): CompanyProfileDTO {
    const idccSelections = normalizeConventionCollectiveList(enterprise?.idccSelections, "naf")
    const selectedIdccKey = resolveSelectedIdccKey(idccSelections, enterprise?.selectedIdccKey)
    const persistedAddress = enterprise?.address

    return {
        idEnterprise: enterprise?.idEnterprise ?? null,
        siren: enterprise?.siren ?? null,
        codeNaf: enterprise?.codeNaf ?? null,
        intituleNaf: enterprise?.intituleNaf ?? null,
        name: enterprise?.name ?? null,
        statusJuridiqueCode: enterprise?.statusJuridiqueCode ?? null,
        statusJuridique: enterprise?.statusJuridique ?? null,
        address: persistedAddress
            ? {
                address: persistedAddress.address ?? null,
                codePostal: persistedAddress.codePostal ?? null,
                pays: persistedAddress.pays ?? "FRANCE",
            }
            : null,
        idccSelections,
        selectedIdccKey,
        selectedIdcc: getSelectedConventionCollective(idccSelections, selectedIdccKey),
    }
}

function hasCompanyProfile(profile: CompanyProfileDTO) {
    return Boolean(
        profile.siren ||
        profile.codeNaf ||
        profile.intituleNaf ||
        profile.name ||
        profile.statusJuridiqueCode ||
        profile.statusJuridique ||
        profile.address ||
        profile.idccSelections.length,
    )
}

export class Enterprise {
    private insee = new Insee()

    // Les erreurs INSEE et Axios sont centralisées ici pour garder des messages homogènes côté routes.
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

    // Quand le code NAF change, on recalcule les propositions NAF tout en conservant les customs déjà ajoutées.
    private buildSelectionsFromCodeNaf(codeNaf: string | null, currentSelections: ConventionCollectiveItem[]) {
        const nafSelections = getConventionCollectiveContextFromCodeNaf(codeNaf).conventionCollectives
        const customSelections = currentSelections.filter((selection) => selection.source === "custom")

        return mergeConventionCollectiveLists(nafSelections, customSelections)
    }

    // Le front peut envoyer l'entrée sélectionnée elle-même, utile au signup pour une custom
    // quand il ne connaît pas encore la clé finale générée par le backend.
    private normalizeSelectedConventionCollective(input: unknown) {
        if (!input || typeof input !== "object" || Array.isArray(input)) {
            return null
        }

        const candidate = input as { source?: unknown }
        const fallbackSource = candidate.source === "naf" ? "naf" : "custom"

        return normalizeConventionCollectiveItem(input, fallbackSource)
    }

    // Toutes les opérations entreprise ciblent la ligne liée au user courant via userId @unique.
    private async findByUserId(userId: number) {
        return prisma.enterprise.findUnique({
            where: { userId },
            include: {
                address: true,
            },
        })
    }

    // On verifie l'existence du user avant toute opération entreprise
    private async ensureUserExists(userId: number) {
        return prisma.user.findUnique({
            where: { idUser: userId },
            select: { idUser: true },
        })
    }

    // Une ligne Address n'est créée que si on a des infos
    private hasMeaningfulAddress(address: string | null, codePostal: string | null, pays: string | null) {
        if (address?.trim()) {
            return true
        }

        if (codePostal?.trim()) {
            return true
        }

        return Boolean(pays?.trim() && pays.trim().toUpperCase() !== "FRANCE")
    }

    // Les mises à jour entreprise manipulent l'adresse dans sa propre table
    private async upsertAddressForEnterprise(
        enterpriseId: number,
        address: string | null,
        codePostal: string | null,
        pays: string | null,
    ) {
        if (!this.hasMeaningfulAddress(address, codePostal, pays)) {
            await prisma.address.deleteMany({
                where: { enterpriseId },
            })

            return null
        }

        const normalizedPays = pays?.trim() || "FRANCE"

        return prisma.address.upsert({
            where: { enterpriseId },
            update: {
                address,
                codePostal,
                pays: normalizedPays,
            },
            create: {
                enterpriseId,
                address,
                codePostal,
                pays: normalizedPays,
            },
        })
    }

    // Cette preview sert avant enregistrement le front peut afficher les données INSEE et les IDCC proposées.
    async previewFromSiren(siren: string): Promise<ReturnData<CompanyProfileDTO>> {
        try {
            const data = await this.insee.getEnterpriseDataBySiren(siren)
            const nafContext = getConventionCollectiveContextFromCodeNaf(data.codeNaf)
            const selectedIdccKey = resolveSelectedIdccKey(nafContext.conventionCollectives, null)

            return {
                success: true,
                message: "Les données INSEE ont été récupérées avec succès.",
                data: {
                    idEnterprise: null,
                    siren: data.siren,
                    codeNaf: data.codeNaf,
                    intituleNaf: nafContext.intituleNaf,
                    name: data.name,
                    statusJuridiqueCode: data.statusJuridiqueCode,
                    statusJuridique: data.statusJuridique,
                    address: {
                        address: data.address.address,
                        codePostal: data.address.codePostal,
                        pays: data.address.pays,
                    },
                    idccSelections: nafContext.conventionCollectives,
                    selectedIdccKey,
                    selectedIdcc: getSelectedConventionCollective(nafContext.conventionCollectives, selectedIdccKey),
                },
            }
        } catch (err) {
            console.error(err)
            return {
                success: false,
                message: this.getErrorMessage(err),
            }
        }
    }

    // Cette lecture sert à l'écran profil/paramètres pour afficher l'état enregistré du profil entreprise.
    async getByUser(userId: number): Promise<ReturnData<CompanyProfileDTO>> {
        try {
            const enterprise = await this.findByUserId(userId)

            if (!enterprise) {
                return {
                    success: false,
                    message: "Aucun profil entreprise n'est enregistré pour cet utilisateur.",
                }
            }

            const companyProfile = formatCompanyProfile(enterprise)

            if (!hasCompanyProfile(companyProfile)) {
                return {
                    success: false,
                    message: "Aucun profil entreprise n'est enregistré pour cet utilisateur.",
                }
            }

            return {
                success: true,
                message: "Les données entreprise de l'utilisateur ont été récupérées avec succès.",
                data: companyProfile,
            }
        } catch (err) {
            console.error(err)
            return {
                success: false,
                message: "Une erreur est survenue lors de la récupération du profil entreprise.",
            }
        }
    }

    // Cette mise à jour couvre les éditions manuelles du profil entreprise
    async updateByUser(userId: number, input: CompanyProfileInput): Promise<ReturnData<CompanyProfileDTO>> {
        try {
            const user = await this.ensureUserExists(userId)

            if (!user) {
                return {
                    success: false,
                    message: "Aucun utilisateur n'a été retrouvé.",
                }
            }

            const currentEnterprise = await this.findByUserId(userId)
            const currentSelections = normalizeConventionCollectiveList(currentEnterprise?.idccSelections, "naf")
            const nextCodeNaf = input.codeNaf !== undefined ? input.codeNaf : currentEnterprise?.codeNaf ?? null
            const baseSelections =
                input.idccSelections !== undefined
                    ? normalizeConventionCollectiveList(input.idccSelections, "naf")
                    : this.buildSelectionsFromCodeNaf(nextCodeNaf, currentSelections)
            const normalizedSelectedIdcc = this.normalizeSelectedConventionCollective(input.selectedIdcc)
            const nextSelections = normalizedSelectedIdcc
                ? mergeConventionCollectiveLists(baseSelections, [normalizedSelectedIdcc])
                : baseSelections
            const nafContext = getConventionCollectiveContextFromCodeNaf(nextCodeNaf)
            const selectedIdccKey = normalizedSelectedIdcc
                ? normalizedSelectedIdcc.key
                : input.selectedIdccKey !== undefined
                    ? resolveSelectedIdccKey(nextSelections, input.selectedIdccKey)
                    : resolveSelectedIdccKey(nextSelections, currentEnterprise?.selectedIdccKey)
            const shouldUpdateAddress =
                input.address !== undefined ||
                input.codePostal !== undefined ||
                input.pays !== undefined

            const savedEnterprise = await prisma.enterprise.upsert({
                where: { userId },
                update: {
                    siren: input.siren !== undefined ? input.siren : undefined,
                    codeNaf: input.codeNaf !== undefined ? input.codeNaf : undefined,
                    intituleNaf: input.intituleNaf !== undefined
                        ? input.intituleNaf
                        : input.codeNaf !== undefined
                            ? nafContext.intituleNaf
                            : undefined,
                    name: input.name !== undefined ? input.name : undefined,
                    statusJuridiqueCode: input.statusJuridiqueCode !== undefined ? input.statusJuridiqueCode : undefined,
                    statusJuridique: input.statusJuridique !== undefined ? input.statusJuridique : undefined,
                    idccSelections: nextSelections as Prisma.InputJsonValue,
                    selectedIdccKey,
                },
                create: {
                    userId,
                    siren: input.siren ?? null,
                    codeNaf: nextCodeNaf,
                    intituleNaf: input.intituleNaf !== undefined ? input.intituleNaf : nafContext.intituleNaf,
                    name: input.name ?? null,
                    statusJuridiqueCode: input.statusJuridiqueCode ?? null,
                    statusJuridique: input.statusJuridique ?? null,
                    idccSelections: nextSelections as Prisma.InputJsonValue,
                    selectedIdccKey,
                },
            })

            if (shouldUpdateAddress) {
                await this.upsertAddressForEnterprise(
                    savedEnterprise.idEnterprise,
                    input.address !== undefined ? input.address : currentEnterprise?.address?.address ?? null,
                    input.codePostal !== undefined ? input.codePostal : currentEnterprise?.address?.codePostal ?? null,
                    input.pays !== undefined ? input.pays : currentEnterprise?.address?.pays ?? null,
                )
            }

            const hydratedEnterprise = await this.findByUserId(userId)

            return {
                success: true,
                message: "Le profil entreprise a été mis à jour avec succès.",
                data: formatCompanyProfile(hydratedEnterprise),
            }
        } catch (err) {
            console.error(err)
            return {
                success: false,
                message: "Une erreur est survenue lors de la mise à jour du profil entreprise.",
            }
        }
    }

    // La suppression retire l' entreprise propre au user, sans affecter les autres comptes.
    async deleteByUser(userId: number): Promise<ReturnData> {
        try {
            const enterprise = await this.findByUserId(userId)

            if (!enterprise) {
                return {
                    success: false,
                    message: "Aucun profil entreprise n'est enregistré pour cet utilisateur.",
                }
            }

            await prisma.enterprise.delete({
                where: { userId },
            })

            return {
                success: true,
                message: "Le profil entreprise a été supprimé avec succès.",
            }
        } catch (err) {
            console.error(err)
            return {
                success: false,
                message: "Une erreur est survenue lors de la suppression du profil entreprise.",
            }
        }
    }

    // Quand un user ajoute une convention custom, elle rejoint directement la liste globale sélectionnable.
    async addCustomConventionCollective(userId: number, input: CustomConventionCollectiveDTO): Promise<ReturnData> {
        try {
            const user = await this.ensureUserExists(userId)

            if (!user) {
                return {
                    success: false,
                    message: "Aucun compte utilisateur n'a été retrouvé.",
                }
            }

            const currentEnterprise = await this.findByUserId(userId)
            const normalizedConventionCollective = normalizeConventionCollectiveItem(
                {
                    ...input,
                    source: "custom",
                },
                "custom",
            )

            if (!normalizedConventionCollective) {
                return {
                    success: false,
                    message: "La convention collective personnalisée est invalide.",
                }
            }

            const currentSelections = normalizeConventionCollectiveList(currentEnterprise?.idccSelections, "naf")
            const alreadyExists = currentSelections.some(
                (existingConventionCollective) =>
                    existingConventionCollective.key === normalizedConventionCollective.key,
            )

            if (alreadyExists) {
                return {
                    success: false,
                    message: "Cette convention collective personnalisée existe déjà pour cet utilisateur.",
                }
            }

            const nextSelections = mergeConventionCollectiveLists(
                currentSelections,
                [normalizedConventionCollective],
            )
            const selectedIdccKey = resolveSelectedIdccKey(nextSelections, currentEnterprise?.selectedIdccKey)

            await prisma.enterprise.upsert({
                where: { userId },
                update: {
                    idccSelections: nextSelections as Prisma.InputJsonValue,
                    selectedIdccKey,
                },
                create: {
                    userId,
                    idccSelections: nextSelections as Prisma.InputJsonValue,
                    selectedIdccKey,
                },
            })

            return {
                success: true,
                message: "La convention collective personnalisée a été ajoutée avec succès.",
                data: normalizedConventionCollective,
            }
        } catch (err) {
            console.error(err)
            return {
                success: false,
                message: "Une erreur est survenue lors de l'ajout d'une convention collective personnalisée.",
            }
        }
    }

    // La suppression d'une IDCC custom se fait par clé stable et ne touche jamais aux entrées issues du NAF.
    async deleteCustomConventionCollective(userId: number, selectedIdccKey: string): Promise<ReturnData> {
        try {
            const enterprise = await this.findByUserId(userId)

            if (!enterprise) {
                return {
                    success: false,
                    message: "Aucun profil entreprise n'est enregistré pour cet utilisateur.",
                }
            }

            const normalizedSelectedIdccKey = selectedIdccKey.trim()

            if (!normalizedSelectedIdccKey) {
                return {
                    success: false,
                    message: "La clé de convention collective est requise.",
                }
            }

            const currentSelections = normalizeConventionCollectiveList(enterprise.idccSelections, "naf")
            const conventionCollectiveToDelete = currentSelections.find(
                (selection) => selection.key === normalizedSelectedIdccKey,
            )

            if (!conventionCollectiveToDelete) {
                return {
                    success: false,
                    message: "Aucune convention collective correspondante n'a été trouvée.",
                }
            }

            if (conventionCollectiveToDelete.source !== "custom") {
                return {
                    success: false,
                    message: "Seules les conventions collectives personnalisées peuvent être supprimées.",
                }
            }

            const nextSelections = currentSelections.filter(
                (selection) => selection.key !== normalizedSelectedIdccKey,
            )
            const nextSelectedIdccKey = resolveSelectedIdccKey(nextSelections, enterprise.selectedIdccKey)

            await prisma.enterprise.update({
                where: { userId },
                data: {
                    idccSelections: nextSelections as Prisma.InputJsonValue,
                    selectedIdccKey: nextSelectedIdccKey,
                },
            })

            return {
                success: true,
                message: "La convention collective personnalisée a été supprimée avec succès.",
                data: {
                    deleted: conventionCollectiveToDelete,
                    selectedIdccKey: nextSelectedIdccKey,
                },
            }
        } catch (err) {
            console.error(err)
            return {
                success: false,
                message: "Une erreur est survenue lors de la suppression d'une convention collective personnalisée.",
            }
        }
    }
}
