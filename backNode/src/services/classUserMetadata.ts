import type { OnboardingStatus } from "@prisma/client";
import { prisma } from "../../prisma/singletonPrisma.js";

/**
 * Onboarding : listes fermées des réponses acceptées + lecture / écriture de
 * la ligne `UserMetadata` de l'utilisateur.
 *
 * ⚠ Ces listes sont dupliquées côté front (formulaire d'onboarding). Le serveur
 * fait foi : un code inconnu est refusé. Pour ajouter une réponse, l'ajouter
 * ici ET dans le formulaire.
 */

// ─── Listes fermées ───

/** Version du questionnaire. À incrémenter quand une question est ajoutée. */
export const ONBOARDING_VERSION = 1;

/** Index de la dernière étape du formulaire (0 = intention … 3 = entreprise). */
export const ONBOARDING_LAST_STEP = 3;

export const PROFESSION_CODES = [
  "avocat",
  "juriste_entreprise",
  "notaire_commissaire",
  "dirigeant",
  "rh",
  "expert_comptable",
  "independant",
  "etudiant",
  "particulier",
  "autre",
] as const;

/**
 * Outils proposés à la question « Par quoi voulez-vous commencer ? ».
 * La valeur liste les clés `FeatureUsage.feature` correspondantes : c'est ce
 * qui permet de croiser l'intention déclarée avec l'usage réel.
 */
export const INTENT_FEATURE_KEYS = {
  analyze_contract: ["analyze_contract", "analyze_clause", "clause_analysis"],
  generate_contract: ["generate_contract_scratch", "generate_contract_questions", "import_template"],
  negotiation: ["negotiation"],
  esignature: ["esignature"],
  contract_library: ["contract_library"],
  clause_library: ["clause_library"],
  chat: ["chat"],
} as const satisfies Record<string, readonly string[]>;

export const INTENT_CODES = Object.keys(INTENT_FEATURE_KEYS) as (keyof typeof INTENT_FEATURE_KEYS)[];

/** Nombre maximum d'outils sélectionnables. */
export const MAX_INTENTS = 3;

export const CONTRACT_VOLUME_CODES = ["lt_5", "5_20", "20_100", "gt_100"] as const;
export const TEAM_SIZE_CODES = ["solo", "2_5", "6_20", "gt_20"] as const;

const PROFESSION_OTHER_MAX_LENGTH = 60;

// ─── Types ───

export type UserMetadataDTO = {
  onboardingStatus: OnboardingStatus;
  onboardingVersion: number;
  currentStep: number;
  completedAt: Date | null;
  profession: string | null;
  professionOther: string | null;
  primaryIntents: string[];
  contractVolume: string | null;
  teamSize: string | null;
  hasNoEnterprise: boolean;
};

/** Champs modifiables par le formulaire (tous facultatifs : enregistrement étape par étape). */
export type UserMetadataPatch = {
  currentStep?: number;
  profession?: string | null;
  professionOther?: string | null;
  primaryIntents?: string[];
  contractVolume?: string | null;
  teamSize?: string | null;
  hasNoEnterprise?: boolean;
  /** Seules ces deux transitions peuvent être demandées par le client. */
  status?: "COMPLETED" | "SKIPPED";
};

export type ReturnData<T = unknown> = {
  success: boolean;
  message: string;
  data?: T;
};

type ValidationResult =
  | { ok: true; patch: UserMetadataPatch }
  | { ok: false; message: string };

// ─── Validation ───

function isOneOf(list: readonly string[], value: unknown): value is string {
  return typeof value === "string" && list.includes(value);
}

