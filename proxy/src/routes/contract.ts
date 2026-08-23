import { Router, type Request } from "express";
import { proxyAuthMiddleware as auth } from "../middleware/authMiddleware.js";
import {
  relayToNode,
  relayToNodeRaw,
  relayStreamToPython,
  withQuery,
} from "../relay.js";
import { trackFeature } from "../tracking.js";

// Monté sur "/api/contract" — chemins relatifs.
// ⚠ L'ordre compte : routes statiques et /comments/ AVANT les routes /:externalId.
export const contractRouter: Router = Router();

const eid = (req: Request) =>
  encodeURIComponent(req.params.externalId as string);

// Extraction IA des métadonnées (multipart → Python). Aucune écriture base.
contractRouter.post("/extract", auth, (req, res) =>
  relayStreamToPython(req, res, "/extract-contract-metadata"),
);

// Routes statiques AVANT les routes paramétrées /:externalId
contractRouter.get("/capacity", auth, (req, res) =>
  relayToNode(req, res, "/contract/capacity"),
);
contractRouter.get("/stats", auth, (req, res) =>
  relayToNode(req, res, "/contract/stats"),
);
contractRouter.get("/deadlines", auth, (req, res) =>
  relayToNode(req, res, withQuery("/contract/deadlines", req)),
);
contractRouter.get("/export.csv", auth, (req, res) =>
  relayToNodeRaw(req, res, withQuery("/contract/export.csv", req)),
);
contractRouter.get("/tags", auth, (req, res) =>
  relayToNode(req, res, "/contract/tags"),
);
contractRouter.post("/tags", auth, (req, res) =>
  relayToNode(req, res, "/contract/tags"),
);
contractRouter.delete("/tags/:externalId", auth, (req, res) =>
  relayToNode(req, res, `/contract/tags/${eid(req)}`),
);
contractRouter.get("/folders", auth, (req, res) =>
  relayToNode(req, res, "/contract/folders"),
);
contractRouter.post("/folders", auth, (req, res) =>
  relayToNode(req, res, "/contract/folders"),
);
contractRouter.delete("/folders/:externalId", auth, (req, res) =>
  relayToNode(req, res, `/contract/folders/${eid(req)}`),
);

// Liste + création
contractRouter.get("/", auth, (req, res) =>
  relayToNode(req, res, withQuery("/contract", req)),
);
contractRouter.post("/", auth, (req, res) => {
  void trackFeature("contract_library", res.locals.userId as number | undefined);
  relayToNode(req, res, "/contract");
});

// Sous-ressources d'un contrat
contractRouter.get("/:externalId/document", auth, (req, res) =>
  relayToNodeRaw(req, res, `/contract/${eid(req)}/document`),
);
contractRouter.get("/:externalId/audit", auth, (req, res) =>
  relayToNode(req, res, `/contract/${eid(req)}/audit`),
);
contractRouter.post("/:externalId/validate-field", auth, (req, res) =>
  relayToNode(req, res, `/contract/${eid(req)}/validate-field`),
);
contractRouter.post("/:externalId/amendment", auth, (req, res) =>
  relayToNode(req, res, `/contract/${eid(req)}/amendment`),
);
contractRouter.post("/:externalId/version", auth, (req, res) =>
  relayToNode(req, res, `/contract/${eid(req)}/version`),
);
contractRouter.post("/:externalId/snapshot", auth, (req, res) =>
  relayToNode(req, res, `/contract/${eid(req)}/snapshot`),
);
contractRouter.post("/:externalId/archive", auth, (req, res) =>
  relayToNode(req, res, `/contract/${eid(req)}/archive`),
);
// Négociation — commentaires + approbation (/comments/ avant /:externalId)
contractRouter.post("/:externalId/comments", auth, (req, res) =>
  relayToNode(req, res, `/contract/${eid(req)}/comments`),
);
contractRouter.post("/:externalId/approval", auth, (req, res) =>
  relayToNode(req, res, `/contract/${eid(req)}/approval`),
);
contractRouter.delete("/comments/:commentId", auth, (req, res) =>
  relayToNode(
    req,
    res,
    `/contract/comments/${encodeURIComponent(req.params.commentId as string)}`,
  ),
);
contractRouter.patch("/comments/:commentId/resolve", auth, (req, res) =>
  relayToNode(
    req,
    res,
    `/contract/comments/${encodeURIComponent(req.params.commentId as string)}/resolve`,
  ),
);
contractRouter.get("/:externalId", auth, (req, res) =>
  relayToNode(req, res, `/contract/${eid(req)}`),
);
contractRouter.patch("/:externalId", auth, (req, res) =>
  relayToNode(req, res, `/contract/${eid(req)}`),
);
contractRouter.delete("/:externalId", auth, (req, res) =>
  relayToNode(req, res, `/contract/${eid(req)}`),
);
