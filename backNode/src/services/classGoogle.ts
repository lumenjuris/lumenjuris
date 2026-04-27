import { prisma } from "../../prisma/singletonPrisma";

interface createDataDTO {
  providerId: string;
  avatarUrl: string;
  userId: number;
}

export class Google {
  async create(dataDTO: createDataDTO) {
    try {
      const create = await prisma.authProviderAccount.create({
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
        return {
          success: true,
          message:
            "Les données utisateurs de l'authProvider Google ont été récupéré avec succès.",
          data: {
            provider: "GOOGLE",
            avatarUrl: dataProvider?.avatarUrl ?? null,
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
