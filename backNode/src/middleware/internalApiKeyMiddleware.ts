import type { Request, Response, NextFunction } from "express";

export function internalApiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.path === "/health") {
    return next();
  }

  const expected = process.env.INTERNAL_API_KEY;
  if (!expected || req.headers["x-internal-api-key"] !== expected) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  next();
}
