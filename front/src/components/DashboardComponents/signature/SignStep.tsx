import { ChevronLeft, Send, MailPlus, Loader2, AlertCircle, AtSign, UserRound, Pencil } from "lucide-react";
import { PdfViewer } from "./PdfViewer";
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
  /** Ouvre la modale de saisie du destinataire (la saisie ne vit plus ici). */
  onEditRecipient: () => void;

  onFieldClick: (field: Field) => void;
  onNumPagesLoaded: (n: number) => void;
  onBack: () => void;
  onSend: () => void;
  onReset: () => void;
}

/**
 * Étapes 2 et 3 du parcours visible — l'émetteur signe ses propres zones,
 * renseigne les coordonnées du cocontractant, puis envoie le contrat.
 *
 * Même organisation que l'étape de placement : repère d'étape sticky à gauche
 * (bandeau + titre, qui évoluent seuls : signature apposée → destinataire →
 * envoi), document à droite.
 *
 * Sur le document, les zones restant à signer sont mises en avant (overlay +
 * étiquette « Cliquez pour signer » qui rebondit) : utile si l'utilisateur a
 * fermé la modale de signature ouverte automatiquement à l'arrivée.
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
  const selfColor = signers.find((s) => s.role === "self")?.hex ?? "bg-blue-primary";
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
        <GuidePanel content={guide} accentHex={accentHex}>
          {/* Destinataire : saisi dans une modale, rappelé ici pour relecture */}
          {allSelfSigned && (
            <RecipientCard
              counterpartyName={props.counterpartyName}
              counterpartyEmail={props.counterpartyEmail}
              isValid={recipientFormValid}
              senderEmail={props.senderEmail}
              onEdit={props.onEditRecipient}
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
              {sending ? "Envoi en cours…" : "Envoyer"}
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
        <div className="bg-gray-50 rounded-xl px-4 pb-4">
          <PdfViewer
            file={file}
            fields={fields}
            signers={signers}
            mode="sign"
            initialPage={firstUnsignedSelf ? firstUnsignedSelf.page : "last"}
            spotlight={(f) => f.signer === "self" && !f.value}
            spotlightLabel="Cliquez pour signer"
            onFieldClick={props.onFieldClick}
            onLoaded={props.onNumPagesLoaded}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

/**
 * Rappel du destinataire choisi + rappel de l'expéditeur.
 *
 * La saisie elle-même se fait dans `RecipientModal` : ici on relit simplement
 * à qui part le contrat avant de cliquer sur envoyer, avec un accès direct
 * pour corriger. Tant que rien n'est renseigné, la carte devient le bouton qui
 * rouvre la modale (cas où l'utilisateur l'avait fermée).
 */
function RecipientCard({
  counterpartyName, counterpartyEmail, isValid, senderEmail, onEdit,
}: {
  counterpartyName: string;
  counterpartyEmail: string;
  isValid: boolean;
  senderEmail?: string;
  onEdit: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
          Envoyer à
        </p>
        {isValid && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-gray-700 transition-colors"
          >
            <Pencil className="w-3 h-3" /> Modifier
          </button>
        )}
      </div>

      {isValid ? (
        <div className="flex items-start gap-2">
          <UserRound className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{counterpartyName}</p>
            <p className="text-[11px] text-gray-500 break-all">{counterpartyEmail}</p>
          </div>
        </div>
      ) : (
        <button
          onClick={onEdit}
          className="w-full rounded-lg border border-dashed border-gray-300 px-3 py-2.5 text-xs font-semibold text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
        >
          Indiquer le destinataire
        </button>
      )}

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
