import express from "express"
import type { Request, Response } from "express"
import crypto from "crypto"
import "dotenv/config";
import axios from "axios"
import jwt from "jsonwebtoken"
import cookieParser from "cookie-parser"




/**
 * Préparation du serveur nodejs/express pour ce backend
 * Ici sera traité toute les opérations avec la base de données
 */

const app = express()
const port = process.env.PORT || 3020
app.use(cookieParser())



app.get("/health", (req: Request, res: Response) => {

    return res.status(200).json({
        health: true,
        port
    })
})



//Route auth vers Google
app.get("/auth/google", (req: Request, res: Response) => {

    const state = crypto.randomUUID()
    res.cookie("google_oauth_state", state, {
        httpOnly: true
    })
    const clientId = process.env.GOOGLE_CLIENT_ID
    const redirectUri = "http://localhost:3020/auth/google/callback";
    const scope = "openid email profile";


    const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scope)}` +
        `&state=${state}`

    res.redirect(url)
})


//Route callback de l'auth google
app.get("/auth/google/callback", async (req: Request, res: Response) => {

    const { code, state } = req.query
    console.log({
        code,
        state
    })
    
    if (!process.env.JWT_SECRET) {
        throw new Error(".env JWT_SECRET is not defined");
    }

    //Verifier si le state est valide
    const storedState = req.cookies.google_oauth_state;

    if (!storedState || state !== storedState) {
        return res.status(400).send("Invalid State")
    }

    //state match on peut supprimer le cookie
    res.clearCookie("google_auth_state")


    //Echanger le code contre un token
    const tokenResponse = await axios.post(
        "https://oauth2.googleapis.com/token",
        new URLSearchParams({
            code: code as string,
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            redirect_uri: "http://localhost:3020/auth/google/callback",
            grant_type: "authorization_code",
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );


    //Recuperer les data user de google
    const userInfo = await axios.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
            headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` }
        }
    );

    const { sub: googleId, email, name, picture } = userInfo.data;
    console.log(userInfo.data)

    //Enregistrer dans la bdd


    //Créer session JWT cookie http only
    const token = jwt.sign({ userId: "userId" }, process.env.JWT_SECRET, { expiresIn: "7d" })

    res
        .cookie("auth", token, { httpOnly: true, secure: false })
        .redirect(`http://localhost:5173/analyzer`)
})






app.listen(port, () => {
    console.log(`Serveur backend nodejs running on port ${port}`);
    console.log("env", process.env.DATABASE_PASSWORD)
})