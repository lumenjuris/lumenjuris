import type { Request, Response, NextFunction } from "express";

export function internalApiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {

  const expected = process.env.INTERNAL_API_KEY;
  const EXEMPT_PATHS = ["/health", "/auth/google", "/auth/google/callback", "/auth/microsoft", "/billing/stripe/webhook", "/user/verify", "/user/resetpassword"];
  // Correspondance sur une frontière de chemin : le chemin doit être exactement
  // une route exemptée, ou commencer par elle SUIVIE d'un "/". Un simple
  // startsWith exemptait aussi "/user/verifyXyz", plus large que voulu.
  const estExempte = EXEMPT_PATHS.some(
    (path) => req.path === path || req.path.startsWith(path + "/"),
  );
  if (estExempte) return next();
  if (!expected || req.headers["x-internal-api-key"] !== expected) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  next();
}
