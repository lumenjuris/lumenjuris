import { prisma } from "../../prisma/singletonPrisma";

// Structure d'un jour dans l'historique, renvoyée par getUsageHistory
type DayEntry = {
  date: string; // "YYYY-MM-DD"
  totalCostUsd: number;
  totalTokens: number;
  tokenInput: number;
  tokenOutput: number;
  byModel: Record<
    string,
    { tokenInput: number; tokenOutput: number; totalCostUsd: number }
  >;
};

const LLM_MODELS = [
  {
    name: "gpt-4o",
    pricePerMillionTokenInput: 2.5 * 100,
    pricePerMillionTokenOutput: 10 * 100,
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
      const startAt = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );
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
  async incrementUsage(
    model: string,
    input: number,
    output: number,
    userId?: number,
  ) {
    try {
      await this.setLlm();

      const llmModel = await prisma.llm.findUnique({
        where: { name: model },
      });

      if (!llmModel) {
        return {
          success: false,
          message: `Model "${model}" introuvable dans la table llm`,
        };
      }
      const { idLlm, tokenPriceInput, tokenPriceOutput } = llmModel;

      // Les prix OpenAI sont en USD par million de tokens, stockés ici en centimes.
      const totalCost =
        (input * tokenPriceInput) / 1_000_000 +
        (output * tokenPriceOutput) / 1_000_000;
      const totalCostUsd = totalCost / 100;

      const today = new Date();
      const startAt = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );

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
        create: {
          llmId: idLlm,
          startAt,
          expiresAt,
          tokenInput: input,
          tokenOutput: output,
          totalCostUsd,
        },
      });

      if (userId) {
        await prisma.userLlmUsage.upsert({
          where: { llmId_startAt_userId: { llmId: idLlm, startAt, userId } },
          update: incrementPayload,
          create: {
            llmId: idLlm,
            userId,
            startAt,
            expiresAt,
            tokenInput: input,
            tokenOutput: output,
            totalCostUsd,
          },
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
      const startAt = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );

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
        message:
          "Une erreur est survenue lors de la récupération de l'utilisation llm utilisateur",
        usage: [],
      };
    }
  }

  async getAllUsersUsage() {
    try {
      const today = new Date();
      const startAt = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );

      const records = await prisma.userLlmUsage.findMany({
        where: { startAt },
        include: {
          llm: { select: { name: true } },
          user: {
            select: { idUser: true, email: true, nom: true, prenom: true },
          },
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
        message:
          "Une erreur est survenue lors de la récupération de l'utilisation llm par utilisateur",
        usage: [],
      };
    }
  }

  /**
   * Retourne l'historique d'utilisation LLM agrégé par jour sur les N derniers jours.
   * Les jours sans données sont renvoyés avec des zéros pour éviter les trous dans le graphe.
   * @param days Nombre de jours à couvrir (1 = aujourd'hui uniquement, 30 = le mois courant)
   */
  async getUsageHistory(days: number) {
    try {
      await this.setLlm();

      const today = new Date();
      // Début de la journée courante (minuit local)
      const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );

      // Point de départ : on remonte (days - 1) jours en arrière pour
      // qu'aujourd'hui soit toujours inclus dans la fenêtre
      const from = new Date(todayStart);
      from.setDate(from.getDate() - (days - 1));

      const records = await prisma.llmUsage.findMany({
        where: { startAt: { gte: from } },
        include: { llm: { select: { name: true } } },
        orderBy: { startAt: "asc" },
      });

      // Construction d'une timeline complète avec des zéros pour les jours sans données.
      // Cela garantit que le graphe côté front n'a aucun trou sur l'axe X.
      const toKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const timeline: Record<string, DayEntry> = {};
      for (let i = 0; i < days; i++) {
        const d = new Date(from);
        d.setDate(d.getDate() + i);
        const key = toKey(d);
        timeline[key] = {
          date: key,
          totalCostUsd: 0,
          totalTokens: 0,
          tokenInput: 0,
          tokenOutput: 0,
          byModel: {},
        };
      }

      for (const r of records) {
        // On recalcule la clé via les composantes locales de la date pour éviter
        // les décalages de fuseau horaire liés à l'ISO string (ex: UTC vs Europe/Paris)
        const key = toKey(r.startAt);
        if (!timeline[key]) continue;

        const entry = timeline[key];
        const cost = Number(r.totalCostUsd);
        entry.totalCostUsd += cost;
        entry.totalTokens += r.tokenInput + r.tokenOutput;
        entry.tokenInput += r.tokenInput;
        entry.tokenOutput += r.tokenOutput;
        entry.byModel[r.llm.name] = {
          tokenInput: r.tokenInput,
          tokenOutput: r.tokenOutput,
          totalCostUsd: cost,
        };
      }

      return { success: true, history: Object.values(timeline) };
    } catch (err) {
      console.error(err);
      return {
        success: false,
        message:
          "Une erreur est survenue lors de la récupération de l'historique d'utilisation LLM",
        history: [],
      };
    }
  }
}
