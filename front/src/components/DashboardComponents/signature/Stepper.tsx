import { CheckCircle2 } from "lucide-react";
import type { WizardStep } from "./types";

/** Définition d'une étape du wizard pour le rendu visuel. */
interface StepDef {
  id: WizardStep;
  label: string;
  desc: string;
}

const STEPS: StepDef[] = [
  { id: "prepare", label: "Préparer", desc: "Document" },
  { id: "place",   label: "Placer",   desc: "Zones de signature" },
  { id: "sign",    label: "Signer",   desc: "Signer & envoyer" },
];

/**
 * Indicateur de progression à 3 étapes affiché en haut du wizard.
 * Met en évidence l'étape courante, marque les étapes passées comme terminées.
 *
 * @param current Étape actuellement affichée.
 */
export function Stepper({ current }: { current: WizardStep }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((step, i) => (
        <StepperItem
          key={step.id}
          step={step}
          index={i}
          isDone={i < idx}
          isActive={i === idx}
          showConnector={i < STEPS.length - 1}
          connectorActive={i < idx}
        />
      ))}
    </div>
  );
}

interface ItemProps {
  step: StepDef;
  index: number;
  isDone: boolean;
  isActive: boolean;
  showConnector: boolean;
  connectorActive: boolean;
}

/** Une seule entrée du stepper : le rond + le label + le connecteur vers le suivant. */
function StepperItem({ step, index, isDone, isActive, showConnector, connectorActive }: ItemProps) {
  const bullet = isDone
    ? "bg-emerald-500 border-emerald-500 text-white"
    : isActive
    ? "bg-white border-[#354F99] text-[#354F99] shadow-sm"
    : "bg-white border-gray-200 text-gray-300";

  return (
    <div className="flex items-center flex-1 last:flex-none">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all shrink-0 ${bullet}`}>
          {isDone ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
        </div>
        <div>
          <p className={`text-xs font-bold ${isDone || isActive ? "text-gray-800" : "text-gray-400"}`}>
            {step.label}
          </p>
          <p className="text-[10px] text-gray-400 leading-none">{step.desc}</p>
        </div>
      </div>
      {showConnector && (
        <div className={`flex-1 h-0.5 mx-3 transition-colors ${connectorActive ? "bg-emerald-500" : "bg-gray-200"}`} />
      )}
    </div>
  );
}
