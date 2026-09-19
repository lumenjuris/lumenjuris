import { useState } from "react";
import { ChevronRight, CheckCircle2, RotateCcw } from "lucide-react";
import { PdfViewer } from "./PdfViewer";
import { PlaceToolbar } from "./PlaceToolbar";
import { GuidePanel } from "./GuidePanel";
import { getGuideContent } from "./guide";
import type { GuidePhase } from "./guide";
import type { Field, FieldType, Signer, SignerRole } from "./types";

interface Props {
  file: File | null;
  fields: Field[];
  signers: Signer[];
  activeSignerRole: SignerRole;
  /** Type de champ "armé" pour le prochain clic. null = mode placement désactivé. */
  armedFieldType: FieldType | null;
  replicateAllPages: boolean;
  /** Vrai quand le cocontractant doit parapher toutes les pages (sauf la dernière). */
  initialAllPages: boolean;
  /** Faux pour un document d'une seule page : il n'y a alors rien à parapher. */
  canAddInitials: boolean;
  onSignerChange: (role: SignerRole) => void;
  onArmFieldType: (type: FieldType) => void;
  onReplicateAllPagesChange: (value: boolean) => void;
  onInitialAllPagesChange: (value: boolean) => void;
  onFieldAdd: (field: Omit<Field, "id">) => void;
  onFieldMove: (id: string, xPct: number, yPct: number) => void;
  onFieldRemove: (id: string) => void;
  onNumPagesLoaded: (n: number) => void;
  /** Ouvre le sélecteur de fichier pour remplacer le document en cours. */
  onChangeDocument: () => void;
  onNext: () => void;
  canGoNext: boolean;
}

/** Couleur de marque, utilisée quand l'étape ne concerne aucun signataire précis. */
const BRAND_HEX = "#354F99";

/**
 * Étape 1 du parcours visible : placer les zones de signature sur le PDF.
 *
 * Layout : colonne de gauche = guide contextuel sticky (étape en cours, action
 * attendue, étape suivante) + checklist des zones ; colonne de droite = le
 * document, remonté tout en haut de l'écran puisque toutes les consignes
 * vivent à gauche.
 *
 * Le document s'ouvre sur sa dernière page, où le wizard pré-place les deux
 * zones (c'est là que se trouve la signature dans la quasi-totalité des
 * contrats). Tant qu'aucune n'a été déplacée, un overlay grise la page autour
 * d'elles et une étiquette « Glissez pour déplacer » rebondit au-dessus de
 * chacune. Rien n'est imposé : l'utilisateur peut les déplacer, les supprimer
 * ou cliquer ailleurs pour en poser d'autres.
 *
 * Les paraphes (option « Faire parapher toutes les pages ») sont à part : ils
 * ont une position fixe et ne comptent pas comme zone de signature.
 */
