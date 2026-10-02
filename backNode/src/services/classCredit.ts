import { prisma } from "../../prisma/singletonPrisma.js";
import { Prisma, SubscriptionStatus, CreditTransactionType } from "@prisma/client";

type ReturnData<T = any> = {
  success: boolean;
  message?: string;
  data?: T;
};

// ─── Modèle des quotas ───────────────────────────────────────────────────────
// UserCredit.quotas est une copie de Plan.creditsIncluded (structure CreditPlan
// de prisma/seedPlans.ts). Quatre natures d'entrées :
//
//  1. QUOTAS CONSOMMABLES { unlimited, value } — décrémentés à chaque usage :
//     analyzer, analyzerPlaybook, generatorFromScratch, generatorImport,
//     signature, comprendreContrat.
//
//  2. FEATURE + QUOTA { enabled, value } — accès réservé à certains plans,
//     puis décrémenté à chaque usage : signatureEnhanced.
//
//  3. PLAFOND { unlimited, value } — jamais décrémenté, comparé au nombre de
//     contrats non archivés : contrathequeLimit (voir checkContrathequeCapacity).
//
//  4. FEATURES BOOLÉENNES { enabled } — simple droit d'accès :
//     chatJuridique, generationContractWithFiligrane.
//     ATTENTION : generationContractWithFiligrane est une CONTRAINTE (true =
//     le contrat généré porte un filigrane), pas un avantage.

/** Quotas consommables de type { unlimited, value }. */
const QUOTA_FEATURES = [
  "analyzer",
  "analyzerPlaybook",
  "generatorFromScratch",
  "generatorImport",
  "signature",
  "comprendreContrat",
] as const;

/** Quotas consommables de type { enabled, value } (feature réservée + quota). */
const QUOTA_WITH_ACCESS_FEATURES = ["signatureEnhanced"] as const;

/** Droits d'accès de type { enabled }. */
const BOOLEAN_FEATURES = ["chatJuridique", "generationContractWithFiligrane"] as const;

/** Features booléennes qui sont des contraintes : un administrateur ne les subit jamais. */
const RESTRICTION_FEATURES = ["generationContractWithFiligrane"];

type QuotaFeature = (typeof QUOTA_FEATURES)[number];
type QuotaWithAccessFeature = (typeof QUOTA_WITH_ACCESS_FEATURES)[number];
type ConsumableFeature = QuotaFeature | QuotaWithAccessFeature;
type BooleanFeature = (typeof BOOLEAN_FEATURES)[number];

/** État d'un quota consommable pour un utilisateur. */
type FeatureState =
  | { kind: "unlimited" } // illimité : rien à décompter
  | { kind: "disabled" } // feature absente / désactivée dans le plan
  | { kind: "finite"; remaining: number }; // quota à valeur, `remaining` restant

function isQuotaFeature(feature: string): feature is QuotaFeature {
  return (QUOTA_FEATURES as readonly string[]).includes(feature);
}

function isConsumable(feature: string): feature is ConsumableFeature {
  return (
    isQuotaFeature(feature) ||
    (QUOTA_WITH_ACCESS_FEATURES as readonly string[]).includes(feature)
  );
}

function isBooleanFeature(feature: string): feature is BooleanFeature {
  return (BOOLEAN_FEATURES as readonly string[]).includes(feature);
}

/** Lit l'état d'un quota consommable dans le JSON quotas. */
function readRemaining(quotas: Prisma.JsonValue, feature: ConsumableFeature): FeatureState {
  const allQuotas = quotas as Record<string, any> | null;
  const quota = allQuotas?.[feature];
  if (!quota) return { kind: "disabled" };

  // { unlimited: boolean, value?: number }
  if (isQuotaFeature(feature)) {
    if (quota.unlimited === true) return { kind: "unlimited" };
    if (quota.unlimited === false && typeof quota.value === "number") {
      return { kind: "finite", remaining: quota.value };
    }
    return { kind: "disabled" };
  }

  // { enabled: boolean, value?: number }
  // (les anciens crédits en base utilisent encore "limit" au lieu de "value")
  const remaining = quota.value ?? quota.limit;
  if (quota.enabled === true && typeof remaining === "number") {
    return { kind: "finite", remaining };
  }
  return { kind: "disabled" };
}

