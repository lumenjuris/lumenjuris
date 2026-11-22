import { prisma } from "../singletonPrisma.js"
import { StatusQuestion } from "@prisma/client"





export interface ContractQuestionJson {
    question: string;
    options: string[];
    type: string;
    hint: string;
}

// Une génération IA = un lot de questions horodaté (colonne `questions`)
export interface QuestionGeneration {
    generatedAt: string;
    questions: ContractQuestionJson[];
}


export class ContractQuestion {


    private readonly COLLECTING_CAP_COUNT = 20




    // === RECUPERATION DES QUESTIONS ===

    //Recupère les questions d'un contrat en particulier
    async findUniqueFinalQuestionsByContractType(contractType: string) {
        contractType = this.normalyzeContractType(contractType)
        const data = await prisma.contractGeneratorQuestion.findUnique({
            where: { contractType },
            select: {
                status: true,
                questionsFinal: true
            }
        })
        return {
            success: !!data,
            message: data ? "Les questions ont été récupérées avec succès." : "Aucune question n'ont pu être récupéré sur le type de contrat " + contractType,
            data: data?.questionsFinal ?? null
        }
    }

    //Récupère tout les questions en fonction de leurs status
    async findQuestionByStatus(status: StatusQuestion) {
        try {
            const items = await prisma.contractGeneratorQuestion.findMany({
                where: { status }
            })
            return {
                success: true,
                message: items.length > 0 ? "Les informations des questions ont été récupéré avec succès" : `Aucune questions de contrat ne possèdent le status : ${status}`,
                data: items
            }
        } catch (err) {
            console.error(`Une erreur est survenue lors de la recherche de question par status  : \n status : ${status},\n error : ${err}`);
            return
        }
    }











    // Entré principale pour ajouter de la data dans les questions, manage tout seul le process si il faut créer/update
    async post(contractType: string, questions: ContractQuestionJson[]) {
        try {
            contractType = this.normalyzeContractType(contractType)
            if (!contractType) return {
                success: false,
                message: "Le contractType doit être définit"
            }
            if (questions.length < 1) return {
                success: false,
                message: "Les questions du contrat ne peuvent pas être vides"
            }

            const isExisting = await prisma.contractGeneratorQuestion.findUnique({
                where: {
                    contractType: contractType
                },
                select: { questions: true, status: true, generationCount: true, }
            })

            if (!isExisting) {
                //Création si n'existe pas encore
                const firstGeneration: QuestionGeneration[] = [
                    { generatedAt: new Date().toISOString(), questions }
                ]
                await prisma.contractGeneratorQuestion.create({
                    data: {
                        contractType,
                        questions: firstGeneration as any,
                        lastGeneratedAt: new Date(),
                    }
                })
                return {
                    success: true,
                    message: "Les questions du contrat ont été créé avec succès.",
                    data: {
                        contractType,
                        questions
                    }
                }
            } else {
                //Mise à jour 
                const updated = await this.put(contractType, questions)
                return {
                    success: true,
                    question: updated
                }
            }


        } catch (err) {
            console.error(`Une erreur est survenue lors du post d'une nouvelle question contrat, error : \n ${err}`)
            return {
                success: false,
                message: "Erreur serveur lors de post questions contract"
            }
        }
    }



    async put(contractType: string, questions: ContractQuestionJson[]) {
        try {
            contractType = this.normalyzeContractType(contractType)
            const origin = await prisma.contractGeneratorQuestion.findUnique({
                where: {
                    contractType: contractType
                }
            })
            if (!origin) {
                console.error("Une erreur est survenue lors de la mise à jours des questions d'un contrat, impossible de retrouver le contratType d'origine")
                return { success: false }
            }

            // La collecte ne concerne que le statut COLLECTING : en REVIEW / READY / DISABLED
            // on n'ajoute plus rien et le statut ne recule jamais.
            if (origin.status !== StatusQuestion.COLLECTING) {
                return {
                    success: true,
                    message: `Collecte terminée pour ${contractType} (statut ${origin.status}), aucune donnée ajoutée.`,
                    data: null
                }
            }

            const newCount = origin.generationCount + 1
            const status = newCount >= this.COLLECTING_CAP_COUNT
                ? StatusQuestion.REVIEW
                : StatusQuestion.COLLECTING

            const questionsUpdated: QuestionGeneration[] = [
                ...this.toGenerations(origin.questions),
                { generatedAt: new Date().toISOString(), questions }
            ]

            const updated = await prisma.contractGeneratorQuestion.update({
                where: { contractType: contractType },
                data: {
                    questions: questionsUpdated as any,
                    generationCount: { increment: 1 },
                    lastGeneratedAt: new Date(),
                    status,
                },
                select: {
                    contractType: true,
                    questions: true,
                    status: true,
                    generationCount: true
                }
            })

            return {
                success: true,
                message: `Les questions ont été du contract Type ${contractType} ont été mise à jours avec succès.`,
                data: updated
            }
        } catch (err) {
            console.error("Une erreur est survenue lors de la mise à jours des questions d'un contrat pour la génération, error : \n", err)
            return {
                success:false,
            }
        }
    }



    // === GESTION DES STATUS

    //Update d'un status 
    async putStatus(contractType: string, status: StatusQuestion): Promise<boolean> {
        try {
            contractType = this.normalyzeContractType(contractType)
            const updated = await prisma.contractGeneratorQuestion.update({
                where: { contractType },
                data: { status }
            })
            return updated ? true : false
        } catch (err) {
            console.error(`Une erreur est survenue lors de la mise à jour du status d'un contrat, error :\n ${err}`)
            return false
        }
    }



    //Recherche si les questions sur un type de contrat sont de status READY pour injecter dans le workflow.
    async isReady(contractType: string): Promise<boolean> {
        try {
            contractType = this.normalyzeContractType(contractType)
            const searchByContractType = await prisma.contractGeneratorQuestion.findUnique({
                where: { contractType },
                select: { status: true }
            })

            return searchByContractType?.status === StatusQuestion.READY ? true : false

        } catch (err) {
            console.error(err)
            return false
        }
    }



    //=== utilitaires ===
    private normalyzeContractType = (contractType: string) => contractType.toLowerCase().trim()

    // Lit la colonne `questions` : nouveau format (lots) ou ancien format (tableau à plat, rangé en un seul lot)
    private toGenerations(raw: unknown): QuestionGeneration[] {
        if (!Array.isArray(raw) || raw.length === 0) return []
        const isNewFormat = raw.every((item: any) => Array.isArray(item?.questions))
        if (isNewFormat) return raw as QuestionGeneration[]
        return [{ generatedAt: "legacy", questions: raw as ContractQuestionJson[] }]
    }


}