import { ChevronLeft, ChevronRight, CheckCircle2, MousePointerClick, Move } from "lucide-react";
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
 * Étape 2 du wizard : placer les zones de signature sur le PDF.
 *
 * Layout : consigne + checklist + toolbar à gauche, viewer à droite. Le
 * document s'ouvre sur sa dernière page, où les deux zones de signature sont
 * déjà suggérées (voir SignatureWizard) : il ne reste qu'à les glisser.
 */
export function PlaceStep(props: Props) {
  const {
    file, fields, signers, activeSignerRole, armedFieldType, replicateAllPages,
    onSignerChange, onArmFieldType, onReplicateAllPagesChange,
    onFieldAdd, onFieldMove, onFieldRemove, onNumPagesLoaded,
    onBack, onNext, canGoNext,
  } = props;

  const hasSelfField = fields.some((f) => f.signer === "self");
  const hasCounterpartyField = fields.some((f) => f.signer === "counterparty");
  const selfSigner = signers.find((s) => s.role === "self");
  const counterSigner = signers.find((s) => s.role === "counterparty");

  // Sous-étape courante du guidage : 1 = votre zone, 2 = zone du cocontractant, 3 = prêt.
  const phase = !hasSelfField ? 1 : !hasCounterpartyField ? 2 : 3;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1 space-y-4">
        {/* Consigne : une seule à la fois, en tête de colonne pour être vue en premier */}
        {phase === 1 && (
          <GuideCard hex={selfSigner?.hex ?? "#4f46e5"} icon={MousePointerClick} title="Votre signature">
            Cliquez sur le contrat à l'endroit où <strong>vous</strong> signerez.
          </GuideCard>
        )}
        {phase === 2 && (
          <GuideCard hex={counterSigner?.hex ?? "#10b981"} icon={MousePointerClick} title="Signature du cocontractant">
            Cliquez maintenant à l'endroit où <strong>votre cocontractant</strong> signera.
          </GuideCard>
        )}
        {phase === 3 && (
          <GuideCard hex="#354F99" icon={Move} title="Vos zones de signature sont prêtes">
            Nous les avons placées en bas de la dernière page, là où l'on signe
            habituellement. <strong>Glissez-les</strong> pour les déplacer si besoin,
            puis cliquez sur « Suivant ».
          </GuideCard>
        )}

        {/* Checklist de progression — on comprend d'un coup d'œil où on en est */}
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

        <PlaceToolbar
          armedFieldType={armedFieldType}
          replicateAllPages={replicateAllPages}
          onArmFieldType={onArmFieldType}
          onReplicateAllPagesChange={onReplicateAllPagesChange}
        />
      </div>

      <div className="lg:col-span-3">
        <div className="bg-gray-50 rounded-xl p-4">
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
          startOnLastPage
        />
        </div>
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
          className={`flex items-center gap-2 px-5 py-2.5 bg-[#354F99] text-white text-sm font-semibold rounded-xl hover:bg-[#1a2d5a] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm ${
            phase === 3 ? "ring-2 ring-[#354F99]/30 ring-offset-2" : ""
          }`}
        >
          Suivant — Signer et envoyer <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Ligne de checklist (zone placée / en cours / à venir) — cliquable : elle
 * fait à la fois office d'indicateur de progression ET de sélecteur du
 * signataire actif (fusion des deux blocs qui se chevauchaient auparavant).
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
      className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 -mx-2 transition-colors ${
        active ? "bg-gray-50" : "hover:bg-gray-50"
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
      {active && (
        <span className="ml-auto text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full text-white shrink-0" style={{ backgroundColor: hex }}>
          {done ? "prochain clic" : "en cours"}
        </span>
      )}
    </button>
  );
}

/** Carte de consigne, colorée selon le signataire concerné, en tête de la colonne de gauche. */
function GuideCard({ hex, icon: Icon, title, children }: {
  hex: string;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border-2 p-4 shadow-sm"
      style={{ borderColor: hex + "66", backgroundColor: hex + "0d" }}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: hex }}>
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-sm font-bold text-gray-900">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-gray-700">{children}</p>
    </div>
  );
}