/** Renvoie une copie du JSON quotas avec le restant d'une feature mis à jour. */
function writeRemaining(
  quotas: Prisma.JsonValue,
  feature: ConsumableFeature,
  remaining: number,
): Prisma.InputJsonValue {
  const nextQuotas = structuredClone(quotas) as Record<string, any>;
  if (isQuotaFeature(feature)) {
    nextQuotas[feature] = { unlimited: false, value: remaining };
  } else {
    nextQuotas[feature] = { enabled: true, value: remaining };
  }
  return nextQuotas as Prisma.InputJsonValue;
}

// ─── Administrateurs : tout en illimité ──────────────────────────────────────
// Un administrateur peut utiliser toutes les fonctionnalités sans limite, quel
// que soit le plan affiché sur son compte (il peut en changer pour une démo).

async function isAdmin(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { idUser: userId }, select: { role: true } });
  return user?.role === "ADMIN";
}

/** Quotas tels que vus par un administrateur : tout illimité, aucune contrainte. */
function unlimitedQuotas(quotas: Prisma.JsonValue): Record<string, unknown> {
  const allQuotas = (quotas ?? {}) as Record<string, any>;
  return Object.fromEntries(
    Object.entries(allQuotas).map(([feature, quota]) => {
      if (RESTRICTION_FEATURES.includes(feature)) return [feature, { enabled: false }];
      if (quota && typeof quota === "object" && "unlimited" in quota) {
        return [feature, { unlimited: true }];
      }
      // { enabled, value } : activé sans valeur = illimité (lu ainsi par le front)
      if (quota && typeof quota === "object" && "enabled" in quota) {
        return [feature, { enabled: true }];
      }
      return [feature, quota];
    }),
  );
}

/** Récupère les quotas d'un utilisateur ayant un abonnement actif. */
async function getActiveQuotas(
  userId: number,
): Promise<{ quotas: Prisma.JsonValue } | { reason: "no_active_subscription" | "no_quota" }> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { status: true },
  });
  if (!subscription || subscription.status !== SubscriptionStatus.ACTIVE) {
    return { reason: "no_active_subscription" };
  }

  const userCredit = await prisma.userCredit.findUnique({ where: { userId } });
  if (!userCredit) return { reason: "no_quota" };

  return { quotas: userCredit.quotas };
}

const REASON_MESSAGES = {
  no_active_subscription: "Aucun abonnement actif !",
  no_quota: "Aucun quota pour cet utilisateur.",
};

export class Credit {
  /**
   * Ajoute un bonus à un quota consommable (ex: offrir 10 analyses).
   * Ne fonctionne que sur une feature à valeur déjà active dans le plan.
   */
  async addQuota(userId: number, feature: string, amount: number): Promise<ReturnData> {
    try {
      if (!isConsumable(feature)) {
        return { success: false, message: `Feature "${feature}" non consommable.` };
      }

      const result = await getActiveQuotas(userId);
      if ("reason" in result) return { success: false, message: REASON_MESSAGES[result.reason] };

      const state = readRemaining(result.quotas, feature);
      if (state.kind === "unlimited") {
        return { success: true, message: "Quota illimité, aucun bonus nécessaire." };
      }
      if (state.kind === "disabled") {
        return { success: false, message: `Feature "${feature}" non incluse dans le plan.` };
      }

      const newRemaining = state.remaining + amount;
      const newQuotas = writeRemaining(result.quotas, feature, newRemaining);

      await prisma.$transaction([
        prisma.userCredit.update({ where: { userId }, data: { quotas: newQuotas } }),
        prisma.creditTransaction.create({
          data: {
            userId,
            feature,
            amount, // + bonus
            balanceAfter: newRemaining,
            type: CreditTransactionType.BONUS,
            description: `Bonus quota ${feature}`,
          },
        }),
      ]);

      return {
        success: true,
        message: "Bonus ajouté.",
        data: { feature, remaining: newRemaining },
      };
    } catch (error) {
      console.error("ADD QUOTA ERROR:", error);
      return { success: false, message: "Erreur lors de l'ajout du quota." };
    }
  }

