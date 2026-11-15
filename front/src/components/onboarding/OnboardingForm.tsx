/**
 * Onboarding — fenêtre du formulaire d'accueil : coquille, progression et
 * navigation. C'est le seul composant à monter depuis l'application.
 *
 * Dossier `components/onboarding` :
 *   constants.ts          étapes, listes de réponses, libellés
 *   api.ts                appels au proxy
 *   useOnboardingForm.ts  logique (réponses, navigation, enregistrement)
 *   animations.ts         réglages d'animation et classes partagés
 *   ui.tsx                briques d'interface partagées
 *   steps/                un composant par écran
 *   OnboardingAside.tsx   panneau latéral de progression
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, X } from "lucide-react";

import { useUserStore } from "../../store/userStore";
import { cn } from "../../utils/shadcnUtils/cn";
import { FOCUS_RING } from "./animations";
import { EASE_OUT } from "./constants";
import { OnboardingAside } from "./OnboardingAside";
import { StepActivity } from "./steps/StepActivity";
import { StepDone } from "./steps/StepDone";
import { StepEnterprise } from "./steps/StepEnterprise";
import { StepIntent } from "./steps/StepIntent";
import { StepProfession } from "./steps/StepProfession";
import { useOnboardingForm } from "./useOnboardingForm";

interface OnboardingFormProps {
  /** Ferme la fenêtre sans rien refuser : le formulaire sera reproposé à la prochaine session. */
  onClose: () => void;
}

/**
 * Fenêtre d'onboarding. Elle se suffit à elle-même : il suffit de la monter
 * quand `selectShouldShowOnboarding` est vrai, et de la démonter dans `onClose`.
 */
export function OnboardingForm({ onClose }: OnboardingFormProps) {
  const form = useOnboardingForm();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const firstName = useUserStore((state) => state.userData?.profile?.prenom) ?? "";

  // Échap referme la fenêtre ; la page derrière ne défile pas pendant ce temps.
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleNavigate = (to: string) => {
    onClose();
    navigate(to);
  };

  const handleDecline = async () => {
    if (await form.decline()) onClose();
  };

  const totalSteps = form.visibleSteps.length;
  const progress = form.finished ? 1 : form.position / totalSteps;
  const slide = reduceMotion ? 0 : 26;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-[#0f1b2d]/55 backdrop-blur-[3px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Configuration de votre espace Lumen Juris"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.975 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className="relative flex h-[min(640px,calc(100vh-1.5rem))] w-full max-w-[900px] overflow-hidden rounded-[20px] bg-white shadow-[0_40px_90px_-30px_rgba(11,22,40,0.65)]"
      >
        <OnboardingAside
          firstName={firstName}
          steps={form.visibleSteps}
          position={form.position}
          finished={form.finished}
        />

        <section className="flex min-w-0 flex-1 flex-col">
          {/* Barre de progression : seul repère sur mobile, où le panneau latéral est masqué. */}
          <div className="h-[3px] w-full bg-line-subtle">
            <motion.div
              className="h-full origin-left bg-[linear-gradient(90deg,#2C3A5E_0%,#BE9243_100%)]"
              initial={false}
              animate={{ scaleX: Math.max(progress, 0.04) }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
            />
          </div>

          <header className="flex items-center justify-between px-6 pt-4 sm:px-8">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              {form.finished ? "Terminé" : `Étape ${form.position + 1} sur ${totalSteps}`}
            </span>
            <div className="flex items-center gap-1">
              {!form.finished && (
                <button
                  type="button"
                  onClick={onClose}
                  className={cn("rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink", FOCUS_RING)}
                >
                  Plus tard
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className={cn("rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink", FOCUS_RING)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Contenu de l'étape : glisse dans le sens de la navigation. */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-4 pt-4 sm:px-8">
            <AnimatePresence mode="wait" custom={form.direction} initial={false}>
              <motion.div
                key={form.finished ? "done" : form.currentStep.id}
                custom={form.direction}
                variants={{
                  enter: (direction: number) => ({ opacity: 0, x: direction * slide }),
                  center: { opacity: 1, x: 0 },
                  exit: (direction: number) => ({ opacity: 0, x: direction * -slide }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.26, ease: EASE_OUT }}
                className="h-full"
              >
                {form.finished ? (
                  <StepDone intents={form.answers.intents} firstName={firstName} onNavigate={handleNavigate} />
                ) : (
                  <>
                    {form.currentStep.id === "intent" && <StepIntent form={form} />}
                    {form.currentStep.id === "profession" && <StepProfession form={form} />}
                    {form.currentStep.id === "activity" && <StepActivity form={form} />}
                    {form.currentStep.id === "enterprise" && <StepEnterprise form={form} />}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {!form.finished && (
            <footer className="border-t border-line-subtle px-6 py-3.5 sm:px-8">
              {form.error && (
                <p role="alert" className="mb-2.5 text-[12.5px] text-danger">
                  {form.error}
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                {form.position > 0 ? (
                  <button
                    type="button"
                    onClick={form.goBack}
                    disabled={form.saving}
                    className={cn("flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13.5px] font-medium text-ink-secondary transition-colors hover:bg-surface-subtle disabled:opacity-50", FOCUS_RING)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Retour
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleDecline()}
                    disabled={form.saving}
                    className={cn("rounded-lg px-1 py-1.5 text-[12.5px] text-ink-subtle underline-offset-2 transition-colors hover:text-ink-muted hover:underline disabled:opacity-50", FOCUS_RING)}
                  >
                    Ne plus me le proposer
                  </button>
                )}

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void form.goNext(true)}
                    disabled={form.saving}
                    className={cn("h-10 rounded-xl px-3 text-[13.5px] font-medium text-ink-muted transition-colors hover:bg-surface-subtle hover:text-ink disabled:opacity-50", FOCUS_RING)}
                  >
                    Passer
                  </button>
                  <button
                    type="button"
                    onClick={() => void form.goNext()}
                    disabled={!form.canContinue || form.saving}
                    className={cn(
                      "group flex h-10 min-w-[132px] items-center justify-center gap-2 rounded-xl bg-brand px-5 text-[13.5px] font-semibold text-white transition-[background-color,opacity] duration-200 hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40",
                      FOCUS_RING,
                    )}
                  >
                    {form.saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        {form.isLastStep ? "Terminer" : "Continuer"}
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-enabled:group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </footer>
          )}
        </section>
      </motion.div>
    </div>,
    document.body,
  );
}
