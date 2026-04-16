import type { Request, Response, Router } from "express";
import express from "express";
import { Llm } from "./../services/classLlm";
import { checkApiKey } from "../middleware/apiKeyMiddleware";
import { authMiddleware } from "../middleware/authMiddleware";

const routerLlm: Router = express.Router();

interface PutParams extends Record<string, string> {
  model: string;
  tokenInput: string;
  tokenOutput: string;
}

routerLlm.put(
  "/increment/:model/:tokenInput/:tokenOutput",
  checkApiKey,
  authMiddleware,
  async (req: Request<PutParams>, res: Response) => {
    const role = req.role;
    if (role !== "ADMIN") {
      res
        .status(401)
        .json({ message: "vous n'êtes pas autorisez à utiliser les LLM" });
    }
    try {
      const { model, tokenInput, tokenOutput } = req.params;
      const allowedModels = ["GPT-4o-mini", "GPT-5.2"];

      if (!allowedModels.includes(model)) {
        return res.status(400).json({
          success: false,
          message: `Le model ${model} n'est pas valide.`,
          error: "Bad request",
        });
      }

      const inputError = () => {
        return res.status(400).json({
          success: false,
          message: "Token input and output must be number",
          error: "Bad request",
        });
      };

      const input = Number(tokenInput);
      const output = Number(tokenOutput);

      if (Number.isNaN(input) || input < 0) {
        return inputError();
      }
      if (Number.isNaN(output) || output < 0) {
        return inputError();
      }

      const llm = new Llm();

      const updated = await llm.incrementUsage(model, input, output);

      return res.status(updated.success ? 200 : 500).json({
        success: updated.success,
        message: updated.message,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: "Une erreur est survenue avec le serveur.",
      });
    }
  },
);

export default routerLlm;
