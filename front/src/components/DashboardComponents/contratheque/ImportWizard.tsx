import { useState, useRef, useEffect } from "react";
import {
  FileText, Loader2, ChevronLeft, ChevronRight, Check,
  AlertCircle, ShieldCheck, X, Sparkles, RotateCw,
} from "lucide-react";
import { contractApi } from "./api";
import { FIELD_LABEL } from "./types";
import type { ExtractedField } from "./types";
import { ConfirmationModal } from "../../ui/ConfirmationModal";

interface Props {
  /** Fichiers déjà choisis par l'utilisateur ; la lecture démarre dessus. */
  files: File[];
  onDone: () => void;
  onCancel: () => void;
}

type WizardStep = "reading" | "review" | "done";

/**
 * Un fichier en cours d'import. L'import se fait en deux temps, d'où deux
 * statuts distincts : le texte arrive vite et débloque la revue, l'analyse IA
 * arrive après et vient remplir les champs.
 */
interface ImportItem {
  file: File;
  //Lecture du texte du document (PyMuPDF / Word) — rapide/
  textStatus: "waiting" | "loading" | "ready" | "error";
  // Analyse IA des métadonnées — lente, jouée en tâche de fond.
  aiStatus: "waiting" | "running" | "ready" | "error";
  /** Message de l'étape qui a échoué. */
  error?: string;
  fields: ExtractedField[];
  ocrText: string;
  title: string;
  // champs marqués validés par l'humain (clé → true)
  validated: Record<string, boolean>;
}

/**
 * Wizard d'import. Les fichiers sont déjà choisis quand on arrive ici (la
 * fenêtre système s'ouvre depuis le bouton « Importer » de la contrathèque).
 *
 * Déroulé, pensé pour ne jamais laisser l'utilisateur devant un écran vide :
 *   1. lecture du texte (quelques centaines de ms) → la revue s'ouvre aussitôt,
 *      l'utilisateur peut déjà lire le contrat et corriger l'intitulé ;
 *   2. analyse IA en tâche de fond → les champs se remplissent à leur arrivée.
 *
 * La revue humaine reste OBLIGATOIRE : aucune écriture en base avant
 * confirmation, et l'enregistrement est bloqué tant que l'IA n'a pas répondu.
 */
