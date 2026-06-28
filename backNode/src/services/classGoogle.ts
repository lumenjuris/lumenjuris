import { prisma } from "../../prisma/singletonPrisma.js";

interface createDataDTO {
  providerId: string;
  avatarUrl: string;
  userId: number;
}

export class Google {
  async create(dataDTO: createDataDTO) {
    try {
      await prisma.authProviderAccount.create({
        data: {
          providerId: dataDTO.providerId,
          provider: "GOOGLE",
          avatarUrl: dataDTO.avatarUrl,
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
          "Une erreur est survenue lors de la création d'un AuthProvider Google.",
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
        const googleConnectionPanelMode = user?.password
          ? "google_with_password"
          : "google_only";
        return {
          success: true,
          message:
            "Les données utisateurs de l'authProvider Google ont été récupéré avec succès.",
          data: {
            provider: "GOOGLE",
            avatarUrl: dataProvider?.avatarUrl ?? null,
            googleConnectionPanelMode,
          },
        };
      } else {
        return null;
      }
    } catch (err) {
      console.error(
        `Une erreur est survenue lors de la récupération des données google d'un utilisateur, error : \n ${err}`,
      );
      return {
        success: false,
        message:
          "Une erreur est survenue lors de la récupération des données google d'un utilisateur.",
      };
    }
  }
}
