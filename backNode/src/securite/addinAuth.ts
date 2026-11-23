import jwt from "jsonwebtoken";
import type { Response } from "express";

/**
 * Connexion Google / Microsoft depuis le complément Word.
 *
 * Le complément ouvre la connexion dans une fenêtre de dialogue Office
 * (Office.context.ui.displayDialogAsync) : Google et Microsoft refusent de
 * s'afficher dans l'iframe du volet. Au retour OAuth, on ne pose PAS de cookie
 * (l'iframe Word ne le recevrait pas) : on renvoie la fenêtre vers la page
 * `auth-dialog.html` du complément, avec le JWT dans le fragment d'URL (#),
 * jamais transmis aux serveurs. Cette page le remet au volet via messageParent.
 */
export const ADDIN_URL = (process.env.ADDIN_URL || "https://localhost:3001").replace(/\/$/, "");

/** Même jeton que /api/addin/session côté proxy (Bearer, 7 jours). */
export function signAddinToken(idUser: number, role: string): string {
  return jwt.sign({ userId: idUser, role }, process.env.JWT_SECRET!, { expiresIn: "7d" });
}

export function redirectAddin(res: Response, result: { token?: string; error?: string }) {
  const params = new URLSearchParams(result as Record<string, string>);
  return res.redirect(`${ADDIN_URL}/auth-dialog.html#${params.toString()}`);
}
