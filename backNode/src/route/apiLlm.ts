import type { Request, Response, Router } from "express"
import express from "express"
import { Llm } from "./../services/classLlm"

const routerLlm: Router = express.Router()

interface PutParams extends Record<string, string> {
    model: string
    tokenInput: string
    tokenOutput: string
}

routerLlm.get(
    "/usage",
    async (_req: Request, res: Response) => {
        try {
            const llm = new Llm()
            const currentUsage = await llm.getCurrentUsage()

            return res
                .status(currentUsage.success ? 200 : 500)
                .json(currentUsage)
        } catch (err) {
            console.error(err)
            return res
                .status(500)
                .json({
                    success: false,
                    message: "Une erreur est survenue avec le serveur.",
                    usage: [],
                })
        }
    },
)

routerLlm.put(
    "/increment/:model/:tokenInput/:tokenOutput",
    async (req: Request<PutParams>, res: Response) => {
        try {
            const { model, tokenInput, tokenOutput } = req.params
            const allowedModels = ["gpt-4o", "gpt-4o-mini", "gpt-5.2", "gpt-5.4-nano"]

            if (!allowedModels.includes(model)) {
                return res.status(400).json({
                    success: false,
                    message: `Le model ${model} n'est pas valide.`,
                    error: "Bad request",
                })
            }

            const inputError = () => {
                return res.status(400).json({
                    success: false,
                    message: "Token input and output must be number",
                    error: "Bad request",
                })
            }

            const input = Number(tokenInput)
            const output = Number(tokenOutput)

            if (Number.isNaN(input) || input < 0) {
                return inputError()
            }

            if (Number.isNaN(output) || output < 0) {
                return inputError()
            }

            const llm = new Llm()
            const updated = await llm.incrementUsage(model, input, output)

            return res
                .status(updated.success ? 200 : 500)
                .json({
                    success: updated.success,
                    message: updated.message,
                })
        } catch (err) {
            console.error(err)
            return res
                .status(500)
                .json({
                    success: false,
                    message: "Une erreur est survenue avec le serveur.",
                })
        }
    },
)

export default routerLlm
