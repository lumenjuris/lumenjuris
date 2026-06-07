import { ChevronLeft, ChevronRight } from "lucide-react";
import { PdfViewer } from "./PdfViewer";
import { PlaceToolbar } from "./PlaceToolbar";
import type { Field, FieldType, Signer, SignerRole } from "./types";

interface Props {
  file: File | null;
  fields: Field[];
  signers: Signer[];
  activeSignerRole: SignerRole;
  /** Type de champ "armé" pour le prochain clic. null = mode placement désactivé. */
  armedFieldType: FieldType | null;
  replicateAllPages: boolean;
  onSignerChange: (role: SignerRole) => void;
  onArmFieldType: (type: FieldType) => void;
  onReplicateAllPagesChange: (value: boolean) => void;
  onFieldAdd: (field: Omit<Field, "id">) => void;
  onFieldMove: (id: string, xPct: number, yPct: number) => void;
  onFieldRemove: (id: string) => void;
  onNumPagesLoaded: (n: number) => void;
  onBack: () => void;
  onNext: () => void;
  canGoNext: boolean;
}

/**
 * Étape 2 du wizard : placer les zones de signature et de paraphe sur le PDF.
 *
 * Layout : toolbar à gauche + viewer à droite. Le mode placement est "armé"
 * par la toolbar et désactivé après chaque dépôt (le composant parent doit
 * appeler `onArmFieldType(null)` après chaque `onFieldAdd`).
 */
export function PlaceStep(props: Props) {
  const {
    file, fields, signers, activeSignerRole, armedFieldType, replicateAllPages,
    onSignerChange, onArmFieldType, onReplicateAllPagesChange,
    onFieldAdd, onFieldMove, onFieldRemove, onNumPagesLoaded,
    onBack, onNext, canGoNext,
  } = props;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1">
        <PlaceToolbar
          signers={signers}
          activeSignerRole={activeSignerRole}
          armedFieldType={armedFieldType}
          replicateAllPages={replicateAllPages}
          onSignerChange={onSignerChange}
          onArmFieldType={onArmFieldType}
          onReplicateAllPagesChange={onReplicateAllPagesChange}
        />
      </div>

      <div className="lg:col-span-3 bg-gray-50 rounded-xl p-4">
        <PdfViewer
          file={file}
          fields={fields}
          signers={signers}
          mode="place"
          activeFieldType={armedFieldType}
          activeSignerRole={activeSignerRole}
          replicateAllPages={replicateAllPages}
          onFieldAdd={onFieldAdd}
          onFieldMove={onFieldMove}
          onFieldRemove={onFieldRemove}
          onLoaded={onNumPagesLoaded}
        />
      </div>

      <div className="lg:col-span-4 flex justify-between items-center pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Précédent
        </button>
        <button
          onClick={onNext}
          disabled={!canGoNext}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#354F99] text-white text-sm font-semibold rounded-xl hover:bg-[#1a2d5a] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          Suivant — Signer <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
