import jwt from "jsonwebtoken";
import { Response } from "express";

/**
 * Nom du claim qui marque un jeton « connexion en attente du second facteur ».
 *
 * Un jeton portant ce claim n'ouvre PAS la session : il ne sert qu'à atteindre
 * les routes de double authentification, le temps de saisir le code. Le proxy
 * refuse toute autre route tant que ce claim est présent, et le remplace par un
 * vrai jeton de session une fois le code validé.
 */
export const TWO_FACTOR_PENDING_CLAIM = "twoFactorPending";

/** Durée de vie du cookie de session complet : 7 jours. */
const DUREE_SESSION_MS = 1000 * 60 * 60 * 24 * 7;

/** Durée de vie du cookie d'attente 2FA : 15 min, comme le code envoyé. */
const DUREE_ATTENTE_2FA_MS = 1000 * 60 * 15;

/** Options communes à tous les cookies d'authentification. */
function optionsCookie(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // "lax" : le cookie n'est pas envoyé sur les requêtes cross-site (défense
    // CSRF), mais l'est sur les navigations de premier niveau (retour OAuth) et
    // entre sous-domaines lumenjuris.com (même site). Le complément Word, lui,
    // s'authentifie par un Bearer, pas par ce cookie.
    sameSite: "lax",
    // En prod, COOKIE_DOMAIN=.lumenjuris.com pour partager le cookie entre
    // les sous-domaines (proxy, backNode, front). Vide en dev => cookie
    // rattaché au host courant (localhost), comportement inchangé.
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: "/",
    maxAge,
  } as const;
}

/**
 * Pose le cookie de session complet. À n'appeler qu'une fois l'identité
 * pleinement vérifiée : mot de passe correct ET, si le compte l'exige, second
 * facteur validé.
 */
export function createCookieAuth(idUser: number, role: string, res: Response) {
  const jwtSigned = jwt.sign(
    {
      userId: idUser,
      role,
    },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );

  return res.cookie("authLumenJuris", jwtSigned, optionsCookie(DUREE_SESSION_MS));
}

/**
 * Pose le cookie d'attente : le mot de passe est bon mais le second facteur
 * n'est pas encore saisi. Ce jeton ne donne accès qu'aux routes de double
 * authentification (voir `TWO_FACTOR_PENDING_CLAIM`).
 */
export function createPendingTwoFactorCookie(
  idUser: number,
  role: string,
  res: Response,
) {
  const jwtSigned = jwt.sign(
    {
      userId: idUser,
      role,
      [TWO_FACTOR_PENDING_CLAIM]: true,
    },
    process.env.JWT_SECRET!,
    { expiresIn: "15m" },
  );

  return res.cookie(
    "authLumenJuris",
    jwtSigned,
    optionsCookie(DUREE_ATTENTE_2FA_MS),
  );
}
