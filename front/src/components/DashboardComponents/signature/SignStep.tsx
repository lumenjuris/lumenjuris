import { AlertCircle, ChevronLeft, Send, MailPlus } from "lucide-react";
import { PdfViewer } from "./PdfViewer";
import { SignProgress } from "./SignProgress";
import type { Field, Signer } from "./types";

interface Props {
  file: File | null;
  fields: Field[];
  signers: Signer[];
  /** True après clic sur "Envoyer" — affiche l'écran de confirmation. */
  sent: boolean;
  /** True quand tous les champs assignés à "self" sont signés. */
  allSelfSigned: boolean;
  onFieldClick: (field: Field) => void;
  onNumPagesLoaded: (n: number) => void;
  onBack: () => void;
  onSend: () => void;
  onReset: () => void;
}

/**
 * Étape 3 du wizard : l'utilisateur signe ses propres champs, puis envoie le
 * contrat au cocontractant (envoi simulé — pas de logique email).
 *
 * Deux états visuels :
 *  - mode "signature" (par défaut) : viewer + sidebar de progression
 *  - mode "sent" : écran de confirmation après clic sur Envoyer
 */
export function SignStep(props: Props) {
  const { file, fields, signers, sent, allSelfSigned, onFieldClick, onNumPagesLoaded, onBack, onSend, onReset } = props;

  if (sent) {
    return <SentConfirmation signers={signers} onReset={onReset} />;
  }

  const selfFields = fields.filter((f) => f.signer === "self");
  const counterFields = fields.filter((f) => f.signer === "counterparty");
  const selfSigned = selfFields.filter((f) => !!f.value).length;
  const selfColor = signers.find((s) => s.role === "self")?.hex ?? "#4f46e5";
  const counterColor = signers.find((s) => s.role === "counterparty")?.hex ?? "#10b981";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <aside className="lg:col-span-1 space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Votre progression</p>
          <SignProgress title="Vos champs" done={selfSigned} total={selfFields.length} color={selfColor} />
          <SignProgress
            title="Cocontractant"
            done={0}
            total={counterFields.length}
            color={counterColor}
            muted
            hint="À signer après envoi"
          />
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-indigo-700 leading-relaxed">
            Cliquez sur vos champs colorés pour les signer. La date sera ajoutée
            automatiquement. Les champs du cocontractant seront remplis après envoi.
          </p>
        </div>

        <button
          onClick={onSend}
          disabled={!allSelfSigned}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <Send className="w-4 h-4" /> Envoyer au cocontractant
        </button>

        <button
          onClick={onBack}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Modifier les champs
        </button>
      </aside>

      <div className="lg:col-span-3 bg-gray-50 rounded-xl p-4">
        <PdfViewer
          file={file}
          fields={fields}
          signers={signers}
          mode="sign"
          onFieldClick={onFieldClick}
          onLoaded={onNumPagesLoaded}
        />
      </div>
    </div>
  );
}

// ─── Confirmation ─────────────────────────────────────────────────────────────

/** Écran de confirmation affiché après clic sur "Envoyer au cocontractant". */
function SentConfirmation({ signers, onReset }: { signers: Signer[]; onReset: () => void }) {
  const counterparty = signers.find((s) => s.role === "counterparty");
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5 text-center max-w-lg mx-auto">
      <div className="w-20 h-20 rounded-2xl bg-emerald-100 flex items-center justify-center">
        <MailPlus className="w-10 h-10 text-emerald-600 stroke-[1.5]" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-800">Document prêt à être envoyé</h3>
        <p className="text-sm text-gray-500 leading-relaxed">
          Le contrat sera transmis à{" "}
          <span className="font-semibold text-gray-700">{counterparty?.name ?? "Cocontractant"}</span>
          {" "}pour signature. Vous serez notifié dès qu'il aura signé.
        </p>
        <p className="text-[11px] text-gray-400 italic mt-3">
          (Envoi simulé — la fonctionnalité d'envoi par email sera activée prochainement.)
        </p>
      </div>
      <button
        onClick={onReset}
        className="px-5 py-2.5 text-sm font-semibold text-[#354F99] bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
      >
        Nouveau contrat
      </button>
    </div>
  );
}
