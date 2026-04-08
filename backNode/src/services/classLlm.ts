import { prisma } from "../../prisma/singletonPrisma"



export class Llm {


    //Initialisation des models IA LLM de l'application pour monitoring
    async setLlm() {
        try {
            const models = [
                { name: "GPT-4o-mini", pricePerMillionTokenInput: (0.15 * 100), pricePerMillionTokenOutput: (0.6 * 100) },
                { name: "GPT-5.2", pricePerMillionTokenInput: (1.75 * 100), pricePerMillionTokenOutput: (14 * 100) },
            ]


            for (const model of models) {
                await prisma.llm.upsert({
                    where: { name: model.name },
                    update: {
                        tokenPriceInput: model.pricePerMillionTokenInput,
                        tokenPriceOutput: model.pricePerMillionTokenOutput
                    },
                    create: {
                        name: model.name,
                        tokenPriceInput: model.pricePerMillionTokenInput,
                        tokenPriceOutput: model.pricePerMillionTokenOutput
                    }
                })
            }
        } catch (err) {
            console.error(err)
            return {
                success: false,
                message: "Une erreur est survenue lors de l'initialisation du dictionnaire de modèles LLM dans la base de données."
            }
        }
    }


    

    /**
     * Incrementation des tokens utilisés lors du fonctionement de l'application
     * @param {string} model 
     * @param {number} input 
     * @param {number} output 
     * @returns 
     */
    async incrementUsage(model: string, input: number, output: number) {
        try {

            const llmModel = await prisma.llm.findUnique({
                where: { name: model }
            })

            if (!llmModel) {
                return {
                    success: false,
                    message: `Model ${model} introuvable dans la table llm`
                }
            }
            const { idLlm, tokenPriceInput, tokenPriceOutput } = llmModel


            //prix 
            const totalCost =
                (input * tokenPriceInput / 1_000_000) +
                (output * tokenPriceOutput / 1_000_000)

            const today = new Date()
            const startAt = new Date(today.getFullYear(), today.getMonth(), 1)

            const expiresAt = new Date(startAt)
            expiresAt.setMonth(expiresAt.getMonth() + 1)

            await prisma.llmUsage.upsert({
                where: {
                    llmId_startAt: {
                        llmId: idLlm,
                        startAt
                    }
                },
                update: {
                    tokenInput: { increment: input },
                    tokenOutput: { increment: output },
                    totalCostEuro: { increment: totalCost }
                },
                create: {
                    llmId: idLlm,
                    startAt,
                    expiresAt,
                    tokenInput: input,
                    tokenOutput: output,
                    totalCostEuro: totalCost / 100 //Mettre la valeur de centime en euro
                }
            })


            return {
                success: true,
                message: `Les token utilisés pour le model ${model} ont été mis à jour avec succès.`
            }

        } catch (err) {
            console.error(err)
            return {
                success: false,
                message: "Une erreur est survenue lors de la mise à jour de l'utilisation de token llm"
            }
        }
    }
}