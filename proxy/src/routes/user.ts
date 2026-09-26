import { Router } from "express"
import { proxyAuthMiddleware as auth } from "../middleware/authMiddleware.js";
import { relayToNode } from "../relay.js";

export const userRouter: Router = Router()
const BACKNODE_URL = process.env.BACKNODE_URL

// Routes publiques (pas d'auth requise)
userRouter.post("/signup", (req, res) => {
  relayToNode(req, res, "/user/create");
});


userRouter.post("/auth/forgotpassword", (req, res) => {
  relayToNode(req, res, "/user/forgotpassword");
});

userRouter.post("/resetpassword", (req, res) => {
  relayToNode(req, res, "/user/updatepassword");

});


userRouter.post("/resend-verify", (req,res)=>{
  relayToNode(req,res, "/user/resend-verify")

});

// Activation d'un compte par code (utilisateur pas encore connecté).
userRouter.post("/verify-code", (req, res) => {
  relayToNode(req, res, "/user/verify-code");
});

userRouter.post("/auth/login", (req,res)=>{
    relayToNode(req,res, "/user/auth/login")
});


userRouter.post("/auth/logout", auth, (req,res)=>{
    relayToNode(req, res, "/user/auth/logout")
});

userRouter.get("/get", auth, (req,res)=>{
    relayToNode(req, res, "/user/get")
});

userRouter.put("/", auth, (req,res)=>{
    relayToNode(req, res, "/user")
});

userRouter.get("/preferences", auth, (req,res)=>{
    relayToNode(req, res, "/user/preferences")
});
userRouter.put("/preferences", auth, (req,res)=>{
    relayToNode(req, res, "/user/preferences")
});


userRouter.get("/preferences/ui", auth, (req,res)=>{
    relayToNode(req, res, "/user/preferences/ui")
});
userRouter.put("/preferences/ui", auth, (req,res)=>{
    relayToNode(req, res, "/user/preferences/ui")
});


userRouter.post("/two-factor", auth, (req,res)=>{
    relayToNode(req, res, "/user/two-factor")
});

userRouter.post("/two-factor/verify", auth, (req,res)=>{
    relayToNode(req, res, "/user/two-factor/verify")
});


userRouter.post("/export-data", auth, (req,res)=>{
    relayToNode(req, res, "/user/export-data")
});


userRouter.post("/confirm-delete", auth, (req,res)=>{
    relayToNode(req, res, "/user/confirm-delete")
});

userRouter.post("/account", auth, (req,res)=>{
    relayToNode(req, res, "/user/account")
});


userRouter.get("/auth/google", (req, res) => {
  console.log("[proxy/google] redirect vers :", `${BACKNODE_URL}/api/user/auth/google`);
  console.log("[proxy/google] cookies entrants :", req.headers.cookie);
  res.redirect(`${BACKNODE_URL}/auth/google`);
});

userRouter.get("/auth/microsoft", (req, res) => {
  console.log("[proxy/microsoft] redirect vers :", `${BACKNODE_URL}/auth/microsoft`);
  console.log("[proxy/microsoft] cookies entrants :", req.headers.cookie);
  res.redirect(`${BACKNODE_URL}/auth/microsoft`);
});