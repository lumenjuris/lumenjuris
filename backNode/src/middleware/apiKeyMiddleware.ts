import { RequestHandler, Response } from "express";

export const checkApiKey: RequestHandler = (req, res, next): void => {
    const apiKey = req.headers["x-api-key"];

    if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
        res.status(401).json({        
            success: false,
            message: "Unauthorized",
        });
        return;                          
    }

    next();
};