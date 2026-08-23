import type { Request, Response, NextFunction } from "express";

export function internalApiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {

  const expected = process.env.INTERNAL_API_KEY;
  const EXEMPT_PATHS = ["/health", "/auth/google", "/auth/google/callback", "/billing/stripe/webhook", "/user/verify", "/user/resetpassword"];
  if (EXEMPT_PATHS.some(path => req.path.startsWith(path))) return next();
  if (!expected || req.headers["x-internal-api-key"] !== expected) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  next();
}
