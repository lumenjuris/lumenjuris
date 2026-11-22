import { Router } from "express"
import { ContractQuestion } from "../services/classContractQuestion.js"


export const routerQuestionGeneratorContract = Router()
const contractQuestion = new ContractQuestion()
// "/generate-question"


//Renvois un boolean si le contrat est en status READY
routerQuestionGeneratorContract.get("/status/is-ready", async (req, res) => {
    const contractType = req.query.contractType

    if (typeof contractType !== "string" || !contractType) {
        return res.status(400).json({
            success: false,
            message: "Type de contrat manquant",
        });
    }

    const getStatus = await contractQuestion.isReady(contractType)

    return res.status(200).json({
        isReady: getStatus
    })

})


//Get d'une question avec query /question?contractType=xxx
routerQuestionGeneratorContract.get("/question", async (req, res) => {
    const contractType = req.query.contractType

    if (typeof contractType !== "string" || !contractType) {
        return res.status(400).json({
            success: false,
            message: "Type de contrat manquant",
        });
    }

    const getQuestion = await contractQuestion.findUniqueFinalQuestionsByContractType(contractType)

    return res.status(200).json({
        ...getQuestion
    })

})



// Hydrater un contract type avec de nouvelles questions générées
routerQuestionGeneratorContract.post("/", async (req, res) => {
    
    const contractType = req.query.contractType
    if (typeof contractType !== "string" || !contractType) {
        return res.status(400).json({
            success: false,
            message: "Type de contrat manquant",
        });
    }
    const data = req.body
    if (!Array.isArray(data)) {
        return res.status(400).json({
            success: false,
            message: "Le corps doit être un tableau de questions",
        });
    }
    const put = await contractQuestion.post(contractType, data);

    return res.status(put.success ? 200 : 400).json({
        success : put.success,
        message : put.success ? "Les questions ont été ingérées avec succès." : "Une erreur est survenue avec l'ajout des questions."
    })
})