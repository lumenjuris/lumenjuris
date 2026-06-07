import { useState } from "react";
import { Stepper } from "./Stepper";
import { PrepareStep } from "./PrepareStep";
import { PlaceStep } from "./PlaceStep";
import { SignStep } from "./SignStep";
import { SignatureModal } from "./SignatureModal";
import { fetchProxy } from "../../../utils/fetchProxy";
import type {
  Field, FieldType, Signer, SignerRole, WizardStep, CapturedSignature,
} from "./types";
import { SIGNERS_DEFAULT } from "./types";

interface Props {
  /** Callback appelé après l'envoi réussi de l'enveloppe au backend. */
  onSent?: () => void;
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
export function SignatureWizard({ onSent, onExit }: Props = {}) {
  // ─── État du wizard ──────────────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>("prepare");
  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [signers] = useState<Signer[]>(SIGNERS_DEFAULT);
  const [fields, setFields] = useState<Field[]>([]);

  // Toolbar étape 2 : signataire actif + type de champ armé (null = pas de placement)
  const [activeSignerRole, setActiveSignerRole] = useState<SignerRole>("self");
  const [armedFieldType, setArmedFieldType] = useState<FieldType | null>(null);
  const [replicateAllPages, setReplicateAllPages] = useState(false);

  // Étape 3 : signatures capturées + modale en cours
  const [capturedSigs, setCapturedSigs] = useState<Record<SignerRole, CapturedSignature | null>>({
    self: null, counterparty: null,
  });
  const [modalOpenFor, setModalOpenFor] = useState<{ field: Field; signer: Signer } | null>(null);
  const [sent, setSent] = useState(false);

  // Coordonnées des signataires (saisies à la fin avant envoi)
  const [selfName, setSelfName] = useState("");
  const [selfEmail, setSelfEmail] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [counterpartyEmail, setCounterpartyEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  // ─── Helpers de mutation ─────────────────────────────────────────────────

  /** Ajoute un champ et désarme automatiquement la toolbar (anti-multi-place). */
  function addField(f: Omit<Field, "id">) {
    const id = "f_" + Math.random().toString(36).slice(2, 10);
    setFields((prev) => [...prev, { ...f, id }]);
    setArmedFieldType(null);
  }

  function moveField(id: string, xPct: number, yPct: number) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, xPct, yPct } : f)));
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
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
    } else {
      setModalOpenFor({ field, signer });
    }
  }

  /**
   * Applique une signature capturée au champ cliqué + propage automatiquement
   * aux autres champs vides du même signataire/même type. La date du jour est
   * enregistrée dans `signedAt` pour affichage sous la signature.
   */
  function applyCapturedSignature(field: Field, sig: CapturedSignature) {
    const signedAt = new Date().toISOString();
    setFields((prev) => prev.map((f) => {
      if (f.id === field.id) return { ...f, value: sig.dataUrl, signedAt };
      const sameSignerSameType = f.signer === field.signer && f.type === field.type;
      if (sameSignerSameType && !f.value) {
        return { ...f, value: sig.dataUrl, signedAt };
      }
      return f;
    }));
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
    setArmedFieldType(null);
    setReplicateAllPages(false);
  }

  // ─── Calculs dérivés ─────────────────────────────────────────────────────

  const selfFields = fields.filter((f) => f.signer === "self");
  const canGoToSign = selfFields.length > 0;
  const allSelfSigned = selfFields.length > 0 && selfFields.every((f) => !!f.value);
  const recipientFormValid = isValidEmail(selfEmail) && isValidEmail(counterpartyEmail)
    && !!selfName.trim() && !!counterpartyName.trim();
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
      const res = await fetchProxy("/api/signature-envelope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          documentName: file.name,
          fileBase64,
          numPages,
          fields: { fields },
          selfName: selfName.trim(),
          selfEmail: selfEmail.trim(),
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
      onSent?.();
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setSending(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-6xl">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Signature électronique</h1>
        <p className="text-sm text-gray-500 mt-1">
          Préparez, placez les zones de signature et envoyez à votre cocontractant.
        </p>
      </header>

      <Stepper current={step} />

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
          onNumPagesLoaded={setNumPages}
          onBack={() => setStep("prepare")}
          onNext={() => setStep("sign")}
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
          selfName={selfName}
          selfEmail={selfEmail}
          counterpartyName={counterpartyName}
          counterpartyEmail={counterpartyEmail}
          onSelfNameChange={setSelfName}
          onSelfEmailChange={setSelfEmail}
          onCounterpartyNameChange={setCounterpartyName}
          onCounterpartyEmailChange={setCounterpartyEmail}
          onFieldClick={handleFieldClick}
          onNumPagesLoaded={setNumPages}
          onBack={() => setStep("place")}
          onSend={handleSend}
          onReset={() => { resetWizard(); onExit?.(); }}
        />
      )}

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

/** Validation très permissive d'un email (`x@y.z`). */
function isValidEmail(email: string): boolean {
  return /\S+@\S+\.\S+/.test(email.trim());
}
