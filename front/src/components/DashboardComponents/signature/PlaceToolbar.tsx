import type { Signer, SignerRole, FieldType } from "./types";

interface Props {
  signers: Signer[];
  activeSignerRole: SignerRole;
  replicateAllPages: boolean;
  onSignerChange: (role: SignerRole) => void;
  /** Toujours appelé avec "signature" — gardé pour compatibilité avec PlaceStep. */
  onArmFieldType: (type: FieldType) => void;
  onReplicateAllPagesChange: (value: boolean) => void;
}

/**
 * Barre latérale de l'étape "Placer" :
 *  - choix du signataire (Vous / Cocontractant)
 *  - case "Toutes les pages" pour dupliquer le champ sur toutes les pages
 *
 * Le type de champ est toujours "signature" et le placement est toujours
 * actif — l'utilisateur clique directement sur le PDF pour poser un champ.
 */
export function PlaceToolbar({
  signers, activeSignerRole, replicateAllPages,
  onSignerChange, onReplicateAllPagesChange,
}: Props) {
  return (
    <aside className="space-y-4">
      <SignerPicker
        signers={signers}
        active={activeSignerRole}
        onChange={onSignerChange}
      />

      <AllPagesToggle
        replicateAllPages={replicateAllPages}
        onChange={onReplicateAllPagesChange}
      />
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

/** Case "Toutes les pages" — duplique le champ sur chaque page du document. */
function AllPagesToggle({
  replicateAllPages, onChange,
}: {
  replicateAllPages: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={replicateAllPages}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 w-3.5 h-3.5 rounded border-gray-300 text-[#354F99] focus:ring-[#354F99]/30"
        />
        <div>
          <p className="text-xs font-semibold text-gray-700">Toutes les pages</p>
          <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
            Le champ sera dupliqué à la même position sur chaque page.
          </p>
        </div>
      </label>
    </div>
  );
}
