import { Pencil, Layers, AlertCircle } from "lucide-react";
import type { Signer, SignerRole, FieldType } from "./types";

interface Props {
  signers: Signer[];
  activeSignerRole: SignerRole;
  /** Type de champ "armé" pour le prochain clic — null = pas de placement actif. */
  armedFieldType: FieldType | null;
  replicateAllPages: boolean;
  onSignerChange: (role: SignerRole) => void;
  onArmFieldType: (type: FieldType) => void;
  onReplicateAllPagesChange: (value: boolean) => void;
}

/**
 * Barre latérale de l'étape "Placer" :
 *  - choix du signataire à qui assigner le prochain champ
 *  - choix du type de champ (signature ou paraphe)
 *  - case "Toutes les pages" pour dupliquer le champ
 *
 * Le bouton de type "arme" le placement : un clic sur le PDF déposera UN
 * champ et désarmera automatiquement la toolbar — l'utilisateur doit
 * recliquer ici pour ajouter un autre champ.
 */
export function PlaceToolbar({
  signers, activeSignerRole, armedFieldType, replicateAllPages,
  onSignerChange, onArmFieldType, onReplicateAllPagesChange,
}: Props) {
  return (
    <aside className="space-y-4">
      <SignerPicker
        signers={signers}
        active={activeSignerRole}
        onChange={onSignerChange}
      />

      <FieldTypePicker
        armed={armedFieldType}
        replicateAllPages={replicateAllPages}
        onArm={onArmFieldType}
        onReplicateAllPagesChange={onReplicateAllPagesChange}
      />

      <HintBox armed={!!armedFieldType} />
    </aside>
  );
}

// ─── Pickers ──────────────────────────────────────────────────────────────────

/** Sélection du signataire (boutons colorés selon le rôle). */
function SignerPicker({
  signers, active, onChange,
}: {
  signers: Signer[];
  active: SignerRole;
  onChange: (role: SignerRole) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Assigner à</p>
      <div className="space-y-1.5">
        {signers.map((s) => (
          <button
            key={s.role}
            onClick={() => onChange(s.role)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all ${
              active === s.role
                ? "border-gray-300 bg-gray-50 shadow-sm"
                : "border-transparent hover:bg-gray-50"
            }`}
          >
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.hex }} />
            <span className="text-xs font-semibold text-gray-700 truncate">{s.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Sélection du type de champ + option "Toutes les pages". */
function FieldTypePicker({
  armed, replicateAllPages, onArm, onReplicateAllPagesChange,
}: {
  armed: FieldType | null;
  replicateAllPages: boolean;
  onArm: (type: FieldType) => void;
  onReplicateAllPagesChange: (value: boolean) => void;
}) {
  const showAllPagesOption = armed === "signature" || armed === "initial";
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Type de champ</p>
      <div className="space-y-1.5">
        <FieldTypeButton
          icon={Pencil}
          label="Signature"
          selected={armed === "signature"}
          onClick={() => onArm("signature")}
        />
        <FieldTypeButton
          icon={Layers}
          label="Paraphe"
          selected={armed === "initial"}
          onClick={() => onArm("initial")}
        />
      </div>

      {showAllPagesOption && (
        <label className="flex items-start gap-2 pt-2 border-t border-gray-100 cursor-pointer">
          <input
            type="checkbox"
            checked={replicateAllPages}
            onChange={(e) => onReplicateAllPagesChange(e.target.checked)}
            className="mt-0.5 w-3.5 h-3.5 rounded border-gray-300 text-[#354F99] focus:ring-[#354F99]/30"
          />
          <div>
            <p className="text-xs font-semibold text-gray-700">Toutes les pages</p>
            <p className="text-[10px] text-gray-400 leading-tight">
              Le champ sera dupliqué à la même position sur chaque page.
            </p>
          </div>
        </label>
      )}
    </div>
  );
}

/** Un bouton de la liste des types de champ. */
function FieldTypeButton({
  icon: Icon, label, selected, onClick,
}: {
  icon: React.ElementType;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 transition-all ${
        selected
          ? "border-[#354F99] bg-[#354F99]/5 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <Icon className={`w-3.5 h-3.5 ${selected ? "text-[#354F99]" : "text-gray-400"}`} />
      <span className={`text-xs font-semibold ${selected ? "text-[#354F99]" : "text-gray-700"}`}>
        {label}
      </span>
    </button>
  );
}

/** Hint contextuel : explique l'action en attente selon que la toolbar soit armée ou non. */
function HintBox({ armed }: { armed: boolean }) {
  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex gap-2">
      <AlertCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
      <p className="text-[11px] text-indigo-700 leading-relaxed">
        {armed
          ? "Cliquez sur le document pour déposer le champ. Le placement se désactivera ensuite."
          : "Sélectionnez un type de champ pour activer le placement, puis cliquez sur le document."}
      </p>
    </div>
  );
}
