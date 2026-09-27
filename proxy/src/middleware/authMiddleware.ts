import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

interface AuthPayload extends JwtPayload {
  userId: number;
  role: string;
  /**
   * Présent et vrai tant que la connexion attend le second facteur. Un tel
   * jeton n'ouvre pas la session : il n'atteint que les routes ci-dessous.
   */
  twoFactorPending?: boolean;
}

/**
 * Routes accessibles avec un jeton d'attente 2FA : la saisie / le renvoi du
 * code, et la déconnexion (pour annuler proprement). Tout le reste est refusé
 * tant que le second facteur n'est pas validé.
 */
function estAutoriseePendantAttente2FA(req: Request): boolean {
  const chemin = req.originalUrl.split("?")[0];
  return chemin.includes("/two-factor") || chemin.endsWith("/auth/logout");
}

export function proxyAuthMiddleware( req: Request, res: Response, next: NextFunction): void {
  // Cookie (front web) ou header Authorization: Bearer (complément Word,
  // où le cookie httpOnly cross-site n'est pas transmis par le navigateur).
  const cookieToken: string | undefined = (
    req as Request & { cookies: Record<string, string> }
  ).cookies?.authLumenJuris;



  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : undefined;
  const token = cookieToken ?? bearerToken;

  if (!token) {
    // Aucun jeton : accès refusé, en dev comme en prod. Le laissez-passer « dev »
    // qui existait ici était un fail-open : la moindre valeur de NODE_ENV autre
    // que "production" ouvrait toutes les routes protégées. Le complément Word
    // s'authentifie par un Bearer (traité plus haut), il n'en dépendait pas.
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }


  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    res.locals.userId = payload.userId;
    res.locals.role = payload.role ?? "USER";

    // Connexion en attente du second facteur : le jeton ne vaut que pour les
    // routes 2FA. On NE rafraîchit PAS le cookie ici — le rafraîchissement
    // reposerait un jeton sans le marqueur d'attente et rouvrirait la faille.
    // Le vrai cookie de session est délivré par /two-factor/verify, une fois le
    // code validé.
    if (payload.twoFactorPending === true) {
      if (!estAutoriseePendantAttente2FA(req)) {
        res.status(401).json({
          success: false,
          message: "Second facteur requis pour accéder à cette ressource.",
        });
        return;
      }
      next();
      return;
    }

    const refreshed = jwt.sign(
      { userId: payload.userId, role: res.locals.role },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" },
    );
    res.cookie("authLumenJuris", refreshed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      domain: process.env.COOKIE_DOMAIN || undefined,
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
