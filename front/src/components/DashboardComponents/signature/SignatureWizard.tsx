import { useState } from "react";
import { FileText } from "lucide-react";
import { PrepareStep } from "./PrepareStep";
import { PlaceStep } from "./PlaceStep";
import { SignStep } from "./SignStep";
import { SignatureModal } from "./SignatureModal";
import { RecipientModal } from "./RecipientModal";
import { fetchProxy } from "../../../utils/fetchProxy";
import { useUserStore } from "../../../store/userStore";
import type {
  Field, FieldType, Signer, SignerRole, WizardStep, CapturedSignature,
} from "./types";
import { SIGNERS_DEFAULT, isValidEmail } from "./types";

interface Props {
  /** Fichier PDF déjà sélectionné (vient du file picker du dashboard). */
  initialFile?: File;
  /**
   * Callback appelé après l'envoi réussi de l'enveloppe au backend. Reçoit les
   * coordonnées du destinataire pour que le parent puisse confirmer l'envoi
   * (le wizard est démonté juste après).
   */
  onSent?: (recipient: { name: string; email: string }) => void;
  /** Callback "Annuler / Retour" pour fermer le wizard. */
  onExit?: () => void;
}

/** Lit un File en base64 (sans le préfixe data:). */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const res = r.result as string;
      resolve(res.split(",")[1] ?? res);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/**
 * Wizard de création d'une enveloppe de signature (3 étapes).
 *
 * Au moment de l'envoi, persiste l'enveloppe en DB via le proxy puis appelle
 * `onSent` pour notifier le parent (qui revient au dashboard).
 *
 * Voir signature/README.md pour le détail du workflow.
 */
