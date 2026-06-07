import { useState } from "react";
import { Stepper } from "./signature/Stepper";
import { PrepareStep } from "./signature/PrepareStep";
import { PlaceStep } from "./signature/PlaceStep";
import { SignStep } from "./signature/SignStep";
import { SignatureModal } from "./signature/SignatureModal";
import type {
  Field, FieldType, Signer, SignerRole, WizardStep, CapturedSignature,
} from "./signature/types";
import { SIGNERS_DEFAULT } from "./signature/types";

/**
 * Module de signature électronique d'un contrat (CLM).
 *
 * Wizard en 3 étapes :
 *  1. Préparer  → upload du PDF
 *  2. Placer    → drag & drop de zones (signature / paraphe) sur le PDF
 *  3. Signer    → l'émetteur signe ses champs puis envoie au cocontractant
 *
 * Voir signature/README.md pour le détail du workflow et les choix de design.
 */
export function Signature() {
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
          file={file}
          numPages={numPages}
          signers={signers}
          onFileChange={(f) => { setFile(f); if (!f) { setFields([]); setNumPages(0); } }}
          onNumPagesLoaded={setNumPages}
          onNext={() => setStep("place")}
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
          onFieldClick={handleFieldClick}
          onNumPagesLoaded={setNumPages}
          onBack={() => setStep("place")}
          onSend={() => setSent(true)}
          onReset={resetWizard}
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
