import jwt from "jsonwebtoken";
import { Response } from "express";

export function createCookieAuth(idUser: number, role: string, res: Response) {
  const jwtSigned = jwt.sign(
    {
      userId: idUser,
      role,
    },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );

  return res.cookie("authLumenJuris", jwtSigned, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 jours
  });
}
