/**
 * Onboarding — logique du formulaire : réponses en cours, étapes affichées,
 * navigation et enregistrement. Aucun affichage ici.
 */
import { useMemo, useState } from "react";

import { useUserStore } from "../../store/userStore";
import type { CompanyResult } from "../../types/companySearch";
import type { OnboardingData, OnboardingPatch } from "../../types/onboarding";
import { GENERIC_SAVE_ERROR, patchOnboarding, saveEnterpriseFromCompany } from "./api";
import {
  INTENT_OPTIONS,
  MAX_INTENTS,
  PROFESSION_OTHER,
  PROFESSIONS_WITHOUT_ORGANISATION,
  STEPS,
  type StepId,
} from "./constants";

export interface OnboardingAnswers {
  intents: string[];
  profession: string | null;
  professionOther: string;
  contractVolume: string | null;
  teamSize: string | null;
  company: CompanyResult | null;
  noEnterprise: boolean;
}

/** Réponses de départ : celles déjà enregistrées, pour reprendre où l'on s'était arrêté. */
function initialAnswers(onboarding: OnboardingData | null): OnboardingAnswers {
  const knownIntents = INTENT_OPTIONS.map((option) => option.code);
  return {
    intents: (onboarding?.primaryIntents ?? []).filter((code) => knownIntents.includes(code)),
    profession: onboarding?.profession ?? null,
    professionOther: onboarding?.professionOther ?? "",
    contractVolume: onboarding?.contractVolume ?? null,
    teamSize: onboarding?.teamSize ?? null,
    company: null,
    noEnterprise: onboarding?.hasNoEnterprise ?? false,
  };
}

export function useOnboardingForm() {
  // Photographie du store à l'ouverture : le formulaire ne doit pas se
  // réorganiser sous les yeux de l'utilisateur quand ses propres
  // enregistrements mettent le store à jour.
  const [snapshot] = useState(() => {
    const { onboarding, userData } = useUserStore.getState();
    const enterprise = userData?.enterprise;
    return {
      onboarding,
      hasEnterprise: Boolean(enterprise?.siren || enterprise?.name),
    };
  });

  const [answers, setAnswers] = useState<OnboardingAnswers>(() => initialAnswers(snapshot.onboarding));
  const [stepId, setStepId] = useState<StepId>(() => {
    // Reprise d'un parcours interrompu : on rouvre à l'étape atteinte.
    if (snapshot.onboarding?.onboardingStatus !== "IN_PROGRESS") return "intent";
    return STEPS.find((step) => step.index === snapshot.onboarding?.currentStep)?.id ?? "intent";
  });
  /** Sens de la dernière navigation : +1 vers l'avant, -1 vers l'arrière (pilote l'animation). */
  const [direction, setDirection] = useState<1 | -1>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  // Étapes réellement affichées : un étudiant ou un particulier n'a ni volume
  // de contrats ni structure à déclarer ; une structure déjà connue n'est pas
  // redemandée.
  const visibleSteps = useMemo(() => {
    const withoutOrganisation =
      answers.profession !== null && PROFESSIONS_WITHOUT_ORGANISATION.includes(answers.profession);
    return STEPS.filter((step) => {
      if (step.id === "activity") return !withoutOrganisation;
      if (step.id === "enterprise") return !withoutOrganisation && !snapshot.hasEnterprise;
      return true;
    });
  }, [answers.profession, snapshot.hasEnterprise]);

  const position = Math.max(
    0,
    visibleSteps.findIndex((step) => step.id === stepId),
  );
  const currentStep = visibleSteps[position];
  const isLastStep = position === visibleSteps.length - 1;

  const canContinue = (() => {
    switch (currentStep.id) {
      case "intent":
        return answers.intents.length > 0;
      case "profession":
        return answers.profession === PROFESSION_OTHER
          ? answers.professionOther.trim().length >= 2
          : answers.profession !== null;
      case "activity":
        return answers.contractVolume !== null && answers.teamSize !== null;
      case "enterprise":
        return answers.company !== null || answers.noEnterprise;
    }
  })();

  const update = (changes: Partial<OnboardingAnswers>) => {
    setError(null);
    setAnswers((current) => ({ ...current, ...changes }));
  };

  /** Coche / décoche un outil, en conservant l'ordre de sélection. */
  const toggleIntent = (code: string) => {
    setError(null);
    setAnswers((current) => {
      if (current.intents.includes(code)) {
        return { ...current, intents: current.intents.filter((intent) => intent !== code) };
      }
      if (current.intents.length >= MAX_INTENTS) return current;
      return { ...current, intents: [...current.intents, code] };
    });
  };

  /** Réponses de l'étape affichée, au format attendu par le serveur. */
  const answersOfCurrentStep = (): OnboardingPatch => {
    switch (currentStep.id) {
      case "intent":
        return { primaryIntents: answers.intents };
      case "profession":
        return {
          profession: answers.profession,
          professionOther: answers.profession === PROFESSION_OTHER ? answers.professionOther.trim() : null,
        };
      case "activity":
        return { contractVolume: answers.contractVolume, teamSize: answers.teamSize };
      case "enterprise":
        return { hasNoEnterprise: answers.noEnterprise };
    }
  };

  /**
   * Passe à l'étape suivante en enregistrant celle-ci. `skip` avance sans
   * enregistrer de réponse : chaque question reste facultative.
   */
  const goNext = async (skip = false) => {
    if (saving) return;
    const nextStep = visibleSteps[position + 1];
    const patch: OnboardingPatch = skip ? {} : answersOfCurrentStep();
    if (nextStep) patch.currentStep = nextStep.index;
    else patch.status = "COMPLETED";

    setSaving(true);
    setError(null);
    try {
      if (!skip && currentStep.id === "enterprise" && answers.company) {
        await saveEnterpriseFromCompany(answers.company);
      }
      await patchOnboarding(patch);
      setDirection(1);
      if (nextStep) setStepId(nextStep.id);
      else setFinished(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : GENERIC_SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    const previousStep = visibleSteps[position - 1];
    if (!previousStep || saving) return;
    setError(null);
    setDirection(-1);
    setStepId(previousStep.id);
  };

  /** « Ne plus me le proposer » : le parcours est marqué comme refusé. */
  const decline = async (): Promise<boolean> => {
    if (saving) return false;
    setSaving(true);
    setError(null);
    try {
      await patchOnboarding({ status: "SKIPPED" });
      return true;
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : GENERIC_SAVE_ERROR);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    answers,
    update,
    toggleIntent,
    visibleSteps,
    position,
    currentStep,
    isLastStep,
    canContinue,
    direction,
    saving,
    error,
    finished,
    goNext,
    goBack,
    decline,
  };
}

/** État et actions du formulaire, tels que reçus par chaque étape. */
export type OnboardingFormState = ReturnType<typeof useOnboardingForm>;
