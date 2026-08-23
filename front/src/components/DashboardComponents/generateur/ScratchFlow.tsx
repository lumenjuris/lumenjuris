import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Loader2, AlertCircle, ChevronLeft, ChevronRight,
  Sparkles, ListChecks, Paperclip, ShieldCheck, X, FileText,
} from "lucide-react";
import type { BlockDef, ContractModel, VariableDef } from "../../../contractEngine/types";
import {
  generateContractQuestions, generateContractDraft, generateContractDraftFromBrief,
  type WizardQuestion, type ContractDraft, type BriefAttachment, type PartyIdentity,
} from "./contractAi";
import { contractApi } from "../contratheque/api";
import { extractDocumentContent } from "../../../utils/documentExtractor";
import { mapCompanyToContractParty } from "../../../utils/companyLookup";
import type { CompanyResult } from "../../../types/companySearch";

function slug(s: string): string {
  const o = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return o || "contrat";
}

function buildModel(title: string, draft: ContractDraft): ContractModel {
  const variables: VariableDef[] = draft.variables.map((v) => ({ id: v.id, label: v.label, type: "text" }));
  const blocks: BlockDef[] = [
    { id: "title", kind: "title", content: draft.title || title.toUpperCase() },
  ];
  draft.sections.forEach((s, i) => {
    blocks.push({ id: `sec_${i}`, kind: "clause", heading: s.heading, content: s.content });
  });
  if (!draft.sections.some((s) => /signature/i.test(s.heading ?? ""))) {
    blocks.push({
      id: "signatures", kind: "signature", heading: "Signatures",
      content: "Fait en deux exemplaires.\n\nLa première partie\t\t\tLa seconde partie",
    });
  }
  return {
    key: "scratch", version: 1, label: title,
    variables, blocks, alternatives: [], decisions: [], rules: [], mandatoryMentions: [],
  };
}

type Step = "mode" | "brief" | "loading" | "asking" | "generating" | "error";

interface Attachment {
  file: File;
  status: "extracting" | "ready" | "failed";
  text: string;
}

const ACCEPTED = ".pdf,.docx";
const MAX_ATTACHMENTS = 3;

