import { Request, Response, NextFunction } from "express";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const userId = req.headers["x-user-id"] as string | undefined;
  if (!userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  req.idUser = userId;
  req.role = (req.headers["x-user-role"] as string) || "USER";
  next();
}

export function authMiddlewareAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  authMiddleware(req, res, () => {
    if (req.role !== "ADMIN") {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    next();
  });
}
