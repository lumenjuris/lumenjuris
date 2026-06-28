import express from "express";
import type { Request, Response } from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import path from "path";
//import { Llm } from "./services/classLlm"
import { User } from "./src/services/classUser.js";
import routerGoogleAuth from "./src/route/authGoogle.js";
import routerLlm from "./src/route/apiLlm.js";
import routerUser from "./src/route/apiUser.js";
import routerEnterprise from "./src/route/apiEnterprise.js";
import routerContractHistory from "./src/route/apiContractHistory.js";
import routerChatHistory from "./src/route/apiChatHistory.js";
import routerBilling from "./src/route/apiBilling.js";
import routerVeille from "./src/route/apiVeille.js";
import routerUserUploads from "./src/route/apiUserUploads.js";
import routerFeedback from "./src/route/apiFeedback.js";
import routerTemplate from "./src/route/apiTemplate.js";
import routerSignature from "./src/route/apiSignature.js";
import routerContract from "./src/route/apiContract.js";
import routerClause from "./src/route/apiClause.js";
import routerAdmin from "./src/route/apiAdmin.js";
import routerNegotiation from "./src/route/apiNegotiation.js";
import cors from "cors";
import { seedBootstrapUsers } from "./src/services/bootstrapUsers.js";
import { seedPlans } from "./src/services/planSeeder.js";
// import { internalApiKeyMiddleware } from "./middleware/internalApiKeyMiddleware";
/**
 * Préparation du serveur nodejs/express pour ce backend
 * Ici sera traité toute les opérations avec la base de données
 */

const HOST_PROXY: string =
  process.env.HOST_PROXY ||
  (process.env.NODE_ENV == "dev"
    ? "http://localhost:3000"
    : "https://proxy.lumenjuris.com");

const app = express();
app.set("etag", false);
const port = process.env.PORT || 3020;
app.use(express.json({ limit: "20mb" }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3020", HOST_PROXY],
    credentials: true,
  }),
);

// app.use(internalApiKeyMiddleware);

app.use("/userassets", express.static(path.join(process.cwd(), "userassets")));
app.use("/", routerGoogleAuth);
app.use("/llm", routerLlm);
app.use("/user", routerUser);
app.use("/enterprise", routerEnterprise);
app.use("/contract-history", routerContractHistory);
app.use("/chat-history", routerChatHistory);
app.use("/billing", routerBilling);
app.use("/veille", routerVeille);
app.use("/user-uploads", routerUserUploads);
app.use("/feedback", routerFeedback);
app.use("/template", routerTemplate);
app.use("/signature-envelope", routerSignature);
app.use("/contract", routerContract);
app.use("/clause", routerClause);
app.use("/admin", routerAdmin);
app.use("/negotiation", routerNegotiation);

app.get("/health", (req: Request, res: Response) => {
  return res.status(200).json({
    health: true,
    port,
  });
});

async function sandbox() {
  //Vous pouvez faire vos testes içi
  console.log("Sandbox running");
  const user = await new User().create({
    email: "julienmessage@gmail.com",
    nom: "Doe",
    prenom: "Serge",
    password: "azertyuioP1.",
    cgu: true,
  });
  console.log(user, " ");
}

app.listen(port, async () => {
  console.log(`Serveur backend nodejs running on port ${port}`);
  try {
    await seedBootstrapUsers();
  } catch (err) {
    console.error(
      "Erreur lors de l'initialisation des utilisateurs de bootstrap:",
      err,
    );
  }
  try {
    await seedPlans();
  } catch (err) {
    console.error("Erreur lors du seeding des plans:", err);
  }
  //await sandbox()
});