export function PlaceStep(props: Props) {
  const {
    file, fields, signers, activeSignerRole, armedFieldType, replicateAllPages,
    initialAllPages, canAddInitials,
    onSignerChange, onArmFieldType, onReplicateAllPagesChange, onInitialAllPagesChange,
    onFieldAdd, onFieldMove, onFieldRemove, onNumPagesLoaded,
    onChangeDocument, onNext, canGoNext,
  } = props;

  // Seules les zones de signature comptent ici : un paraphe du cocontractant
  // ne remplace pas sa zone de signature.
  const hasSelfField = fields.some((f) => f.signer === "self" && f.type === "signature");
  const hasCounterpartyField = fields.some((f) => f.signer === "counterparty" && f.type === "signature");
  const selfSigner = signers.find((s) => s.role === "self");
  const counterSigner = signers.find((s) => s.role === "counterparty");

  // Phase du guidage : elle suit l'avancement réel du placement.
  const phase: GuidePhase = !hasSelfField
    ? "place-self"
    : !hasCounterpartyField
    ? "place-counterparty"
    : "place-ready";
  const guide = getGuideContent(phase);
  const accentHex =
    guide.signer === "counterparty"
      ? counterSigner?.hex ?? "#10b981"
      : guide.signer === "self"
      ? selfSigner?.hex ?? "#4f46e5"
      : BRAND_HEX;

  // Tant qu'aucune zone n'a été déplacée, l'overlay met les zones pré-placées
  // en avant : on voit d'emblée qu'elles sont là et qu'on peut les glisser.
  // Au premier déplacement il s'efface — le message est passé.
  const [hasMovedAField, setHasMovedAField] = useState(false);
  function handleFieldMove(id: string, xPct: number, yPct: number) {
    setHasMovedAField(true);
    onFieldMove(id, xPct, yPct);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
      {/* Colonne de gauche : sticky, elle accompagne l'utilisateur pendant le scroll */}
      <div className="lg:col-span-1 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
        <GuidePanel content={guide} accentHex={accentHex}>
          {/* Checklist des zones — affichée seulement tant qu'il manque une zone :
              une fois les deux posées, elle n'a plus rien à indiquer. Elle
              revient d'elle-même si l'utilisateur supprime une zone. */}
          {phase !== "place-ready" && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Zones à placer</p>
              <ChecklistItem
                done={hasSelfField}
                active={activeSignerRole === "self"}
                hex={selfSigner?.hex ?? "#4f46e5"}
                label="1. Votre signature"
                onClick={() => onSignerChange("self")}
              />
              <ChecklistItem
                done={hasCounterpartyField}
                active={activeSignerRole === "counterparty"}
                hex={counterSigner?.hex ?? "#10b981"}
                label="2. Signature du cocontractant"
                onClick={() => onSignerChange("counterparty")}
              />
              <p className="text-[10px] text-gray-400 leading-tight pt-0.5">
                Cliquez sur une ligne pour placer une zone supplémentaire pour ce signataire.
              </p>
            </div>
          )}

          <PlaceToolbar
            armedFieldType={armedFieldType}
            replicateAllPages={replicateAllPages}
            onArmFieldType={onArmFieldType}
            onReplicateAllPagesChange={onReplicateAllPagesChange}
            initialAllPages={initialAllPages}
            canAddInitials={canAddInitials}
            onInitialAllPagesChange={onInitialAllPagesChange}
          />

          {/* Actions : au même endroit qu'à l'étape suivante, toujours visibles */}
          <div className="space-y-2">
            <button
              onClick={onNext}
              disabled={!canGoNext}
              className={`w-full flex items-center justify-center gap-2 px-5 py-3 bg-[#354F99] text-white text-sm font-semibold rounded-xl hover:bg-[#1a2d5a] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm ${
                phase === "place-ready" ? "ring-2 ring-[#354F99]/30 ring-offset-2" : ""
              }`}
            >
              Signer <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={onChangeDocument}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Changer de document
            </button>
          </div>
        </GuidePanel>
      </div>

      {/* Colonne de droite : le document, en haut de l'écran */}
      <div className="lg:col-span-3">
        <div className="bg-gray-50 rounded-xl px-4 pb-4">
          <PdfViewer
            file={file}
            fields={fields}
            signers={signers}
            mode="place"
            activeFieldType={armedFieldType}
            activeSignerRole={activeSignerRole}
            replicateAllPages={replicateAllPages}
            initialPage="last"
            // Les paraphes ne se déplacent pas : pas d'étiquette « Glissez » sur eux.
            spotlight={(f) => f.type === "signature" && !hasMovedAField}
            spotlightLabel="Glissez pour déplacer"
            onFieldAdd={onFieldAdd}
            onFieldMove={handleFieldMove}
            onFieldRemove={onFieldRemove}
            onLoaded={onNumPagesLoaded}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

/**
 * Ligne de checklist (zone placée / en cours / à venir) — cliquable : elle
 * fait à la fois office d'indicateur de progression ET de sélecteur du
 * signataire actif.
 */
function ChecklistItem({
  done, active, hex, label, onClick,
}: {
  done: boolean;
  active: boolean;
  hex: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 -mx-2 transition-colors bg-gray-50 hover:bg-gray-200 ${
        active ? "bg-gray-500/20" : ""
      }`}
    >
      {done ? (
        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
      ) : (
        <span
          className={`w-4 h-4 shrink-0 rounded-full border-2 ${active ? "animate-pulse" : "opacity-40"}`}
          style={{ borderColor: hex }}
        />
      )}
      <span className={`text-xs text-left ${done ? "text-gray-400 line-through" : active ? "font-semibold text-gray-800" : "text-gray-500"}`}>
        {label}
      </span>
{/*       {active && (
        <span className="ml-auto text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full text-white shrink-0" style={{ backgroundColor: hex }}>
          {done ? "prochain clic" : "en cours"}
        </span>
      )} */}
    </button>
  );
}
