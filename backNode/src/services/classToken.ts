import { prisma } from "../../prisma/singletonPrisma";
import crypto from "crypto";

type TokenType = "verifyAccount" | "forgotPassword";

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

      await prisma.token.create({
        data: {
          token,
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
          token,
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
