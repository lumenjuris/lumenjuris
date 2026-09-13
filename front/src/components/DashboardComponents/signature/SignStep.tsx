import { ChevronLeft, Send, MailPlus, Loader2, AlertCircle, Clock, AtSign } from "lucide-react";
import { PdfViewer } from "./PdfViewer";
import { SignProgress } from "./SignProgress";
import { GuidePanel } from "./GuidePanel";
import { getGuideContent } from "./guide";
import type { GuidePhase } from "./guide";
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
  /**
   * E-mail du compte connecté : c'est lui qui figure comme expéditeur de la
   * procédure et qui reçoit la copie. Affiché pour lever tout doute sur
   * l'adresse utilisée.
   */
  senderEmail?: string;

  // Coordonnées signataires (uniquement cocontractant — l'émetteur reçoit en CC)
  counterpartyName: string;
  counterpartyEmail: string;
  onCounterpartyNameChange: (v: string) => void;
  onCounterpartyEmailChange: (v: string) => void;

  onFieldClick: (field: Field) => void;
  onNumPagesLoaded: (n: number) => void;
  onBack: () => void;
  onSend: () => void;
  onReset: () => void;
}

/**
 * Étape 2 du parcours visible — l'émetteur signe ses propres zones, renseigne
 * les coordonnées du cocontractant, puis envoie le contrat.
 *
 * Même organisation que l'étape de placement : guide contextuel sticky à
 * gauche (étape en cours → action attendue → étape suivante), document à
 * droite. Le guide évolue seul à chaque action : signature apposée →
 * coordonnées → envoi.
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

  // Phase du guidage : elle suit l'avancement réel de la signature et de l'envoi.
  const phase: GuidePhase = !allSelfSigned
    ? "sign-self"
    : !recipientFormValid
    ? "sign-recipient"
    : "sign-send";
  const guide = getGuideContent(phase);
  const accentHex =
    guide.signer === "counterparty" ? counterColor : guide.signer === "self" ? selfColor : "#059669";

  // On ouvre le document sur la zone que l'utilisateur doit signer.
  const firstUnsignedSelf = selfFields.find((f) => !f.value);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
      <aside className="lg:col-span-1 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
        <GuidePanel content={guide} accentHex={accentHex} documentName={file?.name}>
          <ProgressCard
            selfSigned={selfSigned}
            selfTotal={selfFields.length}
            counterTotal={counterFields.length}
            selfColor={selfColor}
            counterColor={counterColor}
          />

          {/* Formulaire coordonnées : visible uniquement quand l'émetteur a signé */}
          {allSelfSigned && (
            <RecipientForm
              counterpartyName={props.counterpartyName}
              counterpartyEmail={props.counterpartyEmail}
              onCounterpartyNameChange={props.onCounterpartyNameChange}
              onCounterpartyEmailChange={props.onCounterpartyEmailChange}
              isValid={recipientFormValid}
              senderEmail={props.senderEmail}
            />
          )}

          {sendError && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {sendError}
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={props.onSend}
              disabled={!canSend || sending}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? "Envoi en cours…" : "Faire signer et envoyer"}
            </button>

            <button
              onClick={props.onBack}
              disabled={sending}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Revenir aux zones de signature
            </button>
          </div>
        </GuidePanel>
      </aside>

      <div className="lg:col-span-3">
        <div className="bg-gray-50 rounded-xl p-4">
          <PdfViewer
            file={file}
            fields={fields}
            signers={signers}
            mode="sign"
            initialPage={firstUnsignedSelf ? firstUnsignedSelf.page : "last"}
            onFieldClick={props.onFieldClick}
            onLoaded={props.onNumPagesLoaded}
          />
        </div>
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
      <SignProgress title="Vous" done={selfSigned} total={selfTotal} color={selfColor} />
      {/* Le cocontractant ne signe pas ici : il recevra un email après l'envoi. */}
      <div className="flex items-start gap-2 rounded-lg bg-gray-50 px-2.5 py-2">
        <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: counterColor }} />
        <p className="text-[11px] leading-snug text-gray-500">
          <span className="font-semibold text-gray-700">Cocontractant</span>
          {counterTotal > 0 ? ` — ${counterTotal} zone${counterTotal > 1 ? "s" : ""} à signer.` : " — "}
          Il signera de son côté, après réception de l'e-mail.
        </p>
      </div>
    </div>
  );
}

/** Mini-formulaire — coordonnées du cocontractant + rappel de l'expéditeur. */
function RecipientForm({
  counterpartyName, counterpartyEmail,
  onCounterpartyNameChange, onCounterpartyEmailChange,
  isValid, senderEmail,
}: {
  counterpartyName: string;
  counterpartyEmail: string;
  onCounterpartyNameChange: (v: string) => void;
  onCounterpartyEmailChange: (v: string) => void;
  isValid: boolean;
  senderEmail?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          Envoyer à
        </p>
        {isValid && <span className="text-[10px] text-emerald-600 font-semibold">✓ prêt</span>}
      </div>
      <div className="space-y-1.5">
        <input
          value={counterpartyName}
          onChange={(e) => onCounterpartyNameChange(e.target.value)}
          placeholder="Nom du cocontractant"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs outline-none focus:bg-white focus:border-gray-300 transition"
        />
        <input
          value={counterpartyEmail}
          onChange={(e) => onCounterpartyEmailChange(e.target.value)}
          placeholder="email@cocontractant.com"
          type="email"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs outline-none focus:bg-white focus:border-gray-300 transition"
        />
      </div>

      {/* L'utilisateur voit noir sur blanc quelle adresse est utilisée. */}
      {senderEmail && (
        <div className="flex items-start gap-2 rounded-lg bg-gray-50 px-2.5 py-2">
          <AtSign className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-400" />
          <p className="text-[10px] leading-snug text-gray-500">
            Procédure envoyée au nom de votre compte{" "}
            <span className="font-semibold text-gray-700 break-all">{senderEmail}</span>. Vous
            recevez une copie de l'e-mail et les réponses du cocontractant vous parviennent
            directement.
          </p>
        </div>
      )}
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
        <p className="text-xs text-gray-400 leading-relaxed">
          Sans réponse de sa part, vous pourrez le relancer depuis la liste des contrats.
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