export function SignatureWizard({ initialFile, onSent, onExit }: Props = {}) {
  // ─── État du wizard ──────────────────────────────────────────────────────
  // Si un fichier est déjà fourni (vient du file picker), on saute l'étape 1
  const [step, setStep] = useState<WizardStep>(initialFile ? "place" : "prepare");
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [numPages, setNumPages] = useState(0);
  const [signers] = useState<Signer[]>(SIGNERS_DEFAULT);
  const [fields, setFields] = useState<Field[]>([]);

  // Toolbar étape 2 : signataire actif + type de champ armé (null = pas de placement)
  const [activeSignerRole, setActiveSignerRole] = useState<SignerRole>("self");
  // Toujours armé sur "signature" — le placement est actif dès l'étape 2
  const [armedFieldType, setArmedFieldType] = useState<FieldType | null>("signature");
  const [replicateAllPages, setReplicateAllPages] = useState(false);

  // Étape 3 : signatures capturées + modale en cours
  const [capturedSigs, setCapturedSigs] = useState<Record<SignerRole, CapturedSignature | null>>({
    self: null, counterparty: null,
  });
  const [modalOpenFor, setModalOpenFor] = useState<{ field: Field; signer: Signer } | null>(null);
  // Modale « À qui envoyer ? », ouverte dès que l'émetteur a signé.
  const [recipientModalOpen, setRecipientModalOpen] = useState(false);
  const [sent, setSent] = useState(false);

  // Coordonnées du cocontractant (l'émetteur reçoit le contrat en CC via son compte)
  const [counterpartyName, setCounterpartyName] = useState("");
  const [counterpartyEmail, setCounterpartyEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  // E-mail du compte connecté : c'est cette adresse (celle du créateur du
  // compte, pas une adresse d'administration) qui porte la procédure côté
  // serveur. On l'affiche à l'utilisateur avant l'envoi.
  const senderEmail = useUserStore((state) => state.userData?.profile.email);

  // ─── Helpers de mutation ─────────────────────────────────────────────────

  /** Ajoute un champ — reste armé sur "signature" pour permettre de placer plusieurs champs. */
  function addField(f: Omit<Field, "id">) {
    const id = "f_" + Math.random().toString(36).slice(2, 10);
    setFields((prev) => {
      const next = [...prev, { ...f, id }];
      // Guidage naturel : dès que VOTRE zone est posée et qu'aucune zone
      // cocontractant n'existe, on bascule automatiquement sur « Cocontractant »
      // — l'utilisateur enchaîne sans avoir à comprendre le sélecteur.
      if (f.signer === "self" && !next.some((x) => x.signer === "counterparty")) {
        setActiveSignerRole("counterparty");
      }
      return next;
    });
    // On reste armé : l'utilisateur peut placer autant de champs qu'il veut
    setArmedFieldType("signature");
  }

  function moveField(id: string, xPct: number, yPct: number) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, xPct, yPct } : f)));
  }

  /**
   * Supprime une zone et rebascule le signataire actif sur celui dont la zone
   * vient d'être retirée : après une suppression, le geste suivant est presque
   * toujours d'en reposer une pour cette même partie (on la replace ailleurs).
   * La checklist et le guide de gauche suivent automatiquement.
   */
  function removeField(id: string) {
    const removed = fields.find((f) => f.id === id);
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (removed) setActiveSignerRole(removed.signer);
  }

  /**
   * Clic sur un champ en étape "Signer" :
   * - si le champ n'appartient pas à "self", on ignore (le cocontractant signera plus tard)
   * - si on a déjà une signature capturée pour ce signataire, on l'applique directement
   * - sinon on ouvre la modale de création de signature
   */
  function handleFieldClick(field: Field) {
    if (field.signer !== "self") return;
    const signer = signers.find((s) => s.role === "self")!;
    const existing = capturedSigs.self;
    if (existing) {
      applyCapturedSignature(field, existing);
    }
     else {
      setModalOpenFor({ field, signer });
    } 
  }

  /**
   * Passage à l'étape « Signer et envoyer ».
   *
   * Une fois les zones placées, la seule action attendue est d'apposer sa
   * signature : on ouvre donc directement la modale de saisie sur la première
   * zone non signée, sans demander à l'utilisateur de cliquer d'abord dessus.
   * S'il ferme la modale, le clic sur la zone reste évidemment possible.
   */
  function goToSignStep() {
    setStep("sign");
    const firstUnsignedSelfField = fields.find((f) => f.signer === "self" && !f.value);
    if (!firstUnsignedSelfField) return;
    const selfSigner = signers.find((s) => s.role === "self")!;
    setModalOpenFor({ field: firstUnsignedSelfField, signer: selfSigner });
  }

  /**
   * Applique une signature capturée au champ cliqué + propage automatiquement
   * aux autres champs vides du même signataire/même type. La date du jour est
   * enregistrée dans `signedAt` pour affichage sous la signature.
   */
  function applyCapturedSignature(field: Field, sig: CapturedSignature) {
    const signedAt = new Date().toISOString();
    const next = fields.map((f) => {
      if (f.id === field.id) return { ...f, value: sig.dataUrl, signedAt };
      const sameSignerSameType = f.signer === field.signer && f.type === field.type;
      if (sameSignerSameType && !f.value) {
        return { ...f, value: sig.dataUrl, signedAt };
      }
      return f;
    });
    setFields(next);

    // L'émetteur vient de finir de signer : la seule information encore
    // manquante est le destinataire. On la demande tout de suite, au centre de
    // l'écran, plutôt que de laisser l'utilisateur chercher un formulaire.
    const selfDone = next.filter((f) => f.signer === "self").every((f) => !!f.value);
    if (selfDone && !isRecipientFilled(counterpartyName, counterpartyEmail)) {
      setRecipientModalOpen(true);
    }
  }

  /** Enregistre le destinataire saisi dans la modale et referme celle-ci. */
  function handleRecipientConfirm(recipient: { name: string; email: string }) {
    setCounterpartyName(recipient.name);
    setCounterpartyEmail(recipient.email);
    setRecipientModalOpen(false);
  }

  function handleModalConfirm(sig: CapturedSignature) {
    if (!modalOpenFor) return;
    setCapturedSigs((p) => ({ ...p, [modalOpenFor.field.signer]: sig }));
    applyCapturedSignature(modalOpenFor.field, sig);
    setModalOpenFor(null);
  }

  /** Réinitialise tout pour préparer un nouveau contrat. */
  function resetWizard() {
    setSent(false);
    setStep("prepare");
    setFile(null);
    setFields([]);
    setNumPages(0);
    setCapturedSigs({ self: null, counterparty: null });
    setArmedFieldType("signature");
    setReplicateAllPages(false);
    setRecipientModalOpen(false);
  }

  // ─── Calculs dérivés ─────────────────────────────────────────────────────

  const selfFields = fields.filter((f) => f.signer === "self");
  const canGoToSign = selfFields.length > 0;
  const allSelfSigned = selfFields.length > 0 && selfFields.every((f) => !!f.value);
  const recipientFormValid = isRecipientFilled(counterpartyName, counterpartyEmail);
  const canSend = allSelfSigned && recipientFormValid;

  /**
   * Envoi de l'enveloppe : persiste le PDF + champs + métadonnées via le proxy
   * (POST /api/signature-envelope). En cas de succès, on bascule sur l'écran
   * de confirmation et on notifie le parent.
   */
  async function handleSend() {
    if (!file || !canSend) return;
    setSending(true);
    setSendError("");
    try {
      const fileBase64 = await fileToBase64(file);

      // Si aucun champ cocontractant n'a été placé, on en ajoute un automatiquement
      // en bas de la dernière page (position standard pour une signature de fin).
      let fieldsToSend = fields;
      const hasCounterpartyField = fields.some((f) => f.signer === "counterparty");
      if (!hasCounterpartyField) {
        const lastPage = Math.max(0, numPages - 1);
        fieldsToSend = [
          ...fields,
          {
            id: "auto_counter_sig",
            type: "signature" as const,
            signer: "counterparty" as const,
            page: lastPage,
            xPct: 0.55,
            yPct: 0.82,
            widthPct: 0.35,
            heightPct: 0.07,
          },
        ];
      }

      const res = await fetchProxy("/api/signature-envelope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          documentName: file.name,
          fileBase64,
          numPages,
          fields: { fields: fieldsToSend },
          counterpartyName: counterpartyName.trim(),
          counterpartyEmail: counterpartyEmail.trim(),
          selfSigned: true,
        }),
      });
      const data = await res.json() as { success?: boolean; message?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Échec de l'envoi");
      }
      setSent(true);
      onSent?.({ name: counterpartyName.trim(), email: counterpartyEmail.trim() });
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setSending(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 max-w-6xl">
      {/* En-tête volontairement compact : la priorité de l'écran est le
          document et l'action en cours, pas le titre de la page. Le repère
          « Étape X sur N » vit en haut de la colonne de gauche — un second
          indicateur d'étapes ici afficherait une numérotation concurrente. */}
      <header className="flex items-center gap-2 min-w-0">
        <h1 className="text-lg font-bold text-gray-900 tracking-tight shrink-0">
          Signature électronique
        </h1>
        {file && (
          <>
            <span className="text-gray-300">·</span>
            <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-xs text-gray-500 truncate">{file.name}</span>
          </>
        )}
      </header>

      {step === "prepare" && (
        <PrepareStep
          onFileChange={(f) => {
            setFile(f);
            // Dès qu'un PDF est déposé, on passe directement à l'étape de
            // placement — l'utilisateur n'a pas à valider explicitement.
            if (f) setStep("place");
          }}
        />
      )}

      {step === "place" && (
        <PlaceStep
          file={file}
          fields={fields}
          signers={signers}
          activeSignerRole={activeSignerRole}
          armedFieldType={armedFieldType}
          replicateAllPages={replicateAllPages}
          onSignerChange={setActiveSignerRole}
          onArmFieldType={setArmedFieldType}
          onReplicateAllPagesChange={setReplicateAllPages}
          onFieldAdd={addField}
          onFieldMove={moveField}
          onFieldRemove={removeField}
          onNumPagesLoaded={(n) => {
            setNumPages(n);
            // Première ouverture : les deux zones sont suggérées d'emblée en bas
            // de la dernière page (où l'on signe habituellement) — il ne reste
            // qu'à les glisser si besoin. Jamais si des zones existent déjà.
            const last = Math.max(0, n - 1);
            setFields((prev) => (prev.length > 0 ? prev : [
              { id: "sugg_self", type: "signature", signer: "self", page: last, xPct: 0.08, yPct: 0.8, widthPct: 0.3, heightPct: 0.07 },
              { id: "sugg_counter", type: "signature", signer: "counterparty", page: last, xPct: 0.58, yPct: 0.8, widthPct: 0.3, heightPct: 0.07 },
            ]));
          }}
          onBack={() => setStep("prepare")}
          onNext={goToSignStep}
          canGoNext={canGoToSign}
        />
      )}

      {step === "sign" && (
        <SignStep
          file={file}
          fields={fields}
          signers={signers}
          sent={sent}
          allSelfSigned={allSelfSigned}
          recipientFormValid={recipientFormValid}
          canSend={canSend}
          sending={sending}
          sendError={sendError}
          senderEmail={senderEmail}
          counterpartyName={counterpartyName}
          counterpartyEmail={counterpartyEmail}
          onEditRecipient={() => setRecipientModalOpen(true)}
          onFieldClick={handleFieldClick}
          onNumPagesLoaded={setNumPages}
          onBack={() => setStep("place")}
          onSend={handleSend}
          onReset={() => { resetWizard(); onExit?.(); }}
        />
      )}

      <RecipientModal
        open={recipientModalOpen}
        name={counterpartyName}
        email={counterpartyEmail}
        accentHex={signers.find((s) => s.role === "counterparty")?.hex ?? "#10b981"}
        senderEmail={senderEmail}
        onClose={() => setRecipientModalOpen(false)}
        onConfirm={handleRecipientConfirm}
      />

      {modalOpenFor && (
        <SignatureModal
          open={true}
          signerName={modalOpenFor.signer.name}
          signerHex={modalOpenFor.signer.hex}
          initialSignature={capturedSigs[modalOpenFor.field.signer]}
          onClose={() => setModalOpenFor(null)}
          onConfirm={handleModalConfirm}
        />
      )}
    </div>
  );
}

/** Vrai quand le destinataire est renseigné et son e-mail plausible. */
function isRecipientFilled(name: string, email: string): boolean {
  return !!name.trim() && isValidEmail(email);
}
