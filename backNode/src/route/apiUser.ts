import express from "express"
import type { Request, Response, Router } from "express"


const apiUser: Router = express.Router()

apiUser.post("/create", async (req: Request, res: Response) => {
    try {
        const {email, nom, prenom, password} = req.body

        //créer l'user dans la base de données

        //envoyer un email pour confirmer la création du compte


    } catch (err) {
        console.error(`Une erreur avec le serveur est survenue dans la route apiUSer/create, error : ${err}`)
        return res
            .status(500)
            .json({ success: false })
    }
})


export default apiUser