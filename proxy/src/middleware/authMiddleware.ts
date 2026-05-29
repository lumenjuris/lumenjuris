import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

interface AuthPayload extends JwtPayload {
  userId: number;
  role: string;
}

export function proxyAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token: string | undefined = (
    req as Request & { cookies: Record<string, string> }
  ).cookies?.authLumenJuris;
  if (!token) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    res.locals.userId = payload.userId;
    res.locals.role = payload.role ?? "USER";

    const refreshed = jwt.sign(
      { userId: payload.userId, role: res.locals.role },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" },
    );
    res.cookie("authLumenJuris", refreshed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    next();
  } catch {
    res
      .status(401)
      .json({ success: false, message: "Token invalide ou expiré" });
  }
}
