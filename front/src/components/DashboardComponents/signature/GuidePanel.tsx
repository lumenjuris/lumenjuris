import { GUIDE_STEP_TOTAL } from "./guide";
import type { GuideContent } from "./guide";

interface Props {
  /** Étape courante, calculée depuis l'état du wizard (voir guide.ts). */
  content: GuideContent;
  /** Couleur d'accent du signataire concerné. */
  accentHex: string;
  /** Blocs affichés sous le guide (checklist, options, destinataire, actions). */
  children?: React.ReactNode;
}

/**
 * Colonne de gauche du wizard : repère d'étape permanent.
 *
 * Volontairement réduit à l'essentiel : le bandeau « Étape X sur N » et le
 * titre de ce qu'il y a à faire. Les indications détaillées sont portées par
 * le document lui-même (étiquettes animées au-dessus des zones) et par les
 * modales qui s'enchaînent.
 *
 * La colonne est rendue `sticky` par l'étape qui l'utilise : le repère reste
 * visible quand l'utilisateur descend dans le document.
 */
export function GuidePanel({ content, accentHex, children }: Props) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Bandeau d'étape — tout en haut de la colonne, premier point de regard */}
        <div className="px-4 py-2.5" style={{ backgroundColor: accentHex }}>
          <span className="text-[11px] font-bold uppercase tracking-widest text-white">
            Étape {content.stepNumber} sur {GUIDE_STEP_TOTAL}
          </span>
        </div>

        <p className="p-4 text-sm font-bold text-gray-900 leading-snug">{content.title}</p>
      </div>

      {children}
    </div>
  );
}
