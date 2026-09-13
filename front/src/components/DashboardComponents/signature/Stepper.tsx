import { Check } from "lucide-react";
import type { WizardStep } from "./types";

/** Définition d'une étape du wizard pour le rendu visuel. */
interface StepDef {
  id: WizardStep;
  label: string;
}

const STEPS: StepDef[] = [
  { id: "prepare", label: "Préparer" },
  { id: "place",   label: "Placer" },
  { id: "sign",    label: "Signer" },
];

/**
 * Indicateur de progression à 3 étapes, compact, affiché dans le bandeau bleu
 * du wizard : l'étape courante est en blanc plein, les étapes passées sont
 * cochées, les suivantes estompées.
 *
 * @param current Étape actuellement affichée.
 */
export function Stepper({ current }: { current: WizardStep }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="flex items-center gap-1.5">
      {STEPS.map((step, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={step.id} className="flex items-center gap-1.5">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                done ? "bg-emerald-400 text-white" : active ? "bg-white text-[#354F99]" : "bg-white/15 text-white/60"
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={`text-xs font-semibold ${active ? "text-white" : done ? "text-white/80" : "text-white/50"}`}>
              {step.label}
            </span>
            {i < STEPS.length - 1 && <span className="mx-1.5 h-px w-6 bg-white/30" />}
          </li>
        );
      })}
    </ol>
  );
}
