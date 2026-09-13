import { ChevronLeft, Send, MailPlus, Loader2, AlertCircle, MousePointerClick, CheckCircle2 } from "lucide-react";
import { PdfViewer } from "./PdfViewer";
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
 * Étape 3 du wizard — l'émetteur signe ses propres champs, renseigne les
 * coordonnées des deux signataires, puis envoie le contrat. L'envoi persiste
 * l'enveloppe en base via le proxy (voir SignatureWizard.handleSend).
 *
 * Toutes les consignes vivent dans la colonne de gauche : le document garde
 * toute la place, et ses zones à signer y sont mises en avant.
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
  const selfColor = signers.find((s) => s.role === "self")?.hex ?? "#4f46e5";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)] gap-6">
      <aside className="space-y-4 self-start lg:sticky lg:top-16">
        {/* Guidage : une consigne à la fois, selon l'avancement */}
        {!allSelfSigned && (
          <GuideCard hex={selfColor} icon={MousePointerClick} title="Signez le contrat">
            Cliquez sur <strong>votre zone de signature</strong>, en clair sur le document.
          </GuideCard>
        )}
        {allSelfSigned && !recipientFormValid && (
          <GuideCard hex="#059669" icon={CheckCircle2} title="Signé !">
            Renseignez maintenant le nom et l'e-mail du cocontractant, ci-dessous,
            pour lui envoyer le contrat.
          </GuideCard>
        )}
        {canSend && (
          <GuideCard hex="#059669" icon={Send} title="Tout est prêt">
            Cliquez sur « Envoyer ». Votre cocontractant recevra un e-mail pour signer à son tour.
          </GuideCard>
        )}

        {/* Formulaire coordonnées : visible uniquement quand l'émetteur a signé */}
        {allSelfSigned && (
          <RecipientForm
            counterpartyName={props.counterpartyName}
            counterpartyEmail={props.counterpartyEmail}
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

        {/* Retour et Envoyer sur une seule ligne */}
        <div className="flex items-center gap-2">
          <button
            onClick={props.onBack}
            disabled={sending}
            title="Revenir aux zones de signature"
            className="flex shrink-0 items-center gap-1 px-3 py-2.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Retour
          </button>
          <button
            onClick={props.onSend}
            disabled={!canSend || sending}
            className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="bg-gray-50 rounded-xl px-4 pb-4">
          <PdfViewer
            file={file}
            fields={fields}
            signers={signers}
            mode="sign"
            onFieldClick={props.onFieldClick}
            onLoaded={props.onNumPagesLoaded}
            startOnLastPage
            spotlight={(f) => f.signer === "self" && !f.value}
            spotlightLabel="Cliquez pour signer"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

/** Carte de consigne en tête de la colonne de gauche (même style que l'étape « Placer »). */
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

/** Mini-formulaire — uniquement les coordonnées du cocontractant. */
function RecipientForm({
  counterpartyName, counterpartyEmail,
  onCounterpartyNameChange, onCounterpartyEmailChange,
  isValid,
}: {
  counterpartyName: string;
  counterpartyEmail: string;
  onCounterpartyNameChange: (v: string) => void;
  onCounterpartyEmailChange: (v: string) => void;
  isValid: boolean;
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
