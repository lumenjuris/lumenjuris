/**
 * Page Sandbox — banc d'essai du formulaire d'onboarding.
 * Le formulaire lui-même vit dans `components/onboarding`.
 */
import { useEffect, useState } from "react";

import { deleteOnboardingAnswers } from "../components/onboarding/api";
import { OnboardingForm } from "../components/onboarding/OnboardingForm";
import { selectShouldShowOnboarding, useUserStore } from "../store/userStore";
import type { OnboardingData } from "../types/onboarding";

const STATUS_LABELS: Record<OnboardingData["onboardingStatus"], string> = {
  NOT_STARTED: "Non commencé",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  SKIPPED: "Refusé ou compte antérieur",
};

export const Sandbox = () => {
  const onboarding = useUserStore((state) => state.onboarding);
  const shouldShow = useUserStore(selectShouldShowOnboarding);
  const dismissOnboarding = useUserStore((state) => state.dismissOnboarding);
  // Ouverture forcée : permet de rejouer le formulaire avec un compte qui l'a déjà terminé ou refusé.
  const [forceOpen, setForceOpen] = useState(false);

  // Même verrou que `OnboardingGate` : une fois ouvert, le formulaire reste
  // affiché jusqu'à sa fermeture, écran de fin compris.
  useEffect(() => {
    if (shouldShow) setForceOpen(true);
  }, [shouldShow]);

  const closeForm = () => {
    setForceOpen(false);
    dismissOnboarding();
  };

  const buttonClassName =
    "rounded-lg border border-line bg-white px-3 py-2 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-surface-subtle";

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-[520px] rounded-card border border-line bg-white p-5 shadow-card">
        <p className="text-2xs font-semibold uppercase tracking-[0.09em] text-ink-subtle">Banc d'essai</p>
        <h1 className="mt-1 text-[15px] font-semibold text-ink">Onboarding</h1>
        <p className="mt-2 text-[13px] text-ink-muted">
          État du parcours :{" "}
          <span className="font-semibold text-ink">
            {onboarding ? STATUS_LABELS[onboarding.onboardingStatus] : "non chargé"}
          </span>
          {onboarding ? ` (étape atteinte : ${onboarding.currentStep + 1})` : ""}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setForceOpen(true)} className={buttonClassName}>
            Ouvrir le formulaire
          </button>
          <button type="button" onClick={() => void deleteOnboardingAnswers()} className={buttonClassName}>
            Effacer mes réponses
          </button>
        </div>
      </div>

      {forceOpen && <OnboardingForm onClose={closeForm} />}
    </div>
  );
};
