import { prisma } from "../../prisma/singletonPrisma";

const LLM_MODELS = [
  {
    name: "gpt-4o",
    pricePerMillionTokenInput: 5 * 100,
    pricePerMillionTokenOutput: 15 * 100,
  },
  {
    name: "gpt-4o-mini",
    pricePerMillionTokenInput: 0.15 * 100,
    pricePerMillionTokenOutput: 0.6 * 100,
  },
  {
    name: "gpt-5.2",
    pricePerMillionTokenInput: 1.75 * 100,
    pricePerMillionTokenOutput: 14 * 100,
  },
  {
    name: "gpt-5.4-nano",
    pricePerMillionTokenInput: 0.2 * 100,
    pricePerMillionTokenOutput: 1.25 * 100,
  },
];

export class Llm {
  //Initialisation des models IA LLM de l'application pour monitoring
  async setLlm() {
    try {
      for (const model of LLM_MODELS) {
        await prisma.llm.upsert({
          where: { name: model.name },
          update: {
            tokenPriceInput: model.pricePerMillionTokenInput,
            tokenPriceOutput: model.pricePerMillionTokenOutput,
          },
          create: {
            name: model.name,
            tokenPriceInput: model.pricePerMillionTokenInput,
            tokenPriceOutput: model.pricePerMillionTokenOutput,
          },
        });
      }
    } catch (err) {
      console.error(err);
      return {
        success: false,
        message:
          "Une erreur est survenue lors de l'initialisation du dictionnaire de modèles LLM dans la base de données.",
      };
    }
  }

  /**
   * Récupération de l'utilisation LLM pour le mois en cours.
   */
  async getCurrentUsage() {
    try {
      await this.setLlm();

      const today = new Date();
      const startAt = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const nextDay = new Date(startAt);
      nextDay.setDate(nextDay.getDate() + 1);

      const models = await prisma.llm.findMany({
        orderBy: { name: "asc" },
        include: {
          llmUsage: {
            where: { startAt },
            take: 1,
          },
        },
      });

      const usage = models.map((model) => {
        const currentUsage = model.llmUsage[0];

        return {
          model: model.name,
          tokenInput: currentUsage?.tokenInput ?? 0,
          tokenOutput: currentUsage?.tokenOutput ?? 0,
          totalTokens:
            (currentUsage?.tokenInput ?? 0) + (currentUsage?.tokenOutput ?? 0),
          totalCostUsd: currentUsage ? Number(currentUsage.totalCostUsd) : 0,
          startAt: currentUsage?.startAt ?? startAt,
          expiresAt: currentUsage?.expiresAt ?? nextDay,
        };
      });

      return {
        success: true,
        usage,
      };
    } catch (err) {
      console.error(err);
      return {
        success: false,
        message:
          "Une erreur est survenue lors de la récupération de l'utilisation llm",
        usage: [],
      };
    }
  }

  /**
   * Incrementation des tokens utilisés lors du fonctionement de l'application
   * @param {string} model
   * @param {number} input
   * @param {number} output
   * @returns
   */
  async incrementUsage(model: string, input: number, output: number, userId?: number) {
    try {
      await this.setLlm();

      const llmModel = await prisma.llm.findUnique({
        where: { name: model },
      });

      if (!llmModel) {
        return {
          success: false,
          message: `Model ${model} introuvable dans la table llm`,
        };
      }
      const { idLlm, tokenPriceInput, tokenPriceOutput } = llmModel;

      // Les prix OpenAI sont en USD par million de tokens, stockés ici en centimes.
      const totalCost =
        (input * tokenPriceInput) / 1_000_000 +
        (output * tokenPriceOutput) / 1_000_000;
      const totalCostUsd = totalCost / 100;

      const today = new Date();
      const startAt = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      const expiresAt = new Date(startAt);
      expiresAt.setDate(expiresAt.getDate() + 1);

      const incrementPayload = {
        tokenInput: { increment: input },
        tokenOutput: { increment: output },
        totalCostUsd: { increment: totalCostUsd },
      };

      await prisma.llmUsage.upsert({
        where: { llmId_startAt: { llmId: idLlm, startAt } },
        update: incrementPayload,
        create: { llmId: idLlm, startAt, expiresAt, tokenInput: input, tokenOutput: output, totalCostUsd },
      });

      if (userId) {
        await prisma.userLlmUsage.upsert({
          where: { llmId_startAt_userId: { llmId: idLlm, startAt, userId } },
          update: incrementPayload,
          create: { llmId: idLlm, userId, startAt, expiresAt, tokenInput: input, tokenOutput: output, totalCostUsd },
        });
      }

      return {
        success: true,
        message: `Les token utilisés pour le model ${model} ont été mis à jour avec succès.`,
      };
    } catch (err) {
      console.error(err);
      return {
        success: false,
        message:
          "Une erreur est survenue lors de la mise à jour de l'utilisation de token llm",
      };
    }
  }

  async getUserUsage(userId: number) {
    try {
      await this.setLlm();

      const today = new Date();
      const startAt = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      const records = await prisma.userLlmUsage.findMany({
        where: { userId, startAt },
        include: { llm: { select: { name: true } } },
      });

      const usage = records.map((r) => ({
        model: r.llm.name,
        tokenInput: r.tokenInput,
        tokenOutput: r.tokenOutput,
        totalTokens: r.tokenInput + r.tokenOutput,
        totalCostUsd: Number(r.totalCostUsd),
        startAt: r.startAt,
        expiresAt: r.expiresAt,
      }));

      return { success: true, usage };
    } catch (err) {
      console.error(err);
      return {
        success: false,
        message: "Une erreur est survenue lors de la récupération de l'utilisation llm utilisateur",
        usage: [],
      };
    }
  }

  async getAllUsersUsage() {
    try {
      const today = new Date();
      const startAt = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      const records = await prisma.userLlmUsage.findMany({
        where: { startAt },
        include: {
          llm: { select: { name: true } },
          user: { select: { idUser: true, email: true, nom: true, prenom: true } },
        },
        orderBy: { totalCostUsd: "desc" },
      });

      const usage = records.map((r) => ({
        userId: r.userId,
        email: r.user.email,
        nom: r.user.nom,
        prenom: r.user.prenom,
        model: r.llm.name,
        tokenInput: r.tokenInput,
        tokenOutput: r.tokenOutput,
        totalTokens: r.tokenInput + r.tokenOutput,
        totalCostUsd: Number(r.totalCostUsd),
        startAt: r.startAt,
        expiresAt: r.expiresAt,
      }));

      return { success: true, usage };
    } catch (err) {
      console.error(err);
      return {
        success: false,
        message: "Une erreur est survenue lors de la récupération de l'utilisation llm par utilisateur",
        usage: [],
      };
    }
  }
}
