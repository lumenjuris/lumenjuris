import { AlertCircle, ChevronLeft, Send, MailPlus, Loader2 } from "lucide-react";
import { PdfViewer } from "./PdfViewer";
import { SignProgress } from "./SignProgress";
import type { Field, Signer } from "./types";

interface Props {
  file: File | null;
  fields: Field[];
  signers: Signer[];
  /** True après confirmation backend — affiche l'écran de confirmation. */
  sent: boolean;
  /** True quand tous les champs assignés à "self" sont signés. */
  allSelfSigned: boolean;
  /** True quand les 4 champs nom/email sont valides. */
  recipientFormValid: boolean;
  /** True quand on peut envoyer (signé + formulaire valide). */
  canSend: boolean;
  /** True pendant l'appel POST /signature-envelope. */
  sending: boolean;
  /** Message d'erreur de l'API (vide si pas d'erreur). */
  sendError: string;

  // Coordonnées signataires
  selfName: string;
  selfEmail: string;
  counterpartyName: string;
  counterpartyEmail: string;
  onSelfNameChange: (v: string) => void;
  onSelfEmailChange: (v: string) => void;
  onCounterpartyNameChange: (v: string) => void;
  onCounterpartyEmailChange: (v: string) => void;

  onFieldClick: (field: Field) => void;
  onNumPagesLoaded: (n: number) => void;
  onBack: () => void;
  onSend: () => void;
  onReset: () => void;
}

/**
 * Étape 3 du wizard — l'émetteur signe ses propres champs, renseigne les
 * coordonnées des deux signataires, puis envoie le contrat. L'envoi persiste
 * l'enveloppe en base via le proxy (voir SignatureWizard.handleSend).
 */
export function SignStep(props: Props) {
  if (props.sent) {
    return <SentConfirmation
      counterpartyName={props.counterpartyName}
      counterpartyEmail={props.counterpartyEmail}
      onReset={props.onReset}
    />;
  }

  const { file, fields, signers, allSelfSigned, recipientFormValid, canSend, sending, sendError } = props;
  const selfFields = fields.filter((f) => f.signer === "self");
  const counterFields = fields.filter((f) => f.signer === "counterparty");
  const selfSigned = selfFields.filter((f) => !!f.value).length;
  const selfColor = signers.find((s) => s.role === "self")?.hex ?? "#4f46e5";
  const counterColor = signers.find((s) => s.role === "counterparty")?.hex ?? "#10b981";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <aside className="lg:col-span-1 space-y-4">
        <ProgressCard
          selfSigned={selfSigned}
          selfTotal={selfFields.length}
          counterTotal={counterFields.length}
          selfColor={selfColor}
          counterColor={counterColor}
        />

        <HintBox />

        {/* Formulaire coordonnées : visible uniquement quand l'émetteur a signé */}
        {allSelfSigned && (
          <RecipientForm
            selfName={props.selfName}
            selfEmail={props.selfEmail}
            counterpartyName={props.counterpartyName}
            counterpartyEmail={props.counterpartyEmail}
            onSelfNameChange={props.onSelfNameChange}
            onSelfEmailChange={props.onSelfEmailChange}
            onCounterpartyNameChange={props.onCounterpartyNameChange}
            onCounterpartyEmailChange={props.onCounterpartyEmailChange}
            isValid={recipientFormValid}
          />
        )}

        {sendError && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {sendError}
          </div>
        )}

        <button
          onClick={props.onSend}
          disabled={!canSend || sending}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Envoi en cours…" : "Envoyer au cocontractant"}
        </button>

        <button
          onClick={props.onBack}
          disabled={sending}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-40 transition-colors"
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
          onFieldClick={props.onFieldClick}
          onLoaded={props.onNumPagesLoaded}
        />
      </div>
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

/** Carte "Votre progression" + barres self/cocontractant. */
function ProgressCard({
  selfSigned, selfTotal, counterTotal, selfColor, counterColor,
}: {
  selfSigned: number;
  selfTotal: number;
  counterTotal: number;
  selfColor: string;
  counterColor: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Votre progression</p>
      <SignProgress title="Vos champs" done={selfSigned} total={selfTotal} color={selfColor} />
      <SignProgress
        title="Cocontractant"
        done={0}
        total={counterTotal}
        color={counterColor}
        muted
        hint="À signer après envoi"
      />
    </div>
  );
}

/** Hint guidé : explique le geste à faire à l'utilisateur. */
function HintBox() {
  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex gap-2">
      <AlertCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
      <p className="text-[11px] text-indigo-700 leading-relaxed">
        Cliquez sur vos champs colorés pour les signer. La date sera ajoutée
        automatiquement. Renseignez ensuite les coordonnées des signataires
        pour pouvoir envoyer.
      </p>
    </div>
  );
}

/** Mini-formulaire des coordonnées de l'émetteur + du cocontractant. */
function RecipientForm({
  selfName, selfEmail, counterpartyName, counterpartyEmail,
  onSelfNameChange, onSelfEmailChange, onCounterpartyNameChange, onCounterpartyEmailChange,
  isValid,
}: {
  selfName: string;
  selfEmail: string;
  counterpartyName: string;
  counterpartyEmail: string;
  onSelfNameChange: (v: string) => void;
  onSelfEmailChange: (v: string) => void;
  onCounterpartyNameChange: (v: string) => void;
  onCounterpartyEmailChange: (v: string) => void;
  isValid: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          Destinataires
        </p>
        {isValid && <span className="text-[10px] text-emerald-600 font-semibold">✓ prêt</span>}
      </div>

      <div className="space-y-1">
        <p className="text-[10px] text-gray-400 uppercase tracking-widest">Vous</p>
        <input
          value={selfName}
          onChange={(e) => onSelfNameChange(e.target.value)}
          placeholder="Votre nom"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs outline-none focus:bg-white focus:border-gray-300 transition"
        />
        <input
          value={selfEmail}
          onChange={(e) => onSelfEmailChange(e.target.value)}
          placeholder="votre@email.com"
          type="email"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs outline-none focus:bg-white focus:border-gray-300 transition"
        />
      </div>

      <div className="space-y-1 pt-1 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 uppercase tracking-widest">Cocontractant</p>
        <input
          value={counterpartyName}
          onChange={(e) => onCounterpartyNameChange(e.target.value)}
          placeholder="Son nom"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs outline-none focus:bg-white focus:border-gray-300 transition"
        />
        <input
          value={counterpartyEmail}
          onChange={(e) => onCounterpartyEmailChange(e.target.value)}
          placeholder="son@email.com"
          type="email"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs outline-none focus:bg-white focus:border-gray-300 transition"
        />
      </div>
    </div>
  );
}

/** Écran de confirmation après envoi réussi. */
function SentConfirmation({
  counterpartyName, counterpartyEmail, onReset,
}: {
  counterpartyName: string;
  counterpartyEmail: string;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5 text-center max-w-lg mx-auto">
      <div className="w-20 h-20 rounded-2xl bg-emerald-100 flex items-center justify-center">
        <MailPlus className="w-10 h-10 text-emerald-600 stroke-[1.5]" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-800">Enveloppe créée et envoyée</h3>
        <p className="text-sm text-gray-500 leading-relaxed">
          Le contrat a été enregistré et un email d'invitation à signer a été
          envoyé à{" "}
          <span className="font-semibold text-gray-700">{counterpartyName}</span>
          {" "}({counterpartyEmail}).
        </p>
      </div>
      <button
        onClick={onReset}
        className="px-5 py-2.5 text-sm font-semibold text-[#354F99] bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
      >
        Retour au tableau de bord
      </button>
    </div>
  );
}
