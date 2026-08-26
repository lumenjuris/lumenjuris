import { useState, useRef, useCallback } from "react";
import {
  UploadCloud, FileText, Loader2, ChevronLeft, ChevronRight, Check,
  Sparkles, AlertCircle, ShieldCheck, X,
} from "lucide-react";
import { contractApi } from "./api";
import { FIELD_LABEL } from "./types";
import type { ExtractedField } from "./types";
import { ConfirmationModal } from "../../ui/ConfirmationModal";

interface Props {
  onDone: () => void;
  onCancel: () => void;
}

type WizardStep = "upload" | "extract" | "review" | "done";

/** Un fichier en cours d'import + son extraction + sa revue. */
interface ImportItem {
  file: File;
  status: "pending" | "extracting" | "extracted" | "error";
  error?: string;
  fields: ExtractedField[];
  ocrText: string;
  title: string;
  // champs marqués validés par l'humain (clé → true)
  validated: Record<string, boolean>;
}

/**
 * Wizard d'import en 4 étapes. La revue humaine (étape 3) est OBLIGATOIRE :
 * aucune écriture en base avant que l'utilisateur ait confirmé.
 */
export function ImportWizard({ onDone, onCancel }: Props) {
  const [step, setStep] = useState<WizardStep>("upload");
  const [items, setItems] = useState<ImportItem[]>([]);
  const [active, setActive] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [existingContractTitle, setExistingContractTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Étape 1 : sélection des fichiers ──────────────────────────────────────
  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type === "application/pdf" || /\.(pdf|docx?|)$/i.test(f.name));
    if (!arr.length) return;
    setItems((prev) => [
      ...prev,
      ...arr.map((file) => ({ file, status: "pending" as const, fields: [], ocrText: "", title: file.name.replace(/\.[^.]+$/, ""), validated: {} })),
    ]);
  }, []);

  // ── Étape 2 : extraction IA séquentielle ──────────────────────────────────
  async function runExtraction() {
    // Vérifie si le contrat existe déjà avant de lancer l'analyse, demande à l'utilisateur si il souhaite tout de même continuer via une modale
    const existingContracts = await contractApi.list({pageSize: 1000});

      const duplicate = items.find((item) => 
        existingContracts.items.some(
          (c) => c.title.trim().toLowerCase() === item.title.trim().toLowerCase()
        )
      );

      if (duplicate && !duplicateModalOpen) {
        setExistingContractTitle(duplicate.title);
        setDuplicateModalOpen(true);
        setSaving(false);
        return;
      }
    setStep("extract");
    setError("");
    const next = [...items];
    for (let i = 0; i < next.length; i++) {
      next[i] = { ...next[i], status: "extracting" };
      setItems([...next]);
      try {
        const r = await contractApi.extract(next[i].file);
        next[i] = { ...next[i], status: "extracted", fields: r.fields, ocrText: r.ocr_text };
      } catch (e) {
        next[i] = { ...next[i], status: "error", error: e instanceof Error ? e.message : "Échec" };
      }
      setItems([...next]);
    }
    setActive(0);
    setStep("review");
  }

  // ── Étape 4 : persistance après revue ─────────────────────────────────────
  async function confirmAll() {
    setSaving(true);
    setError("");
    try {
      
      for (const it of items) {
        if (it.status === "error") continue;
        const fileBase64 = await fileToBase64(it.file);
        const metadataFields = it.fields.map((f) => ({
          fieldKey: f.field_key,
          value: f.value,
          confidenceScore: f.confidence_score,
          validationStatus: it.validated[f.field_key] ? ("HUMAN_VALIDATED" as const) : ("AI_SUGGESTED" as const),
        }));
        await contractApi.create({
          title: it.title,
          ocrText: it.ocrText,
          fileBase64,
          metadataFields,
          // colonnes structurées dérivées des champs validés
          ...deriveColumns(it.fields),
        });
      }
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <ConfirmationModal
          open={duplicateModalOpen}
          title="Contrat déjà existant"
          description={`Un contrat nommé "${existingContractTitle}" existe déjà dans votre contrathèque. Souhaitez-vous quand même l'enregistrer (doublon) ?`}
          confirmLabel="Enregistrer quand même"
          onConfirm={() => {
            setDuplicateModalOpen(false);
            void runExtraction();
          }}
          onCancel={() => {
            setDuplicateModalOpen(false);
          }}
        />
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Importer un contrat</h1>
          <p className="text-sm text-ink-muted mt-1">Upload → extraction IA → revue humaine → enregistrement.</p>
        </div>
        <button onClick={onCancel} className="shrink-0 p-1.5 rounded-lg text-ink-subtle hover:text-ink-secondary hover:bg-surface-muted transition-colors" title="Annuler">
          <X className="w-5 h-5" />
        </button>
      </div>

      <Stepper step={step} />

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger-dark bg-danger-light border border-danger/20 px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {step === "upload" && (
        <UploadStep
          items={items} fileRef={fileRef} onAdd={addFiles}
          onRemove={(i) => setItems((p) => p.filter((_, idx) => idx !== i))}
          onNext={runExtraction}
        />
      )}

      {step === "extract" && (
        <div className="bg-white rounded-card border border-line shadow-card p-8 space-y-3">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              {it.status === "extracted" ? <Check className="w-4 h-4 text-success" />
                : it.status === "error" ? <AlertCircle className="w-4 h-4 text-danger" />
                : <Loader2 className="w-4 h-4 animate-spin text-ink-subtle" />}
              <span className="text-ink-secondary truncate">{it.file.name}</span>
            </div>
          ))}
        </div>
      )}

      {step === "review" && items.length > 0 && (
        <ReviewStep
          items={items} active={active} setActive={setActive} saving={saving}
          onToggleValidate={(key) => setItems((prev) => prev.map((it, i) => i === active ? { ...it, validated: { ...it.validated, [key]: !it.validated[key] } } : it))}
          onEditField={(key, value) => setItems((prev) => prev.map((it, i) => i === active ? { ...it, fields: it.fields.map((f) => f.field_key === key ? { ...f, value } : f), validated: { ...it.validated, [key]: true } } : it))}
          onEditTitle={(title) => setItems((prev) => prev.map((it, i) => i === active ? { ...it, title } : it))}
          onConfirm={confirmAll}
        />
      )}

      {step === "done" && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="w-20 h-20 rounded-card bg-success-light flex items-center justify-center">
            <ShieldCheck className="w-10 h-10 text-success-dark stroke-[1.5]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-ink">{items.filter((i) => i.status !== "error").length} contrat(s) enregistré(s)</h3>
            <p className="text-sm text-ink-muted">Ils apparaissent maintenant dans votre contrathèque.</p>
          </div>
          <button onClick={onDone} className="px-5 py-2.5 text-sm font-semibold text-white bg-brand rounded-xl hover:bg-brand-hover transition-all shadow-card">
            Retour à la contrathèque
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Étape 1 ───
function UploadStep({
  items, fileRef, onAdd, onRemove, onNext,
}: {
  items: ImportItem[];
  fileRef: React.RefObject<HTMLInputElement>;
  onAdd: (f: FileList | File[]) => void;
  onRemove: (i: number) => void;
  onNext: () => void;
}) {
  const [drag, setDrag] = useState(false);

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); onAdd(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-card p-10 text-center cursor-pointer transition-all ${drag ? "border-brand bg-brand-light" : "border-line hover:border-brand/40 hover:bg-surface-subtle"}`}
      >
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" multiple className="hidden" onChange={(e) => { if (e.target.files) onAdd(e.target.files); e.target.value = ""; }} />
        <div className="w-14 h-14 mx-auto bg-white rounded-panel flex items-center justify-center text-brand shadow-card border border-line mb-3">
          <UploadCloud className="w-7 h-7 stroke-[1.5]" />
        </div>
        <p className="text-sm font-semibold text-ink">Glissez-déposez vos contrats (PDF / Word)</p>
        <p className="text-xs text-ink-subtle mt-1">Import en masse supporté — plusieurs fichiers à la fois.</p>
      </div>

      {items.length > 0 && (
        <div className="bg-white rounded-card border border-line shadow-card divide-y divide-line-subtle">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5">
              <FileText className="w-4 h-4 text-ink-subtle shrink-0" />
              <span className="flex-1 text-sm text-ink-secondary truncate">{it.file.name}</span>
              <button onClick={() => onRemove(i)} className="p-1 rounded-md text-ink-subtle hover:text-danger hover:bg-danger-light transition-all">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={items.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-hover disabled:opacity-40 transition-all shadow-card"
        >
          <Sparkles className="w-4 h-4" /> Lancer l'extraction IA <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Étape 3 ───
function ReviewStep({
  items, active, setActive, saving, onToggleValidate, onEditField, onEditTitle, onConfirm,
}: {
  items: ImportItem[];
  active: number;
  setActive: (i: number) => void;
  saving: boolean;
  onToggleValidate: (key: string) => void;
  onEditField: (key: string, value: string) => void;
  onEditTitle: (title: string) => void;
  onConfirm: () => void;
}) {
  const it = items[active];
  const allValidated = it.fields.every((f) => it.validated[f.field_key] || !f.value);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-info-dark bg-info-light border border-info/20 rounded-xl px-4 py-2.5">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        Revue obligatoire : validez (✓) ou corrigez chaque champ avant l'enregistrement.
      </div>

      {/* Navigation entre fichiers */}
      {items.length > 1 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setActive(Math.max(0, active - 1))} disabled={active === 0} className="p-1.5 rounded-lg border border-line disabled:opacity-30 hover:bg-surface-subtle transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-ink-muted">Document {active + 1} / {items.length}</span>
          <button onClick={() => setActive(Math.min(items.length - 1, active + 1))} disabled={active === items.length - 1} className="p-1.5 rounded-lg border border-line disabled:opacity-30 hover:bg-surface-subtle transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Aperçu texte du contrat */}
        <div className="bg-white rounded-card border border-line shadow-card p-5 overflow-y-auto" style={{ height: 560 }}>
          <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest mb-3">Aperçu du contrat</p>
          {it.ocrText ? (
            <pre className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed font-sans">{it.ocrText}</pre>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <FileText className="w-8 h-8 text-ink-placeholder" />
              <p className="text-sm text-ink-subtle">Aucun texte extrait.</p>
            </div>
          )}
        </div>

        {/* Champs */}
        <div className="space-y-2">
          {it.status === "error" ? (
            <div className="text-sm text-danger-dark bg-danger-light border border-danger/20 px-4 py-3 rounded-xl">{it.error}</div>
          ) : (
            <>
              <div className="bg-white rounded-panel border border-line shadow-card p-3">
                <label className="text-[10px] font-bold text-ink-subtle uppercase tracking-wide">Intitulé du contrat</label>
                <input value={it.title} onChange={(e) => onEditTitle(e.target.value)} className="w-full mt-1 text-sm px-2 py-1.5 rounded-md border border-line text-ink outline-none focus:border-brand/40 transition-all" />
              </div>
              {it.fields.map((f) => (
                <ReviewField key={f.field_key} field={f} validated={!!it.validated[f.field_key]} onToggle={() => onToggleValidate(f.field_key)} onEdit={(v) => onEditField(f.field_key, v)} />
              ))}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-subtle">{allValidated ? "Tous les champs sont validés ✓" : "Validez les champs restants"}</p>
        <button onClick={onConfirm} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-success text-white text-sm font-semibold rounded-xl hover:bg-success-dark disabled:opacity-40 transition-all shadow-card">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? "Enregistrement…" : `Enregistrer ${items.filter((i) => i.status !== "error").length} contrat(s)`}
        </button>
      </div>
    </div>
  );
}

function ReviewField({
  field, validated, onToggle, onEdit,
}: {
  field: ExtractedField;
  validated: boolean;
  onToggle: () => void;
  onEdit: (v: string) => void;
}) {
  const conf = field.confidence_score;
  return (
    <div className={`bg-white rounded-panel border shadow-card p-3 transition-colors ${validated ? "border-success/40" : "border-line"}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-ink-subtle uppercase tracking-wide">{FIELD_LABEL[field.field_key] ?? field.field_key}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-ink-subtle tabular-nums">{Math.round(conf * 100)}%</span>
          <button onClick={onToggle} className={`p-0.5 rounded transition-all ${validated ? "text-success bg-success-light" : "text-ink-subtle hover:text-success"}`} title="Valider">
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <input
        value={field.value ?? ""}
        onChange={(e) => onEdit(e.target.value)}
        placeholder="non détecté"
        className="w-full mt-1 text-sm px-2 py-1 rounded-md border border-line text-ink outline-none focus:border-brand/40 placeholder:text-ink-placeholder transition-all"
      />
      {!validated && (
        <div className="h-1 rounded-full bg-surface-muted overflow-hidden mt-2">
          <div className="h-full rounded-full" style={{ width: `${Math.round(conf * 100)}%`, backgroundColor: conf >= 0.8 ? "#059669" : conf >= 0.5 ? "#d97706" : "#dc2626" }} />
        </div>
      )}
    </div>
  );
}

