import type { Request, Response, NextFunction } from "express";




/**
 * Methode pour contourner le blocage de O2switch des methodes PATCH par son parfeu
 * Les routes PATCH doivent être envoyées en methode POST avec le headers x-http-method-override
 * @param req 
 * @param _res 
 * @param next 
 */
export function methodOverrideMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const methodeDemandee = req.headers["x-http-method-override"];

  if (
    typeof methodeDemandee === "string" &&
    methodeDemandee.toUpperCase() === "PATCH"
  ) {
    req.method = "PATCH";
  }

  next();
}
