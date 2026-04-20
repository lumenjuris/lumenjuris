import jwt, { JwtPayload } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

interface CustomJwtPayload extends JwtPayload {
  idUser: string;
  role: string;
}

//MiddleWare pour vérifier la signature JWT d'un utilisateur et savoir si il est bien connecté.
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies.authLumenJuris;
  console.log("TOKEN FROM FRONT :", token);
  if (!token) {
    return res.status(401).send("Unauthorized");
  }
  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET!,
    ) as CustomJwtPayload;
    req.idUser = payload.userId;
    req.role = payload.role;
    next();
    console.log("PAYLOAD :", payload);
  } catch (err) {
    console.error(err);
    res.status(401).send("Token invalide ou expiré");
  }
}

export function authMiddlewareAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).send("Unauthorized");
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET!,
    ) as CustomJwtPayload;
    if (payload.role !== "ADMIN") {
      return res.status(401).send("Unauthorized");
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(401).send("Token invalide ou expiré");
  }
}
