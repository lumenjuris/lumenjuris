import { prisma } from "../singletonPrisma.js"
import { StatusQuestion } from "@prisma/client"



/*
    Architecture de l'object Question qui doit être save
    {
        key : "start_date",
        question : "La question",
        propositionResponse : ["", "",]
        required : boolean,
        type : ""
    }
*/



export interface ContractQuestion {
    question: string;
    options: string[];
    type: string;
    hint: string;
}

export class ContractQuestion {


    private readonly COLLECTING_CAP_COUNT = 20




    // === RECUPERATION DES QUESTIONS ===

    //Recupère les questions d'un contrat en particulier
    async findUniqueQuestionsByContractType(contractType: string) {
        const data = await prisma.contractGeneratorQuestion.findUnique({
            where: { contractType },
            select: {
                status: true,
                questions: true
            }
        })
        return {
            success: !!data,
            message: data ? "Les questions ont été récupérées avec succès." : "Aucune question n'ont pu être récupéré sur le type de contrat " + contractType,
            data : data?.questions ?? null
        }
    }

    //Récupère tout les questions en fonction de leurs status
    async findQuestionByStatus(status : StatusQuestion){
        try{
            const items = await prisma.contractGeneratorQuestion.findMany({
                where : { status}
            })
            return {
                success:true,
                message :items.length > 0 ? "Les informations des questions ont été récupéré avec succès" : `Aucune questions de contrat ne possèdent le status : ${status}`,
                data : items
            }
        }catch(err){
            console.error(`Une erreur est survenue lors de la recherche de question par status  : \n status : ${status},\n error : ${err}`);
            return
        }
    }











    
    async post(contractType: string, questions: ContractQuestion[]) {
        try {
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
                const post = await prisma.contractGeneratorQuestion.create({
                    data: {
                        contractType: "",
                        questions: questions,
                    }
                })

                return {
                    success: true,
                    message: ""
                }
            } else {
                //Mise à jour 
                const updated = await this.put(contractType, questions)
            }


        } catch (err) {
            console.error(`Une erreur est survenue lors du post d'une nouvelle question contrat, error : \n ${err}`)
        }
    }



    async put(contractType: string, questions: ContractQuestion[]) {
        try {
            const origin = await prisma.contractGeneratorQuestion.findUnique({
                where: {
                    contractType: contractType
                }
            })
            if (!origin) {
                console.error("Une erreur est survenue lors de la mise à jours des questions d'un contrat, impossible de retrouver le contratType d'origine")
                return { success: false }
            }


            const status = origin.generationCount < this.COLLECTING_CAP_COUNT
                ? StatusQuestion.COLLECTING
                : StatusQuestion.REVIEW

            const questionspreview = origin?.questions as ContractQuestion[] | null
            const questionsUpdated = [
                ...(questionspreview ?? []),
                ...questions
            ]

            const updated = await prisma.contractGeneratorQuestion.update({
                where: { contractType: contractType },
                data: {
                    questions: questionsUpdated,
                    generationCount: (origin.generationCount++),
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
        }
    }



    // === GESTION DES STATUS

    //Update d'un status 
    async putStatus(contractType: string, status: StatusQuestion): Promise<boolean> {
        try {
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


}