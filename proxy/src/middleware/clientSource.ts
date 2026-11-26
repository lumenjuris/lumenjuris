import { AsyncLocalStorage } from "node:async_hooks";
import type { Request, Response, NextFunction } from "express";

/**
 * Origine d'un appel : plateforme web ou complément Word.
 *
 * Le complément envoie l'en-tête `x-lumen-client: word-addin` sur toutes ses
 * requêtes. Ce middleware le lit UNE fois, le range dans `res.locals.clientSource`
 * et dans un contexte asynchrone (AsyncLocalStorage) : le suivi d'usage
 * (tracking.ts) le retrouve ainsi sans qu'on ait à le passer à chaque appel
 * de trackFeature / withTracking dans les routes.
 *
 * Valeur non reconnue ou absente → "web" (liste blanche : un client ne peut
 * pas injecter une valeur arbitraire dans les statistiques).
 */
export const CLIENT_SOURCES = ["web", "word-addin"] as const;
export type ClientSource = (typeof CLIENT_SOURCES)[number];

const storage = new AsyncLocalStorage<{ source: ClientSource }>();

export function readClientSource(req: Request): ClientSource {
  const raw = String(req.headers["x-lumen-client"] ?? "").trim().toLowerCase();
  return (CLIENT_SOURCES as readonly string[]).includes(raw) ? (raw as ClientSource) : "web";
}

/** Origine de la requête en cours ("web" hors requête, ex. tâches planifiées). */
export function currentClientSource(): ClientSource {
  return storage.getStore()?.source ?? "web";
}

export function clientSourceMiddleware(req: Request, res: Response, next: NextFunction): void {
  const source = readClientSource(req);
  res.locals.clientSource = source;
  storage.run({ source }, () => next());
}
