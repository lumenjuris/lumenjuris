import { Router } from "express";
import type { Request, Response } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { UserMetadataService, validateUserMetadataPatch } from "../services/classUserMetadata.js";

/**
 * Onboarding de l'utilisateur connecté (`/user-metadata`).
 *
 *  - GET    : état du parcours + réponses (crée la ligne au premier appel) ;
 *  - POST   : enregistre des réponses (même traitement que PATCH) ;
 *  - PATCH  : enregistre une étape, termine ou refuse le parcours ;
 *  - DELETE : efface les réponses.
 *
 * L'utilisateur est toujours celui du jeton (`req.idUser`) : aucun identifiant
 * n'est lu dans le corps de la requête.
 */
export const routerUserMetaData = Router();

const SERVER_ERROR_MESSAGE = "Une erreur est survenue avec nos serveurs.";

routerUserMetaData.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await new UserMetadataService().get(Number(req.idUser));
    return res.status(200).json(result);
  } catch (err) {
    console.error("Une erreur est survenue sur la route GET de /user-metadata, error : \n", err);
    return res.status(500).json({ success: false, message: SERVER_ERROR_MESSAGE, data: null });
  }
});

/** Enregistrement des réponses, partagé par POST et PATCH. */
async function saveUserMetadata(req: Request, res: Response) {
  try {
    const validation = validateUserMetadataPatch(req.body);
    if (!validation.ok) {
      return res.status(400).json({ success: false, message: validation.message, data: null });
    }

    const result = await new UserMetadataService().update(Number(req.idUser), validation.patch);
    return res.status(200).json(result);
  } catch (err) {
    console.error(`Une erreur est survenue sur la route ${req.method} de /user-metadata, error : \n`, err);
    return res.status(500).json({ success: false, message: SERVER_ERROR_MESSAGE, data: null });
  }
}

routerUserMetaData.post("/", authMiddleware, saveUserMetadata);
routerUserMetaData.patch("/", authMiddleware, saveUserMetadata);

routerUserMetaData.delete("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await new UserMetadataService().reset(Number(req.idUser));
    return res.status(200).json(result);
  } catch (err) {
    console.error("Une erreur est survenue sur la route DELETE de /user-metadata, error : \n", err);
    return res.status(500).json({ success: false, message: SERVER_ERROR_MESSAGE, data: null });
  }
});
