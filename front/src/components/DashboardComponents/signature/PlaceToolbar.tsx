import type { FieldType } from "./types";

interface Props {
  /** Type de champ armé — non affiché ici, gardé pour compatibilité avec PlaceStep. */
  armedFieldType?: FieldType | null;
  replicateAllPages: boolean;
  /** Toujours appelé avec "signature" — gardé pour compatibilité avec PlaceStep. */
  onArmFieldType: (type: FieldType) => void;
  onReplicateAllPagesChange: (value: boolean) => void;
  /** Vrai quand le cocontractant doit parapher toutes les pages (sauf la dernière). */
  initialAllPages: boolean;
  /** Faux pour un document d'une seule page : il n'y a alors rien à parapher. */
  canAddInitials: boolean;
  onInitialAllPagesChange: (value: boolean) => void;
}

/**
 * Barre latérale de l'étape "Placer" : options du document.
 *  - « Faire parapher toutes les pages » : le cocontractant appose ses
 *    initiales sur chaque page, sauf la dernière ;
 *  - « Toutes les pages » : duplique le champ posé sur chaque page.
 *
 * Le choix du signataire actif (Vous / Cocontractant) vit dans la checklist
 * de progression (PlaceStep).
 */
export function PlaceToolbar({
  replicateAllPages, onReplicateAllPagesChange,
  initialAllPages, canAddInitials, onInitialAllPagesChange,
}: Props) {
  return (
    <aside className="space-y-4">
      <InitialsToggle
        enabled={initialAllPages}
        available={canAddInitials}
        onChange={onInitialAllPagesChange}
      />
      <AllPagesToggle
        replicateAllPages={replicateAllPages}
        onChange={onReplicateAllPagesChange}
      />
    </aside>
  );
}

/**
 * Case « Faire parapher toutes les pages ». Désactivée par défaut : elle
 * ajoute du travail au cocontractant, c'est à l'émetteur de la choisir.
 */
function InitialsToggle({
  enabled, available, onChange,
}: {
  enabled: boolean;
  available: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4 ${available ? "" : "opacity-60"}`}>
      <label className={`flex items-start gap-2 ${available ? "cursor-pointer" : "cursor-not-allowed"}`}>
        <input
          type="checkbox"
          checked={enabled}
          disabled={!available}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 w-3.5 h-3.5 rounded border-gray-300 text-[#354F99] focus:ring-[#354F99]/30"
        />
        <div>
          <p className="text-xs font-semibold text-gray-700">Faire parapher toutes les pages</p>
          <p className="text-[10px] text-gray-400 leading-tight mt-0.5">
            {available
              ? "Le cocontractant apposera ses initiales en bas à droite de chaque page, sauf la dernière."
              : "Document d'une seule page : aucun paraphe nécessaire."}
          </p>
        </div>
      </label>
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
