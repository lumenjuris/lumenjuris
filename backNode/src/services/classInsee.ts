import axios from "axios";

// Forme minimale des données INSEE attendues par le service métier Enterprise.
export type InseeEnterpriseData = {
    siren: string
    codeNaf: string | null
    conventionCollective: string | null
    statusJuridique: string | null
    name: string | null
    address: {
        address: string | null
        codePostal: string | null
        pays: string
    }
}

const conventionCollectiveByCodeNaf: Record<string, string> = {
}

export class Insee {
    // Wrapper HTTP centralisé pour l'API Sirene.
    private async get(path: string, params?: Record<string, string | boolean>) {
        const baseUrl = process.env.INSEE_API_URL || "https://api.insee.fr/api-sirene/3.11"
        const apiKey = process.env.INSEE_API_KEY

        if (!apiKey) {
            throw new Error("La clé API INSEE est manquante.")
        }

        const response = await axios.get(`${baseUrl}${path}`, {
            headers: {
                Accept: "application/json",
                "X-INSEE-Api-Key-Integration": apiKey,
            },
            params,
        })

        return response.data
    }

    private getCurrentPeriod(periodes?: any[]) {
        if (!Array.isArray(periodes) || periodes.length === 0) return null
        return periodes[0]
    }

    private getConventionCollective(codeNaf: string | null) {
        if (!codeNaf) return null
        return conventionCollectiveByCodeNaf[codeNaf] || null
    }

    // 1. lire l'unité légale à partir du SIREN
    // 2. récupérer le NIC du siège
    // 3. reconstruire le SIRET du siège
    // 4. lire l'établissement pour obtenir l'adresse
    async getEnterpriseDataBySiren(siren: string): Promise<InseeEnterpriseData> {
        if (!/^[0-9]{9}$/.test(siren)) {
            throw new Error("Le siren doit contenir exactement 9 chiffres.")
        }

        const sirenData = await this.get(`/siren/${siren}`, {
            masquerValeursNulles: true,
        })

        const uniteLegale = sirenData?.uniteLegale
        if (!uniteLegale) {
            throw new Error("Aucune unité légale trouvée.")
        }

        const periode = this.getCurrentPeriod(uniteLegale.periodesUniteLegale)
        const codeNaf =
            uniteLegale.activitePrincipaleNAF25UniteLegale ||
            periode?.activitePrincipaleUniteLegale ||
            null

        // Le NIC du siège complète le SIREN pour former le SIRET du siège social.
        const nicSiege = periode?.nicSiegeUniteLegale
        const siretSiege = nicSiege ? `${uniteLegale.siren}${nicSiege}` : null

        let etablissement = null
        if (siretSiege && /^[0-9]{14}$/.test(siretSiege)) {
            const siretData = await this.get(`/siret/${siretSiege}`, {
                masquerValeursNulles: true,
            }).catch(() => null)

            etablissement = siretData?.etablissement || null
        }

        const adresse =
            etablissement?.adresseEtablissement ||
            etablissement?.adresse2Etablissement ||
            null

        // Recompose une adresse lisible à partir des champs détaillés renvoyés par INSEE.
        const address = [
            adresse?.numeroVoieEtablissement,
            adresse?.indiceRepetitionEtablissement,
            adresse?.typeVoieEtablissement,
            adresse?.libelleVoieEtablissement,
            adresse?.libelleCommuneEtablissement,
        ]
            .filter(Boolean)
            .join(" ")
            .trim() || null

        return {
            siren: uniteLegale.siren,
            codeNaf,
            conventionCollective: this.getConventionCollective(codeNaf),
            statusJuridique: periode?.categorieJuridiqueUniteLegale || null,
            name:
                periode?.denominationUniteLegale ||
                periode?.denominationUsuelle1UniteLegale ||
                periode?.nomUniteLegale ||
                null,
            address: {
                address,
                codePostal: adresse?.codePostalEtablissement || null,
                pays: adresse?.libellePaysEtrangerEtablissement || "FRANCE",
            },
        }
    }
}
