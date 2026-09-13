import { useState } from "react";
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
  /** Plus utilisé depuis le retrait de la checklist — gardé pour compatibilité avec SignatureWizard. */
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
 * La colonne de gauche reste visible au défilement : une consigne courte, le
 * bouton « Suivant » juste en dessous, puis la case « Toutes les pages ». Dès
 * qu'une zone a été glissée, la consigne passe au vert et invite à continuer.
 * Le document s'ouvre sur sa dernière page, où les deux zones sont déjà
 * suggérées (voir SignatureWizard).
 */
export function PlaceStep(props: Props) {
  const {
    file, fields, signers, activeSignerRole, armedFieldType, replicateAllPages,
    onArmFieldType, onReplicateAllPagesChange,
    onFieldAdd, onFieldMove, onFieldRemove, onNumPagesLoaded,
    onBack, onNext, canGoNext,
  } = props;

  // Une zone a-t-elle déjà été glissée ? Sert à dire clairement « c'est bon, continuez ».
  const [moved, setMoved] = useState(false);
  const handleMove = (id: string, xPct: number, yPct: number) => {
    setMoved(true);
    onFieldMove(id, xPct, yPct);
  };

  const hasSelfField = fields.some((f) => f.signer === "self");
  const hasCounterpartyField = fields.some((f) => f.signer === "counterparty");
  const selfSigner = signers.find((s) => s.role === "self");
  const counterSigner = signers.find((s) => s.role === "counterparty");

  // Sous-étape courante du guidage : 1 = votre zone, 2 = zone du cocontractant, 3 = prêt.
  const phase = !hasSelfField ? 1 : !hasCounterpartyField ? 2 : 3;
  const ready = phase === 3 && moved;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)] gap-6">
      {/* Colonne de gauche : reste à l'écran pendant le défilement du document */}
      <div className="space-y-3 self-start lg:sticky lg:top-20">
        {phase === 1 && (
          <GuideCard hex={selfSigner?.hex ?? "#4f46e5"} icon={MousePointerClick} title="Votre signature">
            Cliquez sur le document pour la placer.
          </GuideCard>
        )}
        {phase === 2 && (
          <GuideCard hex={counterSigner?.hex ?? "#10b981"} icon={MousePointerClick} title="Signature du cocontractant">
            Cliquez sur le document pour la placer.
          </GuideCard>
        )}
        {phase === 3 && !moved && (
          <GuideCard hex="#354F99" icon={Move} title="Placez les signatures">
            Glissez les zones à l'endroit voulu.
          </GuideCard>
        )}
        {ready && (
          <GuideCard hex="#059669" icon={CheckCircle2} title="C'est placé">
            Cliquez sur « Suivant ».
          </GuideCard>
        )}

        {/* Précédent et Suivant sur une seule ligne */}
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            title="Précédent"
            className="flex shrink-0 items-center gap-1 px-3 py-2.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Précédent
          </button>
          <button
            onClick={onNext}
            disabled={!canGoNext}
            className={`flex flex-1 items-center justify-center gap-1.5 px-4 py-2.5 bg-[#354F99] text-white text-sm font-semibold rounded-xl hover:bg-[#1a2d5a] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm ${
              ready ? "ring-4 ring-[#354F99]/25 animate-pulse" : ""
            }`}
          >
            Suivant <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <PlaceToolbar
          armedFieldType={armedFieldType}
          replicateAllPages={replicateAllPages}
          onArmFieldType={onArmFieldType}
          onReplicateAllPagesChange={onReplicateAllPagesChange}
        />
      </div>

      <div className="min-w-0">
        <div className="bg-gray-50 rounded-xl px-4 pb-4">
        <PdfViewer
          file={file}
          fields={fields}
          signers={signers}
          mode="place"
          activeFieldType={armedFieldType}
          activeSignerRole={activeSignerRole}
          replicateAllPages={replicateAllPages}
          onFieldAdd={onFieldAdd}
          onFieldMove={handleMove}
          onFieldRemove={onFieldRemove}
          onLoaded={onNumPagesLoaded}
          startOnLastPage
          spotlight={() => !moved}
          spotlightLabel="Glissez pour déplacer"
        />
        </div>
      </div>
    </div>
  );
}

/** Carte de consigne courte, colorée selon le signataire ou l'état, en tête de la colonne de gauche. */
function GuideCard({ hex, icon: Icon, title, children }: {
  hex: string;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border-2 p-3.5 shadow-sm"
      style={{ borderColor: hex + "66", backgroundColor: hex + "0d" }}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: hex }}>
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-sm font-bold text-gray-900">{title}</p>
      </div>
      <p className="mt-1.5 text-sm text-gray-700">{children}</p>
    </div>
  );
}
