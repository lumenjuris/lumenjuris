import * as React from "react";
import { WizardQuestion } from "../../core/types";

interface Props {
  question: WizardQuestion;
  index: number;
  total: number;
  previous?: string;
  onAnswer: (value: string) => void;
  onPrevious?: () => void;
}

/** Une question de cadrage par écran (= ScratchWizard, étape « asking », de la plateforme). */
const QuestionStep: React.FC<Props> = ({ question, index, total, previous, onAnswer, onPrevious }) => {
  const [free, setFree] = React.useState(question.type === "text" ? previous ?? "" : "");
  const isLast = index === total - 1;

  return (
    <div className="lj-auth-card">
      <p className="lj-gen-kicker">
        Question {index + 1} / {total}
      </p>
      <div className="lj-progress">
        <div style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>

      <h3 style={{ marginTop: 12 }}>{question.question}</h3>
      {question.hint && question.type === "choice" && <p className="lj-muted" style={{ margin: 0 }}>{question.hint}</p>}

      <div style={{ marginTop: 10 }}>
        {question.type === "choice" &&
          (question.options ?? []).map((opt) => (
            <button
              key={opt}
              type="button"
              className={`lj-choice${previous === opt ? " selected" : ""}`}
              onClick={() => onAnswer(opt)}
            >
              {opt}
              <span aria-hidden="true">›</span>
            </button>
          ))}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (free.trim()) onAnswer(free.trim());
          }}
        >
          <input
            className="lj-input"
            value={free}
            autoFocus={question.type === "text"}
            onChange={(e) => setFree(e.target.value)}
            placeholder={question.type === "text" ? question.hint ?? "Votre réponse" : "Autre réponse…"}
            style={{ marginTop: question.type === "choice" ? 4 : 0 }}
          />
          {(question.type === "text" || free.trim()) && (
            <button className="lj-btn-brand" type="submit" disabled={!free.trim()}>
              Continuer
            </button>
          )}
        </form>
      </div>

      {isLast && <p className="lj-muted" style={{ margin: "10px 0 0" }}>Dernière question : le contrat sera rédigé juste après.</p>}

      <div className="lj-gen-nav">
        {onPrevious ? (
          <button type="button" className="lj-logout" onClick={onPrevious}>
            ‹ Précédent
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="lj-logout" onClick={() => onAnswer("")}>
          Je ne sais pas encore — passer
        </button>
      </div>
    </div>
  );
};

export default QuestionStep;