/** Nettoie le texte libre « autre profession » : une ligne, sans balise, 60 caractères. */
function cleanProfessionOther(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PROFESSION_OTHER_MAX_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Vérifie le corps reçu et ne garde que les champs connus.
 * Une valeur hors liste est une erreur (400), jamais corrigée en silence :
 * des statistiques faussées seraient pires qu'un refus.
 */
export function validateUserMetadataPatch(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "Corps de requête invalide." };
  }
  const body = input as Record<string, unknown>;
  const patch: UserMetadataPatch = {};

  if (body.currentStep !== undefined) {
    const step = body.currentStep;
    if (typeof step !== "number" || !Number.isInteger(step) || step < 0 || step > ONBOARDING_LAST_STEP) {
      return { ok: false, message: "Étape invalide." };
    }
    patch.currentStep = step;
  }

  if (body.profession !== undefined) {
    if (body.profession !== null && !isOneOf(PROFESSION_CODES, body.profession)) {
      return { ok: false, message: "Profession inconnue." };
    }
    patch.profession = body.profession;
  }

  if (body.professionOther !== undefined) {
    patch.professionOther = cleanProfessionOther(body.professionOther);
  }

  if (body.primaryIntents !== undefined) {
    if (!Array.isArray(body.primaryIntents)) {
      return { ok: false, message: "La liste des outils est invalide." };
    }
    // L'ordre est conservé : le premier outil coché est l'intention principale.
    const intents = [...new Set(body.primaryIntents)];
    if (intents.length > MAX_INTENTS) {
      return { ok: false, message: `Vous pouvez choisir ${MAX_INTENTS} outils au maximum.` };
    }
    if (!intents.every((intent) => isOneOf(INTENT_CODES, intent))) {
      return { ok: false, message: "Outil inconnu." };
    }
    patch.primaryIntents = intents as string[];
  }

  if (body.contractVolume !== undefined) {
    if (body.contractVolume !== null && !isOneOf(CONTRACT_VOLUME_CODES, body.contractVolume)) {
      return { ok: false, message: "Volume de contrats inconnu." };
    }
    patch.contractVolume = body.contractVolume;
  }

  if (body.teamSize !== undefined) {
    if (body.teamSize !== null && !isOneOf(TEAM_SIZE_CODES, body.teamSize)) {
      return { ok: false, message: "Taille d'équipe inconnue." };
    }
    patch.teamSize = body.teamSize;
  }

  if (body.hasNoEnterprise !== undefined) {
    if (typeof body.hasNoEnterprise !== "boolean") {
      return { ok: false, message: "Valeur invalide pour l'entreprise." };
    }
    patch.hasNoEnterprise = body.hasNoEnterprise;
  }

  if (body.status !== undefined) {
    if (body.status !== "COMPLETED" && body.status !== "SKIPPED") {
      return { ok: false, message: "Statut invalide." };
    }
    patch.status = body.status;
  }

  return { ok: true, patch };
}

// ─── Service ───

type UserMetadataRow = NonNullable<Awaited<ReturnType<typeof prisma.userMetadata.findUnique>>>;

function toDTO(row: UserMetadataRow): UserMetadataDTO {
  const intents = Array.isArray(row.primaryIntents)
    ? row.primaryIntents.filter((intent): intent is string => typeof intent === "string")
    : [];

  return {
    onboardingStatus: row.onboardingStatus,
    onboardingVersion: row.onboardingVersion,
    currentStep: row.currentStep,
    completedAt: row.completedAt,
    profession: row.profession,
    professionOther: row.professionOther,
    primaryIntents: intents,
    contractVolume: row.contractVolume,
    teamSize: row.teamSize,
    hasNoEnterprise: row.hasNoEnterprise,
  };
}

/**
 * Trace une étape du parcours dans `FeatureUsage` (même table que le suivi des
 * outils) : donne l'entonnoir d'abandon sans nouvelle table. Ne bloque jamais
 * l'enregistrement des réponses.
 */
async function trackOnboardingEvent(userId: number, feature: string): Promise<void> {
  try {
    await prisma.featureUsage.create({ data: { feature, userId } });
  } catch (err) {
    console.error("[onboarding] suivi d'étape impossible :", err);
  }
}

export class UserMetadataService {
  /**
   * Lit la ligne de l'utilisateur, en la créant si elle n'existe pas.
   *
   * Une ligne absente = compte créé APRÈS la mise en place de l'onboarding
   * (les comptes antérieurs ont reçu une ligne SKIPPED par la migration). Elle
   * naît donc en NOT_STARTED, quel que soit le mode d'inscription (formulaire,
   * Google, Microsoft) : aucun code d'inscription n'a besoin de la créer.
   */
  private async findOrCreate(userId: number): Promise<UserMetadataRow> {
    const existing = await prisma.userMetadata.findUnique({ where: { userId } });
    if (existing) return existing;

    try {
      return await prisma.userMetadata.create({
        data: { userId, onboardingVersion: ONBOARDING_VERSION },
      });
    } catch (err) {
      // Deux requêtes simultanées au premier chargement : l'autre a gagné.
      const created = await prisma.userMetadata.findUnique({ where: { userId } });
      if (created) return created;
      throw err;
    }
  }