// ─── Stepper ───
function Stepper({ step }: { step: WizardStep }) {
  const steps: Array<{ key: WizardStep; label: string }> = [
    { key: "upload", label: "Upload" },
    { key: "extract", label: "Extraction IA" },
    { key: "review", label: "Revue humaine" },
    { key: "done", label: "Confirmation" },
  ];
  const idx = steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${i <= idx ? "bg-brand text-white" : "bg-surface-muted text-ink-subtle"}`}>
            <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">{i + 1}</span>
            {s.label}
          </div>
          {i < steps.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-ink-placeholder" />}
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ───
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const res = r.result as string; resolve(res.split(",")[1] ?? res); };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** Dérive les colonnes structurées Contract depuis les champs extraits. */
function deriveColumns(fields: ExtractedField[]): Record<string, unknown> {
  const get = (k: string) => fields.find((f) => f.field_key === k)?.value ?? null;
  const renewalRaw = (get("renewal_type") ?? "").toLowerCase();
  return {
    contractType: get("contract_type"),
    counterpartyName: get("counterparty_name"),
    signatureDate: get("signature_date"),
    effectiveDate: get("effective_date"),
    endDate: get("end_date"),
    durationMonths: get("duration_months") ? Number(get("duration_months")) : null,
    noticePeriodDays: get("notice_period_days") ? Number(get("notice_period_days")) : null,
    governingLaw: get("governing_law"),
    isB2C: get("is_b2c") === "true" || get("is_b2c") === "oui",
    amount: get("amount") ? Number(String(get("amount")).replace(/[^\d.]/g, "")) : null,
    currency: get("currency") ?? "EUR",
    renewalType: renewalRaw.includes("tacit") ? "TACIT" : renewalRaw.includes("express") ? "EXPRESS" : "NONE",
    status: "ACTIVE",
  };
}
