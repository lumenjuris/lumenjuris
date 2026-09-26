import { prisma } from "../../prisma/singletonPrisma.js";

interface createDataDTO {
  providerId: string;
  // Microsoft ne renvoie pas de photo dans les claims du token, l'avatar est
  // donc optionnel (contrairement à Google qui fournit toujours `picture`).
  avatarUrl?: string | null;
  userId: number;
}

export class Microsoft {
  async create(dataDTO: createDataDTO) {
    try {
      await prisma.authProviderAccount.create({
        data: {
          providerId: dataDTO.providerId,
          provider: "MICROSOFT",
          avatarUrl: dataDTO.avatarUrl ?? null,
          userId: dataDTO.userId,
        },
      });
    } catch (err) {
      console.error(
        `Une erreur est survenue lors de la création d'une auth provider`,
      );
      return {
        success: false,
        message:
          "Une erreur est survenue lors de la création d'un AuthProvider Microsoft.",
      };
    }
  }

  async get(userId: number) {
    try {
      const dataProvider = await prisma.authProviderAccount.findFirst({
        where: { userId },
      });
      if (dataProvider) {
        const user = await prisma.user.findUnique({
          where: { idUser: userId },
          select: { password: true },
        });
        const microsoftConnectionPanelMode = user?.password
          ? "microsoft_with_password"
          : "microsoft_only";
        return {
          success: true,
          message:
            "Les données utilisateurs de l'authProvider Microsoft ont été récupérées avec succès.",
          data: {
            provider: "MICROSOFT",
            avatarUrl: dataProvider?.avatarUrl ?? null,
            microsoftConnectionPanelMode,
          },
        };
      } else {
        return null;
      }
    } catch (err) {
      console.error(
        `Une erreur est survenue lors de la récupération des données microsoft d'un utilisateur, error : \n ${err}`,
      );
      return {
        success: false,
        message:
          "Une erreur est survenue lors de la récupération des données microsoft d'un utilisateur.",
      };
    }
  }
}
