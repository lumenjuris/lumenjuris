import dotenv from "dotenv";
import path from "path";

// Charge d'abord server/.env puis la racine.
// IMPORTANT : ce chargement vit ici (et non dans index.ts) pour qu'il s'exécute
// AVANT la lecture des variables ci-dessous. En ESM, un module importé est
// évalué avant le corps de celui qui l'importe : comme tous les modules du proxy
// importent `config`, dotenv est donc toujours chargé en premier.
dotenv.config({ path: path.resolve(process.cwd(), "server/.env") });
dotenv.config();

export const IS_PROD = process.env.NODE_ENV === "production";
export const PORT = Number(process.env.PORT || 3000);
export const BACKEND_URL = IS_PROD
  ? process.env.BACKEND_URL
  : "http://127.0.0.1:5678";
// En dev on utilise "localhost" (et non 127.0.0.1) : le navigateur traite
// 127.0.0.1 et localhost comme deux hosts différents, donc un cookie posé
// par le backNode sur 127.0.0.1 ne serait jamais renvoyé au front/proxy
// qui tournent sur localhost.
export const BACKNODE_URL = IS_PROD
  ? process.env.BACKNODE_URL
  : "http://localhost:3020";

/**
 * En-têtes à joindre à CHAQUE appel vers le serveur Python : il refuse (401)
 * toute requête sans la clé interne partagée (voir back/app/main.py).
 */
export function pythonHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
  };
}
