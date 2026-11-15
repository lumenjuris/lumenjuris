import { motion } from "framer-motion";

import { revealList } from "../animations";
import { INTENT_OPTIONS, MAX_INTENTS } from "../constants";
import { IntentCard, StepHeading } from "../ui";
import type { OnboardingFormState } from "../useOnboardingForm";

/** Étape 1 — outils par lesquels l'utilisateur veut commencer (3 maximum, ordre conservé). */
export function StepIntent({ form }: { form: OnboardingFormState }) {
  const { intents } = form.answers;
  const limitReached = intents.length >= MAX_INTENTS;

  return (
    <>
      <StepHeading
        title="Par quoi souhaitez-vous commencer ?"
        subtitle={`Choisissez jusqu'à ${MAX_INTENTS} outils. Le premier sélectionné sera mis en avant à la fin.`}
      />

      <motion.div
        variants={revealList}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {INTENT_OPTIONS.map((option) => {
          const rankIndex = intents.indexOf(option.code);
          return (
            <IntentCard
              key={option.code}
              title={option.title}
              description={option.description}
              icon={option.icon}
              rank={rankIndex === -1 ? null : rankIndex + 1}
              disabled={limitReached && rankIndex === -1}
              onToggle={() => form.toggleIntent(option.code)}
            />
          );
        })}
      </motion.div>

      <p className="mt-3 text-[12px] text-ink-subtle" aria-live="polite">
        {intents.length} / {MAX_INTENTS} sélectionné{intents.length > 1 ? "s" : ""}
      </p>
    </>
  );
}
