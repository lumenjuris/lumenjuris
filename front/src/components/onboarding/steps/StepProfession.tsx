import { AnimatePresence, motion } from "framer-motion";

import { Input } from "../../ui/Input";
import { revealList } from "../animations";
import { EASE_OUT, PROFESSION_OPTIONS, PROFESSION_OTHER, PROFESSION_OTHER_MAX_LENGTH } from "../constants";
import { ChoiceChip, StepHeading } from "../ui";
import type { OnboardingFormState } from "../useOnboardingForm";

/** Étape 2 — profession, avec saisie libre quand « Autre » est choisi. */
export function StepProfession({ form }: { form: OnboardingFormState }) {
  const { profession, professionOther } = form.answers;

  return (
    <>
      <StepHeading
        title="Quelle est votre activité ?"
        subtitle="Nous adaptons le vocabulaire et les modèles proposés à votre métier."
      />

      <motion.div
        role="radiogroup"
        aria-label="Votre activité"
        variants={revealList}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {PROFESSION_OPTIONS.map((option) => (
          <ChoiceChip
            key={option.code}
            label={option.label}
            selected={profession === option.code}
            onSelect={() => form.update({ profession: option.code })}
          />
        ))}
      </motion.div>

      <AnimatePresence initial={false}>
        {profession === PROFESSION_OTHER && (
          <motion.div
            key="other"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            {/* La marge interne laisse la place à l'anneau de focus, sinon rogné. */}
            <div className="px-1 pb-1 pt-3">
              <label htmlFor="onboarding-profession-other" className="mb-1.5 block text-[12.5px] font-semibold text-ink-secondary">
                Précisez votre activité
              </label>
              <Input
                id="onboarding-profession-other"
                autoFocus
                maxLength={PROFESSION_OTHER_MAX_LENGTH}
                placeholder="Ex. : responsable des achats"
                value={professionOther}
                onChange={(event) => form.update({ professionOther: event.target.value })}
                className="h-10 rounded-xl"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
