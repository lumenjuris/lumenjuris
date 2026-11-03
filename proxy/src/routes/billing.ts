import { Router } from "express";
import { proxyAuthMiddleware as auth } from "../middleware/authMiddleware.js";
import { relayToNode, relayToNodeRaw } from "../relay.js";


export const billingRouter: Router = Router();



billingRouter.post("/customer", auth, (req, res) =>
  relayToNode(req, res, "/billing/customer"),
);

billingRouter.post("/create-checkout", auth, (req,res)=>{
  relayToNode(req,res, "/billing/create-checkout")
})


// Achat unitaire d'un article pour un contrat précis
billingRouter.post("/create-one-shot-checkout", auth, (req, res) =>
  relayToNode(req, res, "/billing/create-one-shot-checkout"),
);

billingRouter.get("/one-shot/:item/:contractRef", auth, (req, res) =>
  relayToNode(req, res, `/billing/one-shot/${encodeURIComponent(req.params.item as string)}/${encodeURIComponent(req.params.contractRef as string)}`),
);

// Livrables des achats unitaires (PDF, Word, fiche de synthèse)
billingRouter.get("/one-shot/purchases", auth, (req, res) =>
  relayToNode(req, res, "/billing/one-shot/purchases"),
);

billingRouter.get("/one-shot/:idBilling/files/:kind", auth, (req, res) =>
  relayToNodeRaw(req, res, `/billing/one-shot/${encodeURIComponent(req.params.idBilling as string)}/files/${encodeURIComponent(req.params.kind as string)}`),
);

billingRouter.post("/one-shot/:idBilling/resend-email", auth, (req, res) =>
  relayToNode(req, res, `/billing/one-shot/${encodeURIComponent(req.params.idBilling as string)}/resend-email`),
);


billingRouter.post("/payment-intent", auth, (req, res) =>
  relayToNode(req, res, "/billing/payment-intent"),
);

billingRouter.get("/plans", auth, (req, res) =>
  relayToNode(req, res, "/billing/plans"),
);

billingRouter.post("/subscription", auth, (req, res) =>
  relayToNode(req, res, "/billing/subscription"),
);

billingRouter.get("/subscription", auth, (req, res) =>
  relayToNode(req, res, "/billing/subscription"),
);

billingRouter.get("/invoices", auth, (req, res) =>
  relayToNode(req, res, "/billing/invoices"),
);

billingRouter.get("/invoices/:idFacture/pdf", auth, (req, res) =>
  relayToNodeRaw(req,res,`/billing/invoices/${encodeURIComponent(req.params.idFacture as string)}/pdf`
  )
);

billingRouter.post("/payment-failed", auth, (req, res) =>
  relayToNode(req, res, "/billing/payment-failed"),
);

billingRouter.put("/add-credits", auth, (req, res) =>
  relayToNode(req, res, "/billing/add-credits"),
);

billingRouter.put("/remove-credits", auth, (req, res) =>
  relayToNode(req, res, "/billing/remove-credits"),
);

billingRouter.get("/credits", auth, (req, res) =>
  relayToNode(req, res, "/billing/credits"),
);

billingRouter.post("/portal", auth, (req,res)=>{
  relayToNode(req,res, "/billing/portal")
})