  /**
   * Consomme `amount` unités d'un quota (ex: 1 analyse). Respecte l'illimité
   * (aucun décompte) et refuse si la feature est absente ou le quota épuisé.
   */
  async consumeQuota(userId: number, feature: string, amount = 1): Promise<ReturnData> {
    try {
      if (!isConsumable(feature)) {
        return { success: false, message: `Feature "${feature}" non consommable.` };
      }
      if (await isAdmin(userId)) {
        return { success: true, message: "Quota illimité.", data: { unlimited: true } };
      }

      const result = await getActiveQuotas(userId);
      if ("reason" in result) return { success: false, message: REASON_MESSAGES[result.reason] };

      const state = readRemaining(result.quotas, feature);
      if (state.kind === "unlimited") {
        return { success: true, message: "Quota illimité.", data: { unlimited: true } };
      }
      if (state.kind === "disabled") {
        return { success: false, message: `Feature "${feature}" non incluse dans le plan.` };
      }
      if (state.remaining < amount) {
        return {
          success: false,
          message: "Quota épuisé.",
          data: { feature, remaining: state.remaining },
        };
      }

      const newRemaining = state.remaining - amount;
      const newQuotas = writeRemaining(result.quotas, feature, newRemaining);

      await prisma.$transaction([
        prisma.userCredit.update({ where: { userId }, data: { quotas: newQuotas } }),
        prisma.creditTransaction.create({
          data: {
            userId,
            feature,
            amount: -amount, // - consommation
            balanceAfter: newRemaining,
            type: CreditTransactionType.CONSUMPTION,
            description: `Consommation quota ${feature}`,
          },
        }),
      ]);

      return {
        success: true,
        message: "Quota consommé.",
        data: { feature, remaining: newRemaining },
      };
    } catch (error) {
      console.error("CONSUME QUOTA ERROR:", error);
      return { success: false, message: "Erreur lors de la consommation du quota." };
    }
  }

  /**
   * Vérifie SANS décrémenter si l'utilisateur peut utiliser une feature.
   * - feature consommable : `allowed` = illimité ou solde > 0 (+ `remaining`) ;
   * - feature booléenne : `allowed` = droit d'accès du plan (voir hasFeatureAccess).
   * Renvoie `data.allowed` (+ `reason` si refusé).
   */
  async hasFeatureQuota(userId: number, feature: string): Promise<ReturnData> {
    if (isBooleanFeature(feature)) return this.hasFeatureAccess(userId, feature);

    try {
      if (!isConsumable(feature)) {
        return { success: false, message: `Feature "${feature}" inconnue.` };
      }
      if (await isAdmin(userId)) {
        return { success: true, data: { allowed: true, unlimited: true } };
      }

      const result = await getActiveQuotas(userId);
      if ("reason" in result) {
        return { success: true, data: { allowed: false, reason: result.reason } };
      }

      const state = readRemaining(result.quotas, feature);
      if (state.kind === "unlimited") {
        return { success: true, data: { allowed: true, unlimited: true } };
      }
      if (state.kind === "disabled") {
        return { success: true, data: { allowed: false, reason: "disabled" } };
      }
      return {
        success: true,
        data: { allowed: state.remaining > 0, remaining: state.remaining },
      };
    } catch (error) {
      console.error("HAS FEATURE QUOTA ERROR:", error);
      return { success: false, message: "Erreur lors de la vérification du quota." };
    }
  }

