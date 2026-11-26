import express from "express";
import type { Request, Response, Router } from "express";
import { prisma } from "../../prisma/singletonPrisma.js";
import { internalApiKeyMiddleware } from "../middleware/internalApiKeyMiddleware.js";

const router: Router = express.Router();

// POST /feature-event — enregistrement interne d'un usage (appelé par le proxy, non exposé au front).
router.post("/", internalApiKeyMiddleware, async (req: Request, res: Response) => {
  try {
    const { feature, userId, source } = req.body as { feature?: unknown; userId?: unknown; source?: unknown };
    // Origine de l'appel, fixée par le proxy (liste blanche) : "web" par défaut.
    const origine = source === "word-addin" ? "word-addin" : "web";
    if (typeof feature !== "string" || !feature.trim()) {
      return res.status(400).json({ success: false, message: "feature requis." });
    }
    await prisma.featureUsage.create({
      data: {
        feature: feature.trim().slice(0, 64),
        userId: typeof userId === "number" && Number.isFinite(userId) ? userId : null,
        source: origine,
      },
    });
    return res.status(201).json({ success: true });
  } catch (err) {
    console.error("[feature-event] error:", err);
    return res.status(500).json({ success: false });
  }
});

export default router;
