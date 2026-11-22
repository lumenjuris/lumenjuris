import { Suspense, lazy, useEffect, useState } from "react";

import { useOnboardingTourStore } from "../../store/onboardingTourStore";
import { selectShouldShowOnboarding, useUserStore } from "../../store/userStore";

// Chargé à la demande : seuls les comptes qui n'ont pas terminé leur parcours
// téléchargent le formulaire.
const OnboardingForm = lazy(() =>
  import("./OnboardingForm").then((module) => ({ default: module.OnboardingForm })),
);

/**
 * Point de montage de l'onboarding dans l'application (voir `MainLayout`).
 *
 * Ouvre le formulaire dès que le store indique qu'il doit être proposé, puis le
 * garde ouvert jusqu'à ce que l'utilisateur le ferme lui-même. Sans ce verrou,
 * le formulaire disparaîtrait à l'instant où la dernière étape est enregistrée
 * (le parcours passe « terminé »), avant l'écran de fin.
 */
export function OnboardingGate() {
  const shouldShow = useUserStore(selectShouldShowOnboarding);
  const dismissOnboarding = useUserStore((state) => state.dismissOnboarding);
  const startTour = useOnboardingTourStore((state) => state.startTour);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (shouldShow) setOpen(true);
  }, [shouldShow]);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    dismissOnboarding();
    // Formulaire terminé (pas seulement fermé ou refusé) : la visite guidée du menu prend le relais.
    if (useUserStore.getState().onboarding?.onboardingStatus === "COMPLETED") startTour();
  };

  return (
    <Suspense fallback={null}>
      <OnboardingForm onClose={close} />
    </Suspense>
  );
}