  /**
   * Lit un droit d'accès booléen du plan (chatJuridique, generationContractWithFiligrane).
   * `data.allowed` = valeur de `enabled` dans le plan.
   * Pour generationContractWithFiligrane, `allowed: true` signifie donc
   * « le contrat doit porter un filigrane » (un administrateur n'en a jamais).
   */
  async hasFeatureAccess(userId: number, feature: string): Promise<ReturnData> {
    try {
      if (!isBooleanFeature(feature)) {
        return { success: false, message: `Feature "${feature}" n'est pas un droit d'accès.` };
      }
      if (await isAdmin(userId)) {
        const isRestriction = RESTRICTION_FEATURES.includes(feature);
        return { success: true, data: { allowed: !isRestriction } };
      }

      const result = await getActiveQuotas(userId);
      if ("reason" in result) {
        // Sans abonnement actif, on applique le cas le plus prudent :
        // pas d'accès aux avantages, et le filigrane reste imposé.
        const isRestriction = RESTRICTION_FEATURES.includes(feature);
        return { success: true, data: { allowed: isRestriction, reason: result.reason } };
      }

      const allQuotas = result.quotas as Record<string, any> | null;
      const isEnabled = allQuotas?.[feature]?.enabled === true;
      return { success: true, data: { allowed: isEnabled } };
    } catch (error) {
      console.error("HAS FEATURE ACCESS ERROR:", error);
      return { success: false, message: "Erreur lors de la vérification de l'accès." };
    }
  }

  /**
   * Vérifie si l'utilisateur peut encore AJOUTER un contrat à sa contrathèque.
   * `contrathequeLimit` est un PLAFOND (pas un consommable) : on compare le nombre
   * de contrats non archivés au plafond du plan. Illimité -> toujours autorisé.
   * Renvoie `data.allowed` (+ `count`/`limit` pour le message côté appelant).
   */
  async checkContrathequeCapacity(userId: number): Promise<ReturnData> {
    try {
      if (await isAdmin(userId)) {
        return { success: true, data: { allowed: true, unlimited: true } };
      }

      const result = await getActiveQuotas(userId);
      if ("reason" in result) {
        return { success: true, data: { allowed: false, reason: result.reason } };
      }

      const allQuotas = result.quotas as Record<string, any> | null;
      const contrathequeLimit = allQuotas?.contrathequeLimit;

      if (contrathequeLimit?.unlimited === true) {
        return { success: true, data: { allowed: true, unlimited: true } };
      }

      // Plafond fini -> comparer au nombre de contrats non archivés.
      if (contrathequeLimit?.unlimited === false && typeof contrathequeLimit.value === "number") {
        const count = await prisma.contract.count({
          where: { userId, isArchived: false },
        });
        return {
          success: true,
          data: { allowed: count < contrathequeLimit.value, count, limit: contrathequeLimit.value },
        };
      }

      // Structure inattendue -> on bloque prudemment.
      return { success: true, data: { allowed: false, reason: "invalid_quota" } };
    } catch (error) {
      console.error("CHECK CONTRATHEQUE CAPACITY ERROR:", error);
      return { success: false, message: "Erreur lors de la vérification du plafond contrathèque." };
    }
  }

  /** Renvoie les quotas restants de l'utilisateur (structure JSON par feature). */
  async getUserCredits(userId: number): Promise<ReturnData> {
    try {
      const user = await prisma.user.findUnique({ where: { idUser: userId } });
      if (!user) return { success: false, message: "Utilisateur introuvable !" };

      const userCredit = await prisma.userCredit.findUnique({
        where: { userId },
        select: { quotas: true },
      });

      return {
        success: true,
        message: "Quotas restants.",
        data: userCredit
          ? { quotas: user.role === "ADMIN" ? unlimitedQuotas(userCredit.quotas) : userCredit.quotas }
          : { quotas: null },
      };
    } catch (error) {
      console.error("GET QUOTA ERROR:", error);
      return { success: false, message: "Erreur lors de la récupération de vos quotas." };
    }
  }
}
