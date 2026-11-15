/**
 * Types de l'onboarding (formulaire d'accueil), miroir de `UserMetadataDTO`
 * côté backNode (`services/classUserMetadata.ts`).
 */

export type OnboardingStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

/** État du parcours + réponses, tel que renvoyé par `GET /api/user-metadata`. */
export interface OnboardingData {
  onboardingStatus: OnboardingStatus;
  onboardingVersion: number;
  /** Index de la dernière étape atteinte (0 = intention … 3 = entreprise). */
  currentStep: number;
  completedAt: string | null;
  profession: string | null;
  professionOther: string | null;
  /** Codes d'outils, 3 max, dans l'ordre de sélection. */
  primaryIntents: string[];
  contractVolume: string | null;
  teamSize: string | null;
  hasNoEnterprise: boolean;
}

/** Corps accepté par `PATCH /api/user-metadata` : tout est facultatif. */
export interface OnboardingPatch {
  currentStep?: number;
  profession?: string | null;
  professionOther?: string | null;
  primaryIntents?: string[];
  contractVolume?: string | null;
  teamSize?: string | null;
  hasNoEnterprise?: boolean;
  status?: "COMPLETED" | "SKIPPED";
}
