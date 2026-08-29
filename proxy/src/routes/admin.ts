import { Router } from "express"
import { proxyAuthMiddleware as auth } from "../middleware/authMiddleware.js";
import { relayToNode, relayToNodeRaw, withQuery } from "../relay.js";





export const adminRouter: Router = Router()


// ─── Administration (gestion des utilisateurs & rôles) ───
adminRouter.get("/users", auth, (req, res) =>
    relayToNode(req, res, "/admin/users")
);

adminRouter.patch("/users/:idUser/role", auth, (req, res) =>
    relayToNode(req, res, `/admin/users/${encodeURIComponent(req.params.idUser as string)}/role`)
);

adminRouter.patch("/users/:idUser/plan", auth, (req, res) => 
    relayToNode(req, res, `/admin/users/${encodeURIComponent(req.params.idUser as string)}/plan`)
);

adminRouter.get("/revenue", auth, (req, res) =>
    relayToNode(req, res, "/admin/revenue")
);

adminRouter.get("/users/:idUser/details", auth, (req, res) =>
    relayToNode(req, res, `/admin/users/${encodeURIComponent(req.params.idUser as string)}/details`)
);

adminRouter.patch("/users/:idUser/ban", auth, (req, res) =>
    relayToNode(req, res, `/admin/users/${encodeURIComponent(req.params.idUser as string)}/ban`)
);

adminRouter.get("/feature-usage", auth, (req, res) =>
    relayToNode(req, res, `/admin/feature-usage${req.query.days
        ? `?days=${encodeURIComponent(req.query.days as string)}`
        : ""}`)
);

adminRouter.get("/feature-usage/users/:idUser", auth, (req, res) =>
    relayToNode(req, res, `/admin/feature-usage/users/${encodeURIComponent(req.params.idUser as string)}${req.query.days
        ? `?days=${encodeURIComponent(req.query.days as string)}`
        : ""}`)
);

adminRouter.get("/overview", auth, (req, res) =>
    relayToNode(req, res, "/admin/overview")
);

// ─── Fiscalité (récap TVA mensuel + export des factures) ───
adminRouter.get("/fiscalite", auth, (req, res) =>
    relayToNode(req, res, withQuery("/admin/fiscalite", req))
);

// Export binaire (ZIP de PDF) : passthrough pour préserver le fichier.
adminRouter.get("/fiscalite/factures-zip", auth, (req, res) =>
    relayToNodeRaw(req, res, withQuery("/admin/fiscalite/factures-zip", req))
);

// Export CSV : passthrough pour préserver le fichier et son content-disposition.
adminRouter.get("/fiscalite/factures-csv", auth, (req, res) =>
    relayToNodeRaw(req, res, withQuery("/admin/fiscalite/factures-csv", req))
);
