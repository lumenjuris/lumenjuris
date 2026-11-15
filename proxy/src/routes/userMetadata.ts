import { Router } from "express";
import { proxyAuthMiddleware as auth } from "../middleware/authMiddleware.js";
import { relayToNode } from "../relay.js";

/**
 * Onboarding de l'utilisateur connecté. Toutes les routes exigent une session :
 * c'est le proxy qui vérifie le jeton et transmet l'identité à backNode.
 */
export const routerUserMetadata: Router = Router();

routerUserMetadata.get("/", auth, (req, res) => {
  relayToNode(req, res, "/user-metadata");
});

routerUserMetadata.post("/", auth, (req, res) => {
  relayToNode(req, res, "/user-metadata");
});

routerUserMetadata.patch("/", auth, (req, res) => {
  relayToNode(req, res, "/user-metadata");
});

routerUserMetadata.delete("/", auth, (req, res) => {
  relayToNode(req, res, "/user-metadata");
});
