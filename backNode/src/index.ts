import express from "express"
import type { Request, Response } from "express"
import "dotenv/config";
import cookieParser from "cookie-parser"
import { Mailer } from "./infrastructure/mailer/classMailer";
//import { Llm } from "./services/classLlm"
import routerGoogleAuth from "./route/authGoogle"
import routerLlm from "./route/apiLlm";
import routerUser from "./route/apiUser";

/**
 * Préparation du serveur nodejs/express pour ce backend
 * Ici sera traité toute les opérations avec la base de données
 */

const app = express()
const port = process.env.PORT || 3020
app.use(cookieParser())



app.use("/", routerGoogleAuth)
app.use("/llm", routerLlm)
app.use("/user/", routerUser)




app.get("/health", (req: Request, res: Response) => {

    return res.status(200).json({
        health: true,
        port
    })
})





async function sandbox(){
    const mailer = await  new Mailer("l.beaute@laposte.net").sendVerifyAccount("url", "beaute laurent")
}



app.listen(port, async () => {
    console.log(`Serveur backend nodejs running on port ${port}`);
    await sandbox()
})