import { CONTRACT_VOLUME_OPTIONS, TEAM_SIZE_OPTIONS } from "../constants";
import { ChoiceGroup, StepHeading } from "../ui";
import type { OnboardingFormState } from "../useOnboardingForm";

/** Étape 3 — volume mensuel de contrats et taille de l'équipe. */
export function StepActivity({ form }: { form: OnboardingFormState }) {
  return (
    <>
      <StepHeading
        title="Quelle place occupent les contrats ?"
        subtitle="Deux repères pour vous proposer la formule et l'organisation adaptées."
      />

      <div className="flex flex-col gap-6">
        <ChoiceGroup
          legend="Contrats traités chaque mois"
          options={CONTRACT_VOLUME_OPTIONS}
          value={form.answers.contractVolume}
          onChange={(code) => form.update({ contractVolume: code })}
        />
        <ChoiceGroup
          legend="Personnes qui travaillent sur ces contrats"
          options={TEAM_SIZE_OPTIONS}
          value={form.answers.teamSize}
          onChange={(code) => form.update({ teamSize: code })}
        />
      </div>
    </>
  );
}
