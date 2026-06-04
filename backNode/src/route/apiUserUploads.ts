import express from "express";
import type { Request, Response, Router } from "express";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { prisma } from "../../prisma/singletonPrisma";
import { authMiddleware } from "../middleware/authMiddleware";

const routerUserUploads: Router = express.Router();

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp",
]);

const ASSETS_DIR = path.join(process.cwd(), "userassets");

interface UploadedImage {
  filename: string;
  displayName: string;
}

function parseImages(raw: unknown): UploadedImage[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is UploadedImage =>
      item !== null &&
      typeof item === "object" &&
      typeof (item as UploadedImage).filename === "string" &&
      typeof (item as UploadedImage).displayName === "string",
  );
}

async function getOrCreateUserUpload(userId: number) {
  return prisma.userUpload.upsert({
    where: { userId },
    update: {},
    create: { userId, uploadedImages: [] },
  });
}

// GET / — liste des images de l'utilisateur
routerUserUploads.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const idUser = Number(req.idUser);
    const userUpload = await prisma.userUpload.findUnique({ where: { userId: idUser } });
    const images = parseImages(userUpload?.uploadedImages);
    return res.status(200).json({ success: true, data: { images } });
  } catch (err) {
    console.error("Erreur récupération filigranes:", err);
    return res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// POST /upload — image en base64 JSON → conversion WebP → stockage
routerUserUploads.post("/upload", authMiddleware, async (req: Request, res: Response) => {
  try {
    const idUser = Number(req.idUser);
    const { imageBase64, mimeType, displayName } = req.body ?? {};

    if (typeof imageBase64 !== "string" || !imageBase64) {
      return res.status(400).json({ success: false, message: "Aucune image fournie." });
    }
    if (typeof mimeType !== "string" || !ALLOWED_MIME.has(mimeType)) {
      return res.status(400).json({ success: false, message: "Type de fichier non supporté." });
    }
    if (typeof displayName !== "string" || !displayName.trim()) {
      return res.status(400).json({ success: false, message: "Un nom d'affichage est requis." });
    }

    const buffer = Buffer.from(imageBase64, "base64");
    const filename = crypto.randomBytes(8).toString("hex") + ".webp";
    const filePath = path.join(ASSETS_DIR, filename);

    await fs.mkdir(ASSETS_DIR, { recursive: true });
    await sharp(buffer).webp({ quality: 85 }).toFile(filePath);

    const userUpload = await getOrCreateUserUpload(idUser);
    const images = parseImages(userUpload.uploadedImages);
    images.push({ filename, displayName: displayName.trim() });

    await prisma.userUpload.update({
      where: { userId: idUser },
      data: { uploadedImages: images as unknown as object[] },
    });

    return res.status(200).json({
      success: true,
      message: "Image uploadée avec succès.",
      data: { filename, displayName: displayName.trim() },
    });
  } catch (err) {
    console.error("Erreur upload filigrane:", err);
    return res.status(500).json({ success: false, message: "Erreur serveur lors de l'upload." });
  }
});

// PUT /:filename — renommer l'image (displayName uniquement)
routerUserUploads.put("/:filename", authMiddleware, async (req: Request, res: Response) => {
  try {
    const idUser = Number(req.idUser);
    const filename = req.params["filename"] as string;
    const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";

    if (!displayName) {
      return res.status(400).json({ success: false, message: "Un nom d'affichage est requis." });
    }

    const userUpload = await prisma.userUpload.findUnique({ where: { userId: idUser } });
    if (!userUpload) {
      return res.status(404).json({ success: false, message: "Aucun upload trouvé." });
    }

    const images = parseImages(userUpload.uploadedImages);
    const idx = images.findIndex((img) => img.filename === filename);

    if (idx === -1) {
      return res.status(404).json({ success: false, message: "Image introuvable." });
    }

    images[idx].displayName = displayName;

    await prisma.userUpload.update({
      where: { userId: idUser },
      data: { uploadedImages: images as unknown as object[] },
    });

    return res.status(200).json({ success: true, message: "Image renommée avec succès." });
  } catch (err) {
    console.error("Erreur renommage filigrane:", err);
    return res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// DELETE /:filename — supprime le fichier et l'entrée en base
routerUserUploads.delete("/:filename", authMiddleware, async (req: Request, res: Response) => {
  try {
    const idUser = Number(req.idUser);
    const filename = req.params["filename"] as string;

    // Protection path traversal : nom de fichier = 16 hex + .webp
    if (!/^[a-f0-9]{16}\.webp$/.test(filename)) {
      return res.status(400).json({ success: false, message: "Nom de fichier invalide." });
    }

    const userUpload = await prisma.userUpload.findUnique({ where: { userId: idUser } });
    if (!userUpload) {
      return res.status(404).json({ success: false, message: "Aucun upload trouvé." });
    }

    const images = parseImages(userUpload.uploadedImages);
    const idx = images.findIndex((img) => img.filename === filename);

    if (idx === -1) {
      return res.status(404).json({ success: false, message: "Image introuvable ou ne vous appartient pas." });
    }

    const filePath = path.join(ASSETS_DIR, filename);
    try {
      await fs.unlink(filePath);
    } catch (unlinkErr: any) {
      if (unlinkErr.code !== "ENOENT") throw unlinkErr;
    }

    images.splice(idx, 1);

    await prisma.userUpload.update({
      where: { userId: idUser },
      data: { uploadedImages: images as unknown as object[] },
    });

    return res.status(200).json({ success: true, message: "Image supprimée avec succès." });
  } catch (err) {
    console.error("Erreur suppression filigrane:", err);
    return res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

export default routerUserUploads;
