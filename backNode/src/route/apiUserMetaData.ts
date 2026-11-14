import { Router } from "express"
import { prisma } from "../singletonPrisma.js";


export const routerUserMetaData = Router();


routerUserMetaData.get("/", async(req, res)=>{
try{
    
    const data = "";
    
    return res.status(200).json({
        success:true,
        message : "Les metadata de l'utilisateur ont été récupéré avec succès.",
        data,
    })
}catch(err){
    console.error("Une erreur est survenue sur la route GET de /user-metada, error : \n",err)
}
})

routerUserMetaData.post("/", async (req,res)=>{
    try{
        const data = "";

        return res.status(200).json({
            success:true,
            message : "Les metadata de l'utilisateur ont été créées avec succès.",
            data,
        })
    }catch(err){
        console.error("Une erreur est survenue sur la route POST de /user-metada, error : \n",err);
        return res.status(500).json({
            success:false,
            message: "Une erreur est survenue avec nos serveurs";
            data : null
        })
    }
})
