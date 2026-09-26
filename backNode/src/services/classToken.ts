import { prisma } from "../../prisma/singletonPrisma.js";
import crypto from "crypto";
import { hashToken } from "./encryption.js";

type TokenType =
  | "verifyAccount"
  | "forgotPassword"
  | "twoFactor"
  | "deleteAccount";

export class Token {
  private setExpiresAt(type: string) {
    const today = new Date();

    switch (type) {
      case "verifyAccount":
        today.setMinutes(today.getMinutes() + 15);
        return today;
      case "forgotPassword":
        today.setMinutes(today.getMinutes() + 15);
        return today;
      case "twoFactor":
        today.setMinutes(today.getMinutes() + 15);
        return today;
      case "deleteAccount":
        today.setMinutes(today.getMinutes() + 15);
        return today;
      default:
        return null;
    }
  }

  //Création d'un token typé pour un utilisateur
  async createToken(userId: number, type: TokenType) {
    try {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = this.setExpiresAt(type);
      if (!expiresAt) {
        throw new Error(
          `Echec lors de la création d'un nouveau token, aucun expiresAt définit pour le type "${type}".`,
        );
      }

      // Seule l'empreinte est stockée : le token en clair part uniquement dans l'email.
      await prisma.token.create({
        data: {
          tokenHash: hashToken(token),
          expiresAt: expiresAt,
          userId,
          type,
        },
      });

      return {
        success: true,
        message: "Le token a été créé avec succès.",
        token,
      };
    } catch (err) {
      console.error(err);
      return {
        success: false,
        message:
          "Une erreur est survenue avec le serveur lors de la création d'un nouveau token.",
      };
    }
  }

  //Suppression d'un token
  async deleteToken(token: string) {
    try {
      await prisma.token.delete({
        where: {
          tokenHash: hashToken(token),
        },
      });
      return {
        success: true,
        message: "Le token a été supprimé avec succès.",
      };
    } catch (err) {
      console.error(err);
      return {
        success: false,
        message: "Une erreur est survenue lors de la suppression d'un token.",
      };
    }
  }

  // Génère un code OTP à 6 chiffres pour la double authentification (valide pendant 15 min)
  async createTwoFactorCode(userId: number) {
    try {
      // Invalide tout code twoFactor ACTIVE déjà existant pour cet utilisateur
      await prisma.token.updateMany({
        where: { userId, type: "twoFactor", status: "ACTIVE" },
        data: { status: "EXPIRED" },
      });

      const code = String(crypto.randomInt(100000, 999999));
      const expiresAt = this.setExpiresAt("twoFactor")!;

      await prisma.token.create({
        data: { tokenHash: hashToken(code), expiresAt, userId, type: "twoFactor" },
      });

      return { success: true, code };
    } catch (err) {
      console.error(err);
      return {
        success: false,
        message:
          "Une erreur est survenue lors de la création du code de vérification.",
      };
    }
  }

  // Génère un code à 6 chiffres pour l'activation d'un compte (valide 15 min).
  // Même principe que le code 2FA : le compte se valide en saisissant ce code
  // dans le formulaire, plutôt qu'en cliquant un lien.
  async createVerifyAccountCode(userId: number) {
    try {
      // Invalide tout code d'activation ACTIVE encore en cours pour ce compte.
      await prisma.token.updateMany({
        where: { userId, type: "verifyAccount", status: "ACTIVE" },
        data: { status: "EXPIRED" },
      });

      const code = String(crypto.randomInt(100000, 999999));
      const expiresAt = this.setExpiresAt("verifyAccount")!;

      await prisma.token.create({
        data: { tokenHash: hashToken(code), expiresAt, userId, type: "verifyAccount" },
      });

      return { success: true as const, code };
    } catch (err) {
      console.error(err);
      return {
        success: false as const,
        message:
          "Une erreur est survenue lors de la création du code d'activation.",
      };
    }
  }

  //Prévus pour tâche cron, cela supprime tout les tokens où la date est expirée
  async managementDeleteTokenExpires() {
    try {
      const now = new Date();
      const deleted = await prisma.token.deleteMany({
        where: {
          expiresAt: { lt: now },
        },
      });
      return {
        success: true,
        message: `${deleted.count} tokens expirés ont été supprimés avec succès.`,
      };
    } catch (err) {
      console.error(err);
      return {
        success: false,
        message:
          "Une erreur est survenue lors du management des tokens expirés.",
      };
    }
  }
}
