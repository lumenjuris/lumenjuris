import * as React from "react";
import QuestionStep from "./QuestionStep";
import VariablesForm from "./VariablesForm";
import StatusMessage, { Status } from "../common/StatusMessage";
import { ContractDraft, WizardQuestion } from "../../core/types";
import {
  AuthError,
  QuotaExceededError,
  generateContractDraft,
  generateContractDraftFromBrief,
  generateContractQuestions,
} from "../../core/lumenService";
import { insertContract } from "../../core/wordDocument";

/**
 * Parcours « Créer de zéro » de la plateforme (GenerateurHub → ScratchWizard),
 * adapté à Word : le contrat rédigé est inséré dans le document au lieu
 * d'ouvrir l'éditeur.
 *  title      — intitulé du contrat + RGPD ;
 *  loading    — préparation des questions ;
 *  asking     — une question par écran (passable) ;
 *  generating — rédaction (1 crédit « generatorFromScratch ») ;
 *  fill       — champs à compléter puis insertion ;
 *  done       — contrat inséré.
 */
type Step = "title" | "loading" | "asking" | "generating" | "fill" | "done";

interface Props {
  onSessionExpired: (notice: Status) => void;
}

const EXEMPLES = [
  "Contrat de prestation de services informatiques",
  "Accord de confidentialité entre deux sociétés",
  "Contrat de mission freelance",
];

