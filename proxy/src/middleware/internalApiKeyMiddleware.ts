import type { NextFunction, Request, Response } from "express";

/**
 * Réserve une route aux appels serveur à serveur (backNode → proxy).
 * Le backNode envoie la clé partagée INTERNAL_API_KEY dans `x-internal-api-key` ;
 * un navigateur ne la connaît pas et reçoit 401.
 */
export function internalApiKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected || req.headers["x-internal-api-key"] !== expected) {
    res.status(401).json({ success: false, message: "Accès réservé aux appels internes." });
    return;
  }
  next();
}
