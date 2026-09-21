import { Router } from "express"
import { proxyAuthMiddleware as auth } from "../middleware/authMiddleware.js";
import { relayToNode } from "../relay.js";



export const enterpriseRouter : Router = Router()




enterpriseRouter.get("/", auth, (req,res)=>{
    relayToNode(req, res, "/enterprise")
});

enterpriseRouter.put("/", auth,(req,res)=>{
    relayToNode(req, res, "/enterprise")
});


// Routes protégées (JWT vérifié par le proxy)
enterpriseRouter.get("/insee/:siren", auth, (req, res) => {
  if (typeof req.params.siren !== "string") {
    return res.status(400).json({
      success: false,
      message: "Bad request, le parsing du siren n'est pas conforme.",
    });
  }
  const siren = encodeURIComponent(req.params.siren);
  relayToNode(req, res, `/enterprise/insee/${siren}`);
});



enterpriseRouter.get("/capital/:siren", auth, (req, res) => {
  const siren = String(req.params.siren ?? "");
  if (!/^[0-9]{9}$/.test(siren)) {
    return res.status(400).json({ success: false, message: "SIREN invalide." });
  }
  relayToNode(req, res, `/enterprise/capital/${siren}`);
});