const ContractGeneration: React.FC<Props> = ({ onSessionExpired }) => {
  const [step, setStep] = React.useState<Step>("title");
  const [title, setTitle] = React.useState("");
  const [includeRgpd, setIncludeRgpd] = React.useState(true);
  const [questions, setQuestions] = React.useState<WizardQuestion[]>([]);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [idx, setIdx] = React.useState(0);
  const [draft, setDraft] = React.useState<ContractDraft | null>(null);
  const [inserting, setInserting] = React.useState(false);
  const [status, setStatus] = React.useState<Status | null>(null);
  // Écran d'où la rédaction a été lancée : on y revient en cas d'échec.
  const origin = React.useRef<"title" | "asking">("title");
  // Invalide les réponses d'une opération abandonnée (retour arrière).
  const opId = React.useRef(0);

  const canStart = title.trim().length >= 3;

  /** Erreurs communes : session expirée, quota, IA indisponible. */
  const handleError = (error: unknown, fallback: string): void => {
    if (error instanceof AuthError) {
      onSessionExpired({ kind: "warn", text: "Votre session a expiré. Reconnectez-vous pour continuer." });
      return;
    }
    if (error instanceof QuotaExceededError) {
      setStatus({ kind: "warn", text: error.message });
      return;
    }
    setStatus({ kind: "err", text: fallback });
  };

  const startGuided = async () => {
    const id = ++opId.current;
    setStatus(null);
    setStep("loading");
    try {
      const qs = await generateContractQuestions(title.trim());
      if (opId.current !== id) return;
      setQuestions(qs);
      setAnswers({});
      setIdx(0);
      setStep("asking");
    } catch (error) {
      if (opId.current !== id) return;
      setStep("title");
      handleError(error, "Service IA indisponible — impossible de préparer les questions.");
    }
  };

  // finalAnswers est passé explicitement : juste après la dernière réponse,
  // l'état `answers` n'est pas encore à jour.
  const generate = async (from: "title" | "asking", finalAnswers: Record<string, string> = answers) => {
    const id = ++opId.current;
    origin.current = from;
    setStatus(null);
    setStep("generating");
    try {
      const result =
        from === "asking"
          ? await generateContractDraft(
              title.trim(),
              questions.map((q) => ({ question: q.question, answer: finalAnswers[q.id] ?? "" })),
              includeRgpd
            )
          : await generateContractDraftFromBrief(title.trim(), title.trim(), includeRgpd);
      if (opId.current !== id) return;
      setDraft(result);
      setStep("fill");
    } catch (error) {
      if (opId.current !== id) return;
      setStep(from);
      handleError(error, "Échec de la rédaction. Réessayez.");
    }
  };

  const answer = (value: string) => {
    const q = questions[idx];
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    if (idx < questions.length - 1) setIdx(idx + 1);
    else void generate("asking", next);
  };

  const handleInsert = async (values: Record<string, string>) => {
    if (!draft) return;
    setInserting(true);
    setStatus(null);
    try {
      const { remaining } = await insertContract(draft, values);
      setStep("done");
      setStatus(
        remaining > 0
          ? { kind: "ok", text: `Contrat inséré. ${remaining} champ${remaining > 1 ? "s" : ""} à compléter, surligné${remaining > 1 ? "s" : ""} en jaune.` }
          : { kind: "ok", text: "Contrat inséré dans le document." }
      );
    } catch (error) {
      setStatus({ kind: "err", text: `Insertion impossible : ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setInserting(false);
    }
  };

  const restart = () => {
    opId.current += 1;
    setStep("title");
    setTitle("");
    setQuestions([]);
    setAnswers({});
    setIdx(0);
    setDraft(null);
    setStatus(null);
  };

  /** Retour arrière (abandonne l'opération en cours). */
  const back = () => {
    opId.current += 1;
    setStatus(null);
    if (step === "asking" && idx > 0) setIdx(idx - 1);
    else if (step === "generating") setStep(origin.current);
    else setStep("title");
  };

  /* ---------- Intitulé du contrat ---------- */
  if (step === "title") {
    return (
      <div className="lj-auth-card">
        <h3>Créer un contrat</h3>
        <p className="lj-muted" style={{ margin: "0 0 10px" }}>
          Décrivez le contrat souhaité : il est rédigé par l'IA puis inséré à l'emplacement du curseur.
        </p>
        <label className="lj-label" htmlFor="lj-gen-title">Quel contrat souhaitez-vous créer ?</label>
        <input
          id="lj-gen-title"
          className="lj-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Ex : ${EXEMPLES[0]}`}
        />
        <div className="lj-gen-examples">
          {EXEMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setTitle(ex)}>
              {ex}
            </button>
          ))}
        </div>

        <label className="lj-gen-check">
          <input type="checkbox" checked={includeRgpd} onChange={(e) => setIncludeRgpd(e.target.checked)} />
          Inclure un article RGPD (protection des données personnelles)
        </label>

        <button type="button" className="lj-choice" disabled={!canStart} onClick={() => void generate("title")}>
          <span>
            <strong>Générer maintenant</strong>
            <small>Rédigé tout de suite, à compléter ensuite.</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
        <button type="button" className="lj-choice" disabled={!canStart} onClick={() => void startGuided()}>
          <span>
            <strong>Personnaliser davantage</strong>
            <small>Quelques questions simples pour un contrat sur mesure.</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
        <StatusMessage status={status} />
      </div>
    );
  }

  /* ---------- Attente IA ---------- */
  if (step === "loading" || step === "generating") {
    return (
      <div className="lj-auth-card" style={{ textAlign: "center" }}>
        <div className="lj-spinner" aria-hidden="true" />
        <p className="lj-muted" style={{ margin: "10px 0 0" }}>
          {step === "loading" ? "Préparation des questions…" : "Rédaction du contrat…"}
        </p>
        {step === "generating" && includeRgpd && <p className="lj-muted" style={{ margin: "2px 0 0" }}>Article RGPD inclus.</p>}
        <button type="button" className="lj-logout" style={{ marginTop: 10 }} onClick={back}>
          ‹ Retour
        </button>
      </div>
    );
  }

  /* ---------- Questions ---------- */
  if (step === "asking" && questions[idx]) {
    return (
      <>
        <button type="button" className="lj-logout" onClick={back} style={{ marginBottom: 6 }}>
          ‹ Retour
        </button>
        <QuestionStep
          key={questions[idx].id}
          question={questions[idx]}
          index={idx}
          total={questions.length}
          previous={answers[questions[idx].id]}
          onAnswer={answer}
          onPrevious={idx > 0 ? () => setIdx(idx - 1) : undefined}
        />
        <StatusMessage status={status} />
      </>
    );
  }

  /* ---------- Champs à compléter ---------- */
  if (step === "fill" && draft) {
    return (
      <>
        <VariablesForm draft={draft} inserting={inserting} onInsert={handleInsert} />
        <StatusMessage status={status} />
      </>
    );
  }

  /* ---------- Terminé ---------- */
  return (
    <div className="lj-auth-card">
      <h3>Contrat inséré</h3>
      <StatusMessage status={status} />
      <p className="lj-muted" style={{ margin: "8px 0 10px" }}>
        Relisez le contrat dans le document : vous pouvez ensuite l'analyser depuis l'onglet « Analyser un
        contrat ».
      </p>
      <button type="button" className="lj-btn-brand" onClick={restart}>
        Créer un autre contrat
      </button>
    </div>
  );
};

export default ContractGeneration;