  async get(userId: number): Promise<ReturnData<UserMetadataDTO>> {
    const row = await this.findOrCreate(userId);
    return {
      success: true,
      message: "Les données d'onboarding ont été récupérées avec succès.",
      data: toDTO(row),
    };
  }

  /** Enregistre une étape (ou la fin / le refus du parcours). */
  async update(userId: number, patch: UserMetadataPatch): Promise<ReturnData<UserMetadataDTO>> {
    const current = await this.findOrCreate(userId);

    // « autre » est le seul cas où le texte libre est conservé.
    const nextProfession = patch.profession !== undefined ? patch.profession : current.profession;
    const nextProfessionOther =
      nextProfession !== "autre"
        ? null
        : patch.professionOther !== undefined
          ? patch.professionOther
          : current.professionOther;

    // Statut : fin ou refus demandés explicitement ; sinon une première réponse
    // fait passer le parcours « en cours ». Un parcours terminé le reste, même
    // si l'utilisateur corrige une réponse plus tard.
    let nextStatus: OnboardingStatus = current.onboardingStatus;
    if (patch.status) {
      nextStatus = patch.status;
    } else if (current.onboardingStatus === "NOT_STARTED" || current.onboardingStatus === "SKIPPED") {
      nextStatus = "IN_PROGRESS";
    }

    // On ne recule jamais l'étape atteinte : elle mesure l'avancée maximale.
    const nextStep =
      patch.currentStep !== undefined ? Math.max(patch.currentStep, current.currentStep) : current.currentStep;

    const updated = await prisma.userMetadata.update({
      where: { userId },
      data: {
        onboardingStatus: nextStatus,
        onboardingVersion: ONBOARDING_VERSION,
        currentStep: nextStep,
        completedAt: nextStatus === "COMPLETED" ? (current.completedAt ?? new Date()) : current.completedAt,
        profession: nextProfession,
        professionOther: nextProfessionOther,
        ...(patch.primaryIntents !== undefined ? { primaryIntents: patch.primaryIntents } : {}),
        ...(patch.contractVolume !== undefined ? { contractVolume: patch.contractVolume } : {}),
        ...(patch.teamSize !== undefined ? { teamSize: patch.teamSize } : {}),
        ...(patch.hasNoEnterprise !== undefined ? { hasNoEnterprise: patch.hasNoEnterprise } : {}),
      },
    });

    // Entonnoir : une ligne par étape nouvellement atteinte, puis l'issue.
    if (nextStep > current.currentStep) {
      void trackOnboardingEvent(userId, `onboarding_step_${nextStep}`);
    }
    if (nextStatus !== current.onboardingStatus) {
      if (nextStatus === "IN_PROGRESS") void trackOnboardingEvent(userId, "onboarding_started");
      if (nextStatus === "COMPLETED") void trackOnboardingEvent(userId, "onboarding_completed");
      if (nextStatus === "SKIPPED") void trackOnboardingEvent(userId, "onboarding_skipped");
    }

    return {
      success: true,
      message: "Les données d'onboarding ont été enregistrées avec succès.",
      data: toDTO(updated),
    };
  }

  /**
   * Efface les réponses de l'utilisateur (droit à l'effacement) et marque le
   * parcours comme refusé, pour ne pas lui reposer les questions.
   */
  async reset(userId: number): Promise<ReturnData<UserMetadataDTO>> {
    await this.findOrCreate(userId);

    const cleared = await prisma.userMetadata.update({
      where: { userId },
      data: {
        onboardingStatus: "SKIPPED",
        currentStep: 0,
        completedAt: null,
        profession: null,
        professionOther: null,
        primaryIntents: [],
        contractVolume: null,
        teamSize: null,
        hasNoEnterprise: false,
      },
    });

    return {
      success: true,
      message: "Les réponses d'onboarding ont été effacées.",
      data: toDTO(cleared),
    };
  }
}
