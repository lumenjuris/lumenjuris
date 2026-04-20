import express from "express";
import type { Request, Response } from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import { Mailer } from "./infrastructure/mailer/classMailer";
//import { Llm } from "./services/classLlm"
import { User } from "./services/classUser";
import routerGoogleAuth from "./route/authGoogle";
import routerLlm from "./route/apiLlm";
import routerUser from "./route/apiUser";
import routerEnterprise from "./route/apiEnterprise";
import cors from "cors";

/**
 * Préparation du serveur nodejs/express pour ce backend
 * Ici sera traité toute les opérations avec la base de données
 */

const app = express();
const port = process.env.PORT || 3020;
app.use(express.json());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3020"],
    credentials: true,
  }),
);

app.use("/", routerGoogleAuth);
app.use("/llm", routerLlm);
app.use("/user", routerUser);
app.use("/enterprise", routerEnterprise);

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
  //await sandbox()
});
