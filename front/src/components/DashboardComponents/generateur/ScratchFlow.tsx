import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Loader2, AlertCircle, ChevronLeft, ChevronRight,
  Sparkles, ListChecks, ShieldCheck, Pencil,
} from "lucide-react";
import type { BlockDef, ContractModel, VariableDef } from "../../../contractEngine/types";
import {
  generateContractQuestions, generateContractDraft, generateContractDraftFromBrief,
  type WizardQuestion, type ContractDraft,
} from "./contractAi";

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

/**
 * Parcours « de zéro » :
 *  mode      — deux choix : générer tout de suite, ou personnaliser ;
 *  asking    — questions simples, une par écran, chacune peut être passée ;
 *  review    — récapitulatif des réponses et bouton « Générer mon contrat ».
 */
type Step = "mode" | "loading" | "asking" | "review" | "generating" | "error";

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

  const opId = useRef(0);
  // Écran d'où la génération a été lancée : on y revient en cas d'échec ou de retour.
  const origin = useRef<"mode" | "review">("mode");
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

  const goMode   = () => { setStep("mode"); setError(""); writeUrl({ step: null, q: null }); };
  const goAsk    = (n: number) => { setStep("asking"); setIdx(n); setError(""); writeUrl({ step: "asking", q: n + 1 }); };
  const goReview = () => { setStep("review"); setError(""); writeUrl({ step: "review", q: null }); };

  useEffect(() => {
    setStep("mode");
    setError("");
    setQuestions([]);
    setIdx(0);
    setAnswers({});
  }, [title, initialBrief]);

  useEffect(() => {
    const currentUrl = searchParams.toString();
    if (currentUrl === lastUrl.current) return;
    lastUrl.current = currentUrl;

    const s = searchParams.get("step") as Step | null;

    if (s === "asking" || s === "review") {
      const currentQuestions = questionsRef.current;
      if (currentQuestions.length > 0) {
        if (s === "asking") {
          const qn = Math.max(1, Number(searchParams.get("q") ?? "1"));
          setIdx(Math.min(qn - 1, currentQuestions.length - 1));
        }
        setStep(s);
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

  async function generate(from: "mode" | "review") {
    const id = ++opId.current;
    origin.current = from;
    setStep("generating");
    setError("");
    writeUrl({ step: "generating", q: null });

    try {
      const draft = from === "review"
        ? await generateContractDraft(
            title,
            questions.map((q) => ({ question: q.question, answer: answers[q.id] ?? "" })),
          )
        : await generateContractDraftFromBrief(title, initialBrief?.trim() || title);
      if (opId.current !== id) return;
      onReady({ model: buildModel(title, draft), fileBase: slug(title) });
    } catch {
      if (opId.current !== id) return;
      setError("Échec de la rédaction. Réessayez.");
      setStep(from);
      writeUrl({ step: from === "review" ? "review" : null, q: null });
    }
  }

  function answer(value: string) {
    const q = questions[idx];
    setAnswers((prev) => ({ ...prev, [q.id]: value }));
    if (idx < questions.length - 1) goAsk(idx + 1);
    else goReview();
  }

  const q = questions[idx];
  const total = questions.length;

  const backTarget = () => {
    opId.current += 1;
    if (step === "generating") {
      setStep(origin.current);
      setError("");
      writeUrl({ step: origin.current === "review" ? "review" : null, q: null });
    } else if (step === "review") {
      goAsk(total - 1);
    } else if (step === "asking" && idx > 0) {
      goAsk(idx - 1);
    } else if (step === "asking" || step === "loading" || step === "error") {
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
            <div className="mb-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-subtle">Votre contrat</p>
              <p className="mt-1 text-base font-semibold text-ink">{title}</p>
              {initialBrief?.trim() && initialBrief.trim() !== title && (
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">« {initialBrief.trim()} »</p>
              )}
            </div>
            <button
              onClick={() => void generate("mode")}
              className="w-full rounded-xl border border-line bg-white p-4 text-left transition-all hover:border-brand/50 hover:bg-brand-light/40 group"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Sparkles className="h-4 w-4 text-brand" /> Générer maintenant
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
                Le contrat est rédigé tout de suite avec ce que vous avez indiqué.
                Les informations manquantes seront à compléter dans l’éditeur.
              </span>
            </button>
            <button
              onClick={() => void startGuided()}
              className="w-full rounded-xl border border-line bg-white p-4 text-left transition-all hover:border-brand/50 hover:bg-brand-light/40 group"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ListChecks className="h-4 w-4 text-brand" /> Personnaliser davantage
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-muted">
                Quelques questions simples sur le contenu du contrat — paiement, résiliation,
                responsabilités… — pour un contrat sur mesure. Environ 2 minutes.
              </span>
            </button>
            {error && <p className="text-xs text-danger">{error}</p>}
            <p className="flex items-center gap-1.5 pt-1 text-[11px] text-ink-subtle">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand" />
              Article RGPD inclus dans chaque contrat.
            </p>
          </div>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
            <p className="text-sm text-ink-muted">Préparation des questions…</p>
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

            <p className="text-base font-semibold text-ink">{q.question}</p>
            {q.hint && q.type === "choice" && (
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">{q.hint}</p>
            )}

            <div className="mt-4">
              {q.type === "choice" ? (
                <div className="flex flex-col gap-2">
                  {(q.options ?? []).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => answer(opt)}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium text-ink transition-all hover:border-brand/40 hover:bg-brand-light/50 ${
                        answers[q.id] === opt ? "border-brand/50 bg-brand-light/40" : "border-line bg-white"
                      }`}
                    >
                      {opt}
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-subtle" />
                    </button>
                  ))}
                  <FreeAnswer key={q.id} onSubmit={answer} />
                </div>
              ) : (
                <TextAnswer key={q.id} initial={answers[q.id] ?? ""} placeholder={q.hint} onSubmit={answer} />
              )}
            </div>

            {error && <p className="mt-3 text-xs text-danger">{error}</p>}

            <div className="mt-4 flex items-center justify-between">
              {idx > 0 ? (
                <button
                  onClick={() => goAsk(idx - 1)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-brand"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Précédent
                </button>
              ) : <span />}
              <button
                onClick={() => answer("")}
                className="text-xs font-medium text-ink-muted hover:text-brand"
              >
                Je ne sais pas encore — passer
              </button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div>
              <p className="text-base font-semibold text-ink">Tout est prêt</p>
              <p className="mt-1 text-xs text-ink-muted">
                Vérifiez vos réponses. Ce que vous avez passé restera à compléter dans l’éditeur.
              </p>
            </div>

            <ul className="divide-y divide-line rounded-xl border border-line">
              {questions.map((item, i) => (
                <li key={item.id}>
                  <button
                    onClick={() => goAsk(i)}
                    className="group flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-light/30"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs text-ink-muted">{item.question}</span>
                      {answers[item.id]?.trim()
                        ? <span className="mt-0.5 block text-sm font-medium text-ink">{answers[item.id]}</span>
                        : <span className="mt-0.5 block text-sm italic text-ink-subtle">À compléter plus tard</span>}
                    </span>
                    <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-subtle group-hover:text-brand" />
                  </button>
                </li>
              ))}
            </ul>

            {error && <p className="text-xs text-danger">{error}</p>}

            <div className="flex justify-end">
              <button
                onClick={() => void generate("review")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-all hover:bg-brand-hover"
              >
                <Sparkles className="h-4 w-4" /> Générer mon contrat
              </button>
            </div>
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
        placeholder="Autre réponse…"
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

function TextAnswer({ initial, placeholder, onSubmit }: {
  initial: string;
  placeholder?: string;
  onSubmit: (v: string) => void;
}) {
  const [v, setV] = useState(initial);
  return (
    <div className="flex flex-col gap-2">
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) onSubmit(v.trim()); }}
        placeholder={placeholder}
        className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition-all focus:border-brand/40 focus:shadow-ring-brand placeholder:text-ink-placeholder"
      />
      <div className="flex justify-end">
        <button
          onClick={() => onSubmit(v.trim())}
          disabled={!v.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-card transition-all hover:bg-brand-hover disabled:opacity-50"
        >
          Continuer <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
