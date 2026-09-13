import { CheckCircle2, FileCheck2, MousePointerClick, ArrowRight } from "lucide-react";
import { GUIDE_STEP_LABELS, GUIDE_STEP_TOTAL } from "./guide";
import type { GuideContent } from "./guide";

interface Props {
  /** Consigne courante, calculée depuis l'état du wizard (voir guide.ts). */
  content: GuideContent;
  /** Couleur d'accent du signataire concerné (null → couleur de marque). */
  accentHex: string;
  /** Nom du fichier importé, affiché comme première étape déjà faite. */
  documentName?: string;
  /** Blocs secondaires affichés sous le guide (checklist, options, formulaire). */
  children?: React.ReactNode;
}

/**
 * Colonne de gauche du wizard : guide contextuel permanent.
 *
 * Affiche, dans cet ordre et toujours au même endroit :
 *   1. le bandeau « Étape X sur 2 » (repère de position dans le parcours)
 *   2. l'action attendue maintenant
 *   3. ce qu'il restera à faire ensuite
 *   4. le fil des étapes (import déjà fait → placement → envoi)
 *
 * La colonne est rendue `sticky` par l'étape qui l'utilise : les consignes
 * restent visibles quand l'utilisateur descend dans le document, là où il agit
 * réellement.
 */
export function GuidePanel({ content, accentHex, documentName, children }: Props) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Bandeau d'étape — tout en haut de la colonne, premier point de regard */}
        <div
          className="px-4 py-2.5 flex items-center gap-2"
          style={{ backgroundColor: accentHex }}
        >
          <span className="text-[11px] font-bold uppercase tracking-widest text-white">
            Étape {content.stepNumber} sur {GUIDE_STEP_TOTAL}
          </span>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm font-bold text-gray-900 leading-snug">{content.title}</p>

          {/* Action attendue maintenant */}
          <div
            className="flex items-start gap-2 rounded-lg px-3 py-2.5"
            style={{ backgroundColor: accentHex + "12" }}
          >
            {content.pointsToDocument ? (
              <MousePointerClick
                className="w-4 h-4 shrink-0 mt-0.5"
                style={{ color: accentHex }}
              />
            ) : (
              <ArrowRight
                className="w-4 h-4 shrink-0 mt-0.5"
                style={{ color: accentHex }}
              />
            )}
            <p className="text-xs leading-relaxed text-gray-700">{content.action}</p>
          </div>

          {/* Étape suivante — l'utilisateur sait toujours où il va */}
          {content.next && (
            <p className="text-[11px] text-gray-500 leading-snug">
              <span className="font-semibold text-gray-600">Ensuite :</span>{" "}
              {content.next}
            </p>
          )}

          <StepTrail currentStep={content.stepNumber} documentName={documentName} />
        </div>
      </div>

      {children}
    </div>
  );
}

/**
 * Fil des étapes du parcours : le document importé (déjà fait), puis les deux
 * étapes visibles. Donne le contexte complet sans que l'utilisateur ait à le
 * mémoriser.
 */
function StepTrail({
  currentStep, documentName,
}: {
  currentStep: number;
  documentName?: string;
}) {
  return (
    <ul className="space-y-1.5 pt-1 border-t border-gray-100">
      <li className="flex items-start gap-2 pt-2">
        <FileCheck2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-500" />
        <span className="text-[11px] text-gray-400 leading-snug truncate">
          Document importé{documentName ? ` — ${documentName}` : ""}
        </span>
      </li>
      {GUIDE_STEP_LABELS.map((label, index) => {
        const stepNumber = index + 1;
        const isDone = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;
        return (
          <li key={label} className="flex items-start gap-2">
            {isDone ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-500" />
            ) : (
              <span
                className={`w-3.5 h-3.5 shrink-0 mt-0.5 rounded-full border-2 ${
                  isCurrent ? "border-[#354F99]" : "border-gray-200"
                }`}
              />
            )}
            <span
              className={`text-[11px] leading-snug ${
                isCurrent
                  ? "font-semibold text-gray-800"
                  : isDone
                  ? "text-gray-400"
                  : "text-gray-400"
              }`}
            >
              {stepNumber}. {label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