export function ImportWizard({ files, onDone, onCancel }: Props) {
  const [step, setStep] = useState<WizardStep>("reading");
  const [items, setItems] = useState<ImportItem[]>(() => toImportItems(files));
  const [active, setActive] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [existingContractTitle, setExistingContractTitle] = useState("");
  // Évite de lancer l'import deux fois (React StrictMode monte le composant
  // deux fois en développement).
  const importStarted = useRef(false);

  useEffect(() => {
    if (importStarted.current) return;
    importStarted.current = true;
    void startImport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Modifie un seul item sans écraser ce que l'utilisateur est en train d'éditer. */
  function patchItem(index: number, patch: Partial<ImportItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  // ── Démarrage ─────────────────────────────────────────────────────────────
  // Lecture du texte et contrôle de doublon partent ensemble : le contrôle ne
  // doit pas retarder l'affichage de l'aperçu.
  async function startImport() {
    const [read, duplicateTitle] = await Promise.all([
      readAllTexts(items),
      findDuplicateTitle(items),
    ]);
    setItems(read);

    if (duplicateTitle) {
      setExistingContractTitle(duplicateTitle);
      setDuplicateModalOpen(true);
      return;
    }
    enterReview(read);
  }

  /** Ouvre la revue et lance l'analyse IA derrière, sans l'attendre. */
  function enterReview(list: ImportItem[]) {
    setActive(0);
    setStep("review");
    void runAiAnalysis(list);
  }

  // ── Étape 1 : lecture du texte (rapide) ───────────────────────────────────
  async function readAllTexts(list: ImportItem[]): Promise<ImportItem[]> {
    const next = [...list];
    for (let i = 0; i < next.length; i++) {
      next[i] = { ...next[i], textStatus: "loading" };
      setItems([...next]);
      try {
        const r = await contractApi.extractText(next[i].file);
        next[i] = { ...next[i], textStatus: "ready", ocrText: r.ocr_text };
      } catch (e) {
        next[i] = { ...next[i], textStatus: "error", aiStatus: "error", error: messageErreur(e) };
      }
      setItems([...next]);
    }
    return next;
  }

  /** Titre déjà présent dans la contrathèque, ou null. */
  async function findDuplicateTitle(list: ImportItem[]): Promise<string | null> {
    // En cas d'erreur réseau on continue sans le contrôle : mieux vaut un
    // doublon possible qu'un import bloqué.
    try {
      const existing = await contractApi.list({ pageSize: 1000 });
      const duplicate = list.find((item) =>
        existing.items.some(
          (c) => c.title.trim().toLowerCase() === item.title.trim().toLowerCase()
        )
      );
      return duplicate ? duplicate.title : null;
    } catch (err) {
      console.error("Vérification des doublons impossible, import poursuivi :", err);
      return null;
    }
  }

  // ── Étape 2 : analyse IA en tâche de fond ─────────────────────────────────
  async function runAiAnalysis(list: ImportItem[]) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].textStatus !== "ready") continue;
      await analyseOne(i, list[i].ocrText);
    }
  }

  async function analyseOne(index: number, ocrText: string) {
    patchItem(index, { aiStatus: "running", error: undefined });
    try {
      const fields = await contractApi.extractMetadata(ocrText);
      patchItem(index, { aiStatus: "ready", fields });
    } catch (e) {
      patchItem(index, { aiStatus: "error", error: messageErreur(e) });
    }
  }

  // ── Étape 3 : persistance après revue ─────────────────────────────────────
  async function confirmAll() {
    setSaving(true);
    setError("");
    try {
      for (const it of items) {
        if (it.textStatus === "error") continue;
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

  // Enregistrement bloqué tant qu'une analyse IA est encore en vol : les champs
  // ne sont pas connus, il n'y a donc rien à revoir.
  const analyseEnCours = items.some(
    (it) => it.textStatus !== "error" && (it.aiStatus === "waiting" || it.aiStatus === "running"),
  );

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
            enterReview(items);
          }}
          onCancel={() => {
            setDuplicateModalOpen(false);
            onCancel();
          }}
        />
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Importer un contrat</h1>
          <p className="text-sm text-ink-muted mt-1">Lecture du document → revue humaine → enregistrement.</p>
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

      {step === "reading" && (
        <div className="bg-white rounded-card border border-line shadow-card p-8 space-y-3">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              {it.textStatus === "ready" ? <Check className="w-4 h-4 text-success" />
                : it.textStatus === "error" ? <AlertCircle className="w-4 h-4 text-danger" />
                : <Loader2 className="w-4 h-4 animate-spin text-ink-subtle" />}
              <span className="text-ink-secondary truncate">{it.file.name}</span>
            </div>
          ))}
        </div>
      )}

      {step === "review" && items.length > 0 && (
        <ReviewStep
          items={items} active={active} setActive={setActive} saving={saving}
          analyseEnCours={analyseEnCours}
          onRetryAi={() => void analyseOne(active, items[active].ocrText)}
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
            <h3 className="text-lg font-bold text-ink">{items.filter((i) => i.textStatus !== "error").length} contrat(s) enregistré(s)</h3>
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


// ─── Revue humaine ───
function ReviewStep({
  items, active, setActive, saving, analyseEnCours, onRetryAi,
  onToggleValidate, onEditField, onEditTitle, onConfirm,
}: {
  items: ImportItem[];
  active: number;
  setActive: (i: number) => void;
  saving: boolean;
  analyseEnCours: boolean;
  onRetryAi: () => void;
  onToggleValidate: (key: string) => void;
  onEditField: (key: string, value: string) => void;
  onEditTitle: (title: string) => void;
  onConfirm: () => void;
}) {
  const it = items[active];
  const iaEnCours = it.aiStatus === "waiting" || it.aiStatus === "running";
  const allValidated = it.fields.every((f) => it.validated[f.field_key] || !f.value);

  return (
    <div className="space-y-4">
      {iaEnCours ? (
        <div className="flex items-center gap-2 text-xs text-info-dark bg-info-light border border-info/20 rounded-xl px-4 py-2.5">
          <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
          Analyse IA en cours — vous pouvez déjà lire le contrat et corriger l'intitulé, les champs se rempliront tout seuls.
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-info-dark bg-info-light border border-info/20 rounded-xl px-4 py-2.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Revue obligatoire : validez (✓) ou corrigez chaque champ avant l'enregistrement.
        </div>
      )}

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
        {/* Aperçu texte du contrat — disponible dès la lecture, sans attendre l'IA */}
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
          {it.textStatus === "error" ? (
            <div className="text-sm text-danger-dark bg-danger-light border border-danger/20 px-4 py-3 rounded-xl">{it.error}</div>
          ) : (
            <>
              <div className="bg-white rounded-panel border border-line shadow-card p-3">
                <label className="text-[10px] font-bold text-ink-subtle uppercase tracking-wide">Intitulé du contrat</label>
                <input value={it.title} onChange={(e) => onEditTitle(e.target.value)} className="w-full mt-1 text-sm px-2 py-1.5 rounded-md border border-line text-ink outline-none focus:border-brand/40 transition-all" />
              </div>

              {iaEnCours && <PendingFields />}

              {it.aiStatus === "error" && (
                <div className="bg-white rounded-panel border border-danger/30 shadow-card p-4 space-y-3">
                  <div className="flex items-start gap-2 text-sm text-danger-dark">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{it.error ?? "L'analyse IA a échoué."}</span>
                  </div>
                  <button onClick={onRetryAi} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-ink-secondary border border-line rounded-xl hover:bg-surface-subtle transition-all">
                    <RotateCw className="w-4 h-4" /> Relancer l'analyse
                  </button>
                </div>
              )}

              {it.aiStatus === "ready" && it.fields.map((f) => (
                <ReviewField key={f.field_key} field={f} validated={!!it.validated[f.field_key]} onToggle={() => onToggleValidate(f.field_key)} onEdit={(v) => onEditField(f.field_key, v)} />
              ))}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-subtle">
          {analyseEnCours ? "Analyse IA en cours…" : allValidated ? "Tous les champs sont validés ✓" : "Validez les champs restants"}
        </p>
        <button onClick={onConfirm} disabled={saving || analyseEnCours} className="flex items-center gap-2 px-5 py-2.5 bg-success text-white text-sm font-semibold rounded-xl hover:bg-success-dark disabled:opacity-40 transition-all shadow-card">
          {saving || analyseEnCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? "Enregistrement…"
            : analyseEnCours ? "Analyse IA en cours…"
            : `Enregistrer ${items.filter((i) => i.textStatus !== "error").length} contrat(s)`}
        </button>
      </div>
    </div>
  );
}

/**
 * Champs annoncés mais pas encore remplis, le temps de l'analyse IA. On affiche
 * les vrais libellés : l'utilisateur voit ce qui arrive plutôt qu'un écran vide.
 */
function PendingFields() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-brand px-1">
        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
        Extraction des métadonnées…
      </div>
      {Object.entries(FIELD_LABEL).map(([key, label]) => (
        <div key={key} className="bg-white rounded-panel border border-line shadow-card p-3 animate-pulse">
          <span className="text-[10px] font-bold text-ink-placeholder uppercase tracking-wide">{label}</span>
          <div className="h-7 mt-1 rounded-md bg-surface-muted" />
        </div>
      ))}
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
    { key: "reading", label: "Lecture du document" },
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
/** Transforme les fichiers choisis en lignes d'import (titre = nom du fichier). */
function toImportItems(files: File[]): ImportItem[] {
  return files.map((file) => ({
    file,
    textStatus: "waiting",
    aiStatus: "waiting",
    fields: [],
    ocrText: "",
    title: file.name.replace(/[.][^.]+$/, ""),
    validated: {},
  }));
}

function messageErreur(e: unknown): string {
  return e instanceof Error ? e.message : "Échec";
}

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