export function ScratchWizard({ title, initialBrief, onReady, onBack }: {
  title: string;
  initialBrief?: string;
  onReady: (r: { model: ContractModel; fileBase: string }) => void;
  onBack: () => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [questions, setQuestions] = useState<WizardQuestion[]>([]);
  const questionsRef = useRef<WizardQuestion[]>([]);
  questionsRef.current = questions;

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [brief, setBrief] = useState(initialBrief ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [parties, setParties] = useState<PartyIdentity[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const opId = useRef(0);
  const origin = useRef<"brief" | "asking">("brief");
  const lastUrl = useRef("");
  
  const initialStep = (searchParams.get("step") as Step) || "mode";
  const [step, setStep] = useState<Step>(initialStep);

  const writeUrl = (patch: { step?: string | null; q?: number | null }, options?: { replace?: boolean }) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (patch.step === null) next.delete("step");
      else if (patch.step !== undefined) next.set("step", patch.step);

      if (patch.q == null) next.delete("q");
      else next.set("q", String(patch.q));

      lastUrl.current = next.toString();
      return next;
    }, options);
  };

  const goMode  = () => { setStep("mode"); setError(""); writeUrl({ step: null, q: null }); };
  const goBrief = () => { setStep("brief"); setError(""); writeUrl({ step: "brief", q: null }); };
  const goAsk   = (n: number) => { setStep("asking"); setIdx(n); setError(""); writeUrl({ step: "asking", q: n + 1 }); };

  useEffect(() => {
    setStep("mode");
    setError("");
    setBrief(initialBrief ?? "");
    setAttachments([]);
    setQuestions([]);
    setIdx(0);
    setAnswers({});
    setParties([]);
  }, [title, initialBrief]);

  useEffect(() => {
    const currentUrl = searchParams.toString();
    if (currentUrl === lastUrl.current) return;
    lastUrl.current = currentUrl;

    const s = searchParams.get("step") as Step | null;

    if (s === "brief") {
      setStep("brief");
      setError("");
      return;
    }

    if (s === "asking") {
      const currentQuestions = questionsRef.current;
      if (currentQuestions.length > 0) {
        const qn = Math.max(1, Number(searchParams.get("q") ?? "1"));
        setIdx(Math.min(qn - 1, currentQuestions.length - 1));
        setStep("asking");
        setError("");
      } else {
        writeUrl({ step: null, q: null }, { replace: true });
        setStep("mode");
      }
      return;
    }

    if (s === "loading" || s === "generating") {
      return;
    }

    setStep("mode");
    setError("");
  }, [searchParams]);

  const startGuided = async () => {
    const id = ++opId.current;
    setStep("loading");
    setError("");
    writeUrl({ step: "loading", q: null });

    try {
      const qs = await generateContractQuestions(title);
      if (opId.current !== id) return;
      setQuestions(qs);
      setAnswers({});
      goAsk(0);
    } catch {
      if (opId.current !== id) return;
      setError("Service IA indisponible — impossible de préparer les questions.");
      setStep("error");
    }
  };

  const applyParty = (role: string, result: CompanyResult, siret?: string) => {
    const p = mapCompanyToContractParty(result, siret);
    setParties((prev) => [...prev.filter((x) => x.role !== role), { role, ...p }]);
  };

  function finish(finalAnswers: Record<string, string>) {
    origin.current = "asking";
    void runGuided(finalAnswers);
  }

  function finishBrief() {
    if (!brief.trim()) return;
    origin.current = "brief";
    void runBrief();
  }

  async function runGuided(finalAnswers: Record<string, string>) {
    const id = ++opId.current;
    setStep("generating");
    setError("");
    writeUrl({ step: "generating", q: null });

    try {
      const qa = questions.map((q) => ({ question: q.question, answer: finalAnswers[q.id] ?? "" }));
      const draft = await generateContractDraft(title, qa, parties);
      if (opId.current !== id) return;
      onReady({ model: buildModel(title, draft), fileBase: slug(title) });
    } catch {
      if (opId.current !== id) return;
      setError("Échec de la rédaction. Réessayez.");
      setStep("asking");
    }
  }

  async function runBrief() {
    const id = ++opId.current;
    setStep("generating");
    setError("");
    writeUrl({ step: "generating", q: null });

    try {
      const docs: BriefAttachment[] = attachments
        .filter((a) => a.status === "ready" && a.text.trim())
        .map((a) => ({ name: a.file.name, text: a.text }));
      const draft = await generateContractDraftFromBrief(title, brief, docs, parties);
      if (opId.current !== id) return;
      onReady({ model: buildModel(title, draft), fileBase: slug(title) });
    } catch {
      if (opId.current !== id) return;
      setError("Échec de la rédaction. Réessayez.");
      setStep("brief");
    }
  }

  async function extractAttachment(file: File): Promise<string> {
    if (/\.pdf$/i.test(file.name)) {
      try {
        const r = await extractDocumentContent(file);
        if (r.text?.trim()) return r.text;
      } catch { /* repli serveur */ }
    }
    const r = await contractApi.extract(file);
    if (r.ocr_text?.trim()) return r.ocr_text;
    throw new Error("extraction impossible");
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const room = MAX_ATTACHMENTS - attachments.length;
    const files = Array.from(list)
      .filter((f) => /\.(pdf|docx)$/i.test(f.name))
      .slice(0, Math.max(0, room));
    for (const file of files) {
      setAttachments((prev) => [...prev, { file, status: "extracting", text: "" }]);
      void extractAttachment(file)
        .then((text) => {
          setAttachments((prev) => prev.map((a) => (a.file === file ? { ...a, status: "ready", text } : a)));
        })
        .catch(() => {
          setAttachments((prev) => prev.map((a) => (a.file === file ? { ...a, status: "failed" } : a)));
        });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function answer(value: string) {
    const q = questions[idx];
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    if (idx < questions.length - 1) goAsk(idx + 1);
    else void finish(next);
  }

  const q = questions[idx];
  const total = questions.length;
  const extracting = attachments.some((a) => a.status === "extracting");

  const backTarget = () => {
    opId.current += 1;
    if (step === "generating") {
      setStep(origin.current);
      setError("");
      writeUrl({ step: origin.current, q: origin.current === "asking" ? idx + 1 : null });
    } else if (step === "asking" && idx > 0) {
      goAsk(idx - 1);
    } else if (step === "brief" || step === "asking" || step === "loading" || step === "error") {
      goMode();
    } else {
      onBack();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <button onClick={step === "mode" ? onBack : backTarget} className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-brand">
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>

      <div className="rounded-card border border-line bg-white p-6 shadow-card">
        {step === "mode" && (
          <div className="space-y-3">
            <button
              onClick={goBrief}
              className="w-full rounded-xl border border-line bg-white p-4 text-left transition-all hover:border-brand/50 hover:bg-brand-light/40 group"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Sparkles className="h-4 w-4 text-brand" /> Décrire le besoin
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
                Une consigne libre, des pièces jointes si utile. L’outil arbitre le reste.
              </span>
            </button>
            <button
              onClick={() => void startGuided()}
              className="w-full rounded-xl border border-line bg-white p-4 text-left transition-all hover:border-brand/50 hover:bg-brand-light/40 group"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ListChecks className="h-4 w-4 text-brand" /> Cadrer par questions
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
                4 à 7 choix structurants, un par écran. Vous tranchez, l’outil rédige.
              </span>
            </button>
            <p className="flex items-center gap-1.5 pt-1 text-[11px] text-ink-subtle">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand" />
              Article RGPD inclus dans chaque contrat.
            </p>
          </div>
        )}

        {step === "brief" && (
          <div className="space-y-4">
            <p className="text-base font-semibold text-ink">Votre besoin, en quelques phrases</p>
            <textarea
              autoFocus
              aria-label="Votre besoin, en quelques phrases"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={6}
              placeholder={`Ex. « Maintenance informatique pour une PME, facturation mensuelle, intervention sous 48 h, accès distant aux serveurs du client, résiliation avec préavis d’un mois. »`}
              className="w-full resize-y rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-all focus:border-brand/40 focus:shadow-ring-brand placeholder:text-ink-placeholder"
            />

            <div className="space-y-2">
              {attachments.map((a, i) => (
                <div key={`${a.file.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-surface-subtle px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-ink-subtle" />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-secondary">{a.file.name}</span>
                  {a.status === "extracting" && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-ink-subtle"><Loader2 className="h-3 w-3 animate-spin" /> lecture…</span>
                  )}
                  {a.status === "ready" && <span className="text-[11px] font-medium text-success-dark">prêt</span>}
                  {a.status === "failed" && (
                    <span className="text-[11px] text-danger" title="Le texte n’a pas pu être lu : ce document ne sera pas pris en compte dans la rédaction.">
                      illisible — sera ignoré
                    </span>
                  )}
                  <button
                    onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                    className="rounded p-0.5 text-ink-subtle hover:bg-surface-muted hover:text-danger"
                    title="Retirer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {attachments.length < MAX_ATTACHMENTS && (
                <>
                  <input ref={fileInputRef} type="file" accept={ACCEPTED} multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    title="3 documents au maximum"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
                  >
                    <Paperclip className="h-3.5 w-3.5" /> Joindre un document (PDF, Word)
                  </button>
                </>
              )}
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => void finishBrief()}
                disabled={brief.trim().length < 15 || extracting}
                title={
                  extracting
                    ? "Lecture des pièces jointes en cours…"
                    : brief.trim().length < 15
                      ? "Décrivez votre besoin en une phrase au moins"
                      : undefined
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-card transition-all hover:bg-brand-hover disabled:opacity-50"
              >
                {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Rédiger le contrat
              </button>
            </div>
          </div>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
            <p className="text-sm text-ink-muted">Génération des questions en cours…</p>
          </div>
        )}

        {step === "generating" && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
            <p className="text-sm text-ink-muted">Rédaction du contrat…</p>
            <p className="text-xs text-ink-subtle">Article RGPD inclus.</p>
          </div>
        )}

        {step === "error" && (
          <div className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger-light px-4 py-3 text-sm text-danger-dark">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {step === "asking" && q && (
          <div>
            <div className="mb-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-ink-subtle">
                Question {idx + 1} / {total}
              </p>
              <div className="h-1 w-full overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
              </div>
            </div>

            <p className="mb-4 text-base font-semibold text-ink">{q.question}</p>

            {q.type === "choice" ? (
              <div className="flex flex-col gap-2">
                {(q.options ?? []).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => answer(opt)}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 text-left text-sm font-medium text-ink transition-all hover:border-brand/40 hover:bg-brand-light/50"
                  >
                    {opt}
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-subtle" />
                  </button>
                ))}
                <FreeAnswer key={q.id} onSubmit={answer} />
              </div>
            ) : (
              <TextAnswer key={q.id} onSubmit={answer} />
            )}

            {error && <p className="mt-3 text-xs text-danger">{error}</p>}

            {idx > 0 && (
              <button
                onClick={() => goAsk(idx - 1)}
                className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-brand"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Précédent
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FreeAnswer({ onSubmit }: { onSubmit: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 transition-all focus-within:border-brand/40 focus-within:shadow-ring-brand">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) onSubmit(v.trim()); }}
        placeholder="Autre…"
        className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-ink-placeholder"
      />
      <button
        onClick={() => v.trim() && onSubmit(v.trim())}
        disabled={!v.trim()}
        title="Valider cette réponse"
        className="shrink-0 text-ink-subtle transition-colors hover:text-brand disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function TextAnswer({ onSubmit }: { onSubmit: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) onSubmit(v.trim()); }}
        className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-all focus:border-brand/40 focus:shadow-ring-brand"
      />
      <div className="flex justify-end">
        <button
          onClick={() => onSubmit(v.trim())}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-card transition-all hover:bg-brand-hover"
        >
          Continuer <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
