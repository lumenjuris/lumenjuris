import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  ChevronRight, ChevronLeft, CheckCircle2,
  Pencil, Calendar, Send, UploadCloud, Lock, Users, MailPlus,
  AlertCircle, Layers,
} from "lucide-react";
import { PdfViewer } from "./signature/PdfViewer";
import { SignatureModal } from "./signature/SignatureModal";
import type { Field, FieldType, Signer, SignerRole, WizardStep, CapturedSignature } from "./signature/types";
import { SIGNERS_DEFAULT } from "./signature/types";

// ─── Stepper ──────────────────────────────────────────────────────────────────

const STEPS: Array<{ id: WizardStep; label: string; desc: string }> = [
  { id: "prepare", label: "Préparer",  desc: "Document et signataires" },
  { id: "place",   label: "Placer",    desc: "Zones de signature" },
  { id: "sign",    label: "Signer",    desc: "Signer & envoyer" },
];

function Stepper({ current }: { current: WizardStep }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all shrink-0 ${
                  done   ? "bg-emerald-500 border-emerald-500 text-white"
                  : active ? "bg-white border-[#354F99] text-[#354F99] shadow-sm"
                  : "bg-white border-gray-200 text-gray-300"
                }`}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <div>
                  <p className={`text-xs font-bold ${done || active ? "text-gray-800" : "text-gray-400"}`}>
                    {s.label}
                  </p>
                  <p className="text-[10px] text-gray-400 leading-none">{s.desc}</p>
                </div>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-3 transition-colors ${done ? "bg-emerald-500" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function Signature() {
  const [step, setStep] = useState<WizardStep>("prepare");
  const [file, setFile] = useState<File | null>(null);
  const [signers, setSigners] = useState<Signer[]>(SIGNERS_DEFAULT);
  const [fields, setFields] = useState<Field[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [activeFieldType, setActiveFieldType] = useState<FieldType>("signature");
  const [activeSignerRole, setActiveSignerRole] = useState<SignerRole>("self");
  const [replicateAllPages, setReplicateAllPages] = useState(false);

  // Signatures capturées par signataire (réutilisées pour tous ses champs)
  const [capturedSigs, setCapturedSigs] = useState<Record<SignerRole, CapturedSignature | null>>({
    self: null, counterparty: null,
  });
  const [modalOpenFor, setModalOpenFor] = useState<{ field: Field; signer: Signer } | null>(null);
  const [sent, setSent] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: useCallback((files: File[]) => { if (files[0]) setFile(files[0]); }, []),
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
  });

  function updateSigner(role: SignerRole, patch: Partial<Signer>) {
    setSigners((prev) => prev.map((s) => s.role === role ? { ...s, ...patch } : s));
  }

  function addField(f: Omit<Field, "id">) {
    const id = "f_" + Math.random().toString(36).slice(2, 10);
    setFields((prev) => [...prev, { ...f, id }]);
  }

  function moveField(id: string, xPct: number, yPct: number) {
    setFields((prev) => prev.map((f) => f.id === id ? { ...f, xPct, yPct } : f));
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  function handleFieldClick(field: Field) {
    if (step !== "sign") return;
    if (field.signer !== "self") return;
    const signer = signers.find((s) => s.role === "self")!;
    if (field.type === "date") {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, "0");
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const yyyy = today.getFullYear();
      setFields((prev) => prev.map((f) => f.id === field.id ? { ...f, value: `${dd}/${mm}/${yyyy}` } : f));
      return;
    }
    const existing = capturedSigs.self;
    if (existing) {
      applyCapturedSignature(field, existing);
    } else {
      setModalOpenFor({ field, signer });
    }
  }

  function applyCapturedSignature(field: Field, sig: CapturedSignature) {
    setFields((prev) => prev.map((f) => {
      if (f.id === field.id) return { ...f, value: sig.dataUrl };
      // Auto-remplit les autres champs du même signataire/même type si vides
      if (f.signer === field.signer && f.type === field.type && !f.value) {
        return { ...f, value: sig.dataUrl };
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

  const canGoToPlace = !!file;
  const selfFields = fields.filter((f) => f.signer === "self");
  const counterFields = fields.filter((f) => f.signer === "counterparty");
  const canGoToSign = selfFields.length > 0;
  const allSelfSigned = selfFields.length > 0 && selfFields.every((f) => !!f.value);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Signature électronique</h1>
        <p className="text-sm text-gray-500 mt-1">
          Préparez, placez les zones de signature et envoyez à votre cocontractant.
        </p>
      </div>

      <Stepper current={step} />

      {/* ─── STEP 1 — Préparer ─────────────────────────────────────────────── */}
      {step === "prepare" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {!file ? (
              <div
                {...getRootProps()}
                className={`rounded-2xl border-2 border-dashed p-16 text-center cursor-pointer transition-all ${
                  isDragActive ? "border-[#354F99] bg-[#354F99]/5 scale-[1.01]"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/40"
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                    <UploadCloud className="w-7 h-7 text-gray-400 stroke-[1.5]" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-700">Glissez-déposez votre contrat PDF</p>
                    <p className="text-xs text-gray-400">ou cliquez pour parcourir</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
                    <Lock className="h-3 w-3" /> Document confidentiel
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{file.name}</p>
                      <p className="text-[11px] text-gray-400">
                        {(file.size / 1024).toFixed(0)} Ko {numPages > 0 && `· ${numPages} pages`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setFile(null); setFields([]); setNumPages(0); }}
                    className="text-xs text-gray-400 hover:text-red-500 underline underline-offset-2"
                  >
                    Changer
                  </button>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <PdfViewer
                    file={file}
                    fields={[]}
                    signers={signers}
                    mode="preview"
                    onLoaded={setNumPages}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Signataires */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-bold text-gray-800">Signataires</h3>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Chaque signataire est identifié par une couleur. Les champs placés à l'étape suivante
              reprennent cette couleur.
            </p>

            <div className="space-y-3">
              {signers.map((s) => (
                <div key={s.role} className="rounded-xl border border-gray-200 bg-white p-4 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.hex }} />
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      {s.role === "self" ? "Vous (émetteur)" : "Cocontractant"}
                    </p>
                  </div>
                  <input
                    value={s.name}
                    onChange={(e) => updateSigner(s.role, { name: e.target.value })}
                    placeholder="Nom complet"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:bg-white focus:border-gray-300 transition"
                  />
                  <input
                    value={s.email}
                    onChange={(e) => updateSigner(s.role, { email: e.target.value })}
                    placeholder={s.role === "self" ? "Votre email" : "Email du cocontractant"}
                    type="email"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:bg-white focus:border-gray-300 transition"
                  />
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-gray-100">
              <button
                onClick={() => setStep("place")}
                disabled={!canGoToPlace}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-[#354F99] text-white text-sm font-semibold rounded-xl hover:bg-[#1a2d5a] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                Suivant — Placer les signatures <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── STEP 2 — Placer ───────────────────────────────────────────────── */}
      {step === "place" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Assigner à</p>
              <div className="space-y-1.5">
                {signers.map((s) => (
                  <button
                    key={s.role}
                    onClick={() => setActiveSignerRole(s.role)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all ${
                      activeSignerRole === s.role
                        ? "border-gray-300 bg-gray-50 shadow-sm"
                        : "border-transparent hover:bg-gray-50"
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.hex }} />
                    <span className="text-xs font-semibold text-gray-700 truncate">
                      {s.role === "self" ? "Vous" : s.name || "Cocontractant"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Type de champ</p>
              <div className="space-y-1.5">
                <FieldTypeBtn icon={Pencil}   label="Signature" selected={activeFieldType === "signature"} onClick={() => setActiveFieldType("signature")} />
                <FieldTypeBtn icon={Layers}   label="Paraphe"   selected={activeFieldType === "initial"}   onClick={() => setActiveFieldType("initial")} />
                <FieldTypeBtn icon={Calendar} label="Date"      selected={activeFieldType === "date"}      onClick={() => setActiveFieldType("date")} />
              </div>

              {activeFieldType === "initial" && (
                <label className="flex items-start gap-2 pt-2 border-t border-gray-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={replicateAllPages}
                    onChange={(e) => setReplicateAllPages(e.target.checked)}
                    className="mt-0.5 w-3.5 h-3.5 rounded border-gray-300 text-[#354F99] focus:ring-[#354F99]/30"
                  />
                  <div>
                    <p className="text-xs font-semibold text-gray-700">Toutes les pages</p>
                    <p className="text-[10px] text-gray-400 leading-tight">Le paraphe sera dupliqué à la même position sur chaque page.</p>
                  </div>
                </label>
              )}
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-indigo-700 leading-relaxed">
                Cliquez sur le document pour déposer un champ. Vous pourrez le déplacer ensuite.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Récapitulatif</p>
              <div className="space-y-1">
                {signers.map((s) => {
                  const count = fields.filter((f) => f.signer === s.role).length;
                  return (
                    <div key={s.role} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.hex }} />
                        <span className="text-gray-600">{s.role === "self" ? "Vous" : "Cocontractant"}</span>
                      </div>
                      <span className="font-semibold text-gray-700">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="lg:col-span-3 bg-gray-50 rounded-xl p-4">
            <PdfViewer
              file={file}
              fields={fields}
              signers={signers}
              mode="place"
              activeFieldType={activeFieldType}
              activeSignerRole={activeSignerRole}
              replicateAllPages={replicateAllPages}
              onFieldAdd={addField}
              onFieldMove={moveField}
              onFieldRemove={removeField}
              onLoaded={setNumPages}
            />
          </div>

          <div className="lg:col-span-4 flex justify-between items-center pt-2">
            <button
              onClick={() => setStep("prepare")}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Précédent
            </button>
            <button
              onClick={() => setStep("sign")}
              disabled={!canGoToSign}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#354F99] text-white text-sm font-semibold rounded-xl hover:bg-[#1a2d5a] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              Suivant — Signer <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 3 — Signer & envoyer ─────────────────────────────────────── */}
      {step === "sign" && !sent && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Votre progression</p>
              <SignProgress
                title="Vos champs"
                done={selfFields.filter((f) => !!f.value).length}
                total={selfFields.length}
                color="#4f46e5"
              />
              <SignProgress
                title="Cocontractant"
                done={0}
                total={counterFields.length}
                color="#10b981"
                muted
                hint="À signer après envoi"
              />
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-indigo-700 leading-relaxed">
                Cliquez sur vos champs colorés (bleu) pour les signer. Les champs du cocontractant
                seront remplis après envoi.
              </p>
            </div>

            <button
              onClick={() => setSent(true)}
              disabled={!allSelfSigned}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              <Send className="w-4 h-4" /> Envoyer au cocontractant
            </button>

            <button
              onClick={() => setStep("place")}
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
              onFieldClick={handleFieldClick}
              onLoaded={setNumPages}
            />
          </div>
        </div>
      )}

      {/* ─── STEP 3 — Confirmation envoi ───────────────────────────────────── */}
      {step === "sign" && sent && (
        <div className="flex flex-col items-center justify-center py-20 gap-5 text-center max-w-lg mx-auto">
          <div className="w-20 h-20 rounded-2xl bg-emerald-100 flex items-center justify-center">
            <MailPlus className="w-10 h-10 text-emerald-600 stroke-[1.5]" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-gray-800">Document prêt à être envoyé</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Le contrat sera transmis à <span className="font-semibold text-gray-700">{signers[1].email || signers[1].name}</span>
              {" "}pour signature. Vous serez notifié dès qu'il aura signé.
            </p>
            <p className="text-[11px] text-gray-400 italic mt-3">
              (Envoi simulé — la fonctionnalité d'envoi par email sera activée prochainement.)
            </p>
          </div>
          <button
            onClick={() => {
              setSent(false); setStep("prepare"); setFile(null);
              setFields([]); setCapturedSigs({ self: null, counterparty: null });
            }}
            className="px-5 py-2.5 text-sm font-semibold text-[#354F99] bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Nouveau contrat
          </button>
        </div>
      )}

      {/* Modale de signature */}
      {modalOpenFor && (
        <SignatureModal
          open={true}
          signerName={modalOpenFor.signer.name || "Vous"}
          signerHex={modalOpenFor.signer.hex}
          initialSignature={capturedSigs[modalOpenFor.field.signer]}
          onClose={() => setModalOpenFor(null)}
          onConfirm={handleModalConfirm}
        />
      )}
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function FieldTypeBtn({ icon: Icon, label, selected, onClick }: {
  icon: React.ElementType; label: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border-2 transition-all ${
        selected
          ? "border-[#354F99] bg-[#354F99]/5 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <Icon className={`w-3.5 h-3.5 ${selected ? "text-[#354F99]" : "text-gray-400"}`} />
      <span className={`text-xs font-semibold ${selected ? "text-[#354F99]" : "text-gray-700"}`}>
        {label}
      </span>
    </button>
  );
}

function SignProgress({ title, done, total, color, muted, hint }: {
  title: string; done: number; total: number; color: string; muted?: boolean; hint?: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={muted ? "text-gray-400" : "text-gray-700 font-medium"}>{title}</span>
        <span className={muted ? "text-gray-400" : "text-gray-700 font-semibold"}>{done}/{total}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: muted ? "#e5e7eb" : color }}
        />
      </div>
      {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}
