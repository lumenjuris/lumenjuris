import * as React from "react";
import { ClauseAI, ClauseRisk, JurisprudenceCase, Recommendation } from "../../core/types";
import { fetchClauseDetail, fetchJurisprudence, fetchRecommendations, askQuestion } from "../../core/lumenService";
import RichText from "../common/RichText";
import { applyRecommendationTracked } from "../../core/wordDocument";
import StatusMessage, { Status, TRACKED_OK, TRACKED_UNSUPPORTED } from "../common/StatusMessage";

type Tab = "overview" | "cases" | "question";

interface Props {
  clause: ClauseRisk;
  onClose: () => void;
  onApplied?: (clauseId: string) => void;
}

const riskBadge = (score: number): { label: string; css: string } =>
  score >= 4
    ? { label: `${score}/5`, css: "high" }
    : score >= 3
      ? { label: `${score}/5`, css: "medium" }
      : { label: `${score}/5`, css: "low" };

/**
 * Fiche détail d'une clause — reprise de la fenêtre modale
 * EnhancedClauseDetail de la plateforme (onglets Aperçu / Jurisprudence /
 * Question), adaptée au volet Word : les recommandations s'appliquent
 * directement dans le document, en suivi des modifications.
 */
const ClauseDetail: React.FC<Props> = ({ clause, onClose, onApplied }) => {
  const [tab, setTab] = React.useState<Tab>("overview");
  const [ai, setAi] = React.useState<ClauseAI | null>(null);
  const [recommendations, setRecommendations] = React.useState<Recommendation[] | null>(null);
  const [cases, setCases] = React.useState<JurisprudenceCase[] | null>(null);
  const [casesError, setCasesError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<Status | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [question, setQuestion] = React.useState("");
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [asking, setAsking] = React.useState(false);
  const [textExpanded, setTextExpanded] = React.useState(false);

  // Détail IA (problèmes / conseil) + recommandations, comme la modale plateforme.
  React.useEffect(() => {
    let cancelled = false;
    setAi(null);
    setRecommendations(null);
    setCases(null);
    setAnswer(null);
    setStatus(null);

    fetchClauseDetail(clause)
      .then((detail) => !cancelled && setAi(detail))
      .catch((e) => !cancelled && setAi({ ...emptyAI, error: `Détail IA indisponible : ${String(e)}` }));

    fetchRecommendations(clause)
      .then((recos) => !cancelled && setRecommendations(recos))
      .catch(() => !cancelled && setRecommendations([]));

    // Jurisprudence préchargée dès l'ouverture de la fiche (la recherche
    // hybride Judilibre est longue : autant qu'elle tourne pendant que le
    // juriste lit l'aperçu — l'onglet ⚖️ est souvent prêt au moment du clic).
    setCasesError(null);
    fetchJurisprudence(clause)
      .then((items) => !cancelled && setCases(items))
      .catch((e) => {
        if (!cancelled) {
          setCases([]);
          setCasesError(e instanceof Error ? e.message : String(e));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clause.id]);

  const handleApply = async (clauseText: string) => {
    setBusy(true);
    setStatus(null);
    try {
      const { applied, tracked } = await applyRecommendationTracked(clause.id, clauseText);
      if (!applied) {
        setStatus({
          kind: "warn",
          text: "Clause non retrouvée dans le document (ancrage supprimé ?). Relancez l'analyse puis réessayez.",
        });
      } else {
        setStatus(tracked ? TRACKED_OK : TRACKED_UNSUPPORTED);
        onApplied?.(clause.id);
      }
    } catch (error) {
      setStatus({ kind: "err", text: `Échec de l'application : ${String(error)}` });
    } finally {
      setBusy(false);
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    setAsking(true);
    setAnswer(null);
    try {
      setAnswer(await askQuestion(clause, question.trim()));
    } catch (error) {
      setAnswer(`Réponse indisponible : ${String(error)}`);
    } finally {
      setAsking(false);
    }
  };

  const badge = riskBadge(clause.riskScore);

  return (
    <div className="lj-detail">
      {/* En-tête (équivalent renderHeader de la modale) */}
      <div className="lj-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <button className="lj-btn secondary small" onClick={onClose}>
            ← Retour
          </button>
          <span className={`lj-badge ${badge.css}`}>{badge.label}</span>
        </div>
        <StatusMessage status={status} />
      </div>

      {/* Onglets remontés, juste sous l'en-tête */}
      <nav className="lj-tabs" style={{ marginBottom: 10 }}>
        <button className={`lj-tab ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>
          Aperçu
        </button>
        <button className={`lj-tab ${tab === "cases" ? "active" : ""}`} onClick={() => setTab("cases")}>
          Jurisprudence
        </button>
        <button className={`lj-tab ${tab === "question" ? "active" : ""}`} onClick={() => setTab("question")}>
          Question
        </button>
      </nav>

      {tab === "overview" && (
        <>
          {/* Aperçu du texte exactement surligné dans le document — replié si long. */}
          <div className="lj-card">
            <div className="lj-section-title">📄 Aperçu de la clause</div>
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, margin: "2px 0 0" }}>
              {textExpanded || clause.content.length <= 220 ? clause.content : `${clause.content.slice(0, 220)}…`}
            </div>
            {clause.content.length > 220 && (
              <button
                className="lj-btn secondary small"
                onClick={() => setTextExpanded(!textExpanded)}
                style={{ marginTop: 8 }}
              >
                {textExpanded ? "▲ Réduire" : "▼ Voir le texte complet"}
              </button>
            )}
          </div>

          {/* Problèmes (issues du ClauseAI) */}
          <div className="lj-card">
            <div className="lj-section-title">⚠️ Problèmes</div>
            {!ai ? (
              <p className="lj-muted">Analyse en cours…</p>
            ) : ai.error ? (
              <p className="lj-muted">{ai.error}</p>
            ) : ai.issues.length ? (
              <ul className="lj-list">
                {ai.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            ) : (
              <p className="lj-muted">Aucun problème identifié.</p>
            )}
            {ai?.advice && (
              <p style={{ marginBottom: 0 }}>
                <strong>Conseil :</strong> {ai.advice}
              </p>
            )}
          </div>

          {/* Recommandations — appliquées au document en suivi des modifications */}
          <div className="lj-card">
            <div className="lj-section-title">💡 Recommandations</div>
            {!recommendations ? (
              <p className="lj-muted">Génération des recommandations…</p>
            ) : recommendations.length === 0 ? (
              <p className="lj-muted">Aucune recommandation générée.</p>
            ) : (
              recommendations.map((reco, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  {reco.title && <strong style={{ fontSize: 12.5 }}>{reco.title}</strong>}
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, margin: "4px 0" }}>{reco.clauseText}</div>
                  <p className="lj-muted" style={{ margin: "4px 0 6px" }}>
                    <strong>Avantages :</strong> {reco.benefits}
                    {reco.riskReduction && (
                      <>
                        {" · "}
                        <strong>Réduction du risque :</strong> {reco.riskReduction}
                      </>
                    )}
                  </p>
                  <button className="lj-btn small" onClick={() => handleApply(reco.clauseText)} disabled={busy}>
                    {busy ? "Application…" : "Appliquer dans le document (révision)"}
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {tab === "cases" && (
        <div className="lj-card">
          <div className="lj-section-title">⚖️ Jurisprudence</div>
          {!cases ? (
            <p className="lj-muted">Recherche Judilibre en cours…</p>
          ) : casesError ? (
            <div className="lj-status err">Recherche de jurisprudence échouée : {casesError}</div>
          ) : cases.length === 0 ? (
            <p className="lj-muted">Aucune décision trouvée pour cette clause.</p>
          ) : (
            <ul className="lj-list">
              {cases.map((c, i) => (
                <li key={c.id || i} style={{ marginBottom: 10 }}>
                  <strong>{c.title || c.citation || c.court}</strong>
                  {c.court && (
                    <span className="lj-muted">
                      {" "}
                      — {c.court}
                      {c.date ? `, ${c.date}` : c.year ? `, ${c.year}` : ""}
                    </span>
                  )}
                  {c.summary && <div>{c.summary}</div>}
                  {c.litige && (
                    <div className="lj-muted">
                      <strong>Litige :</strong> {c.litige}
                    </div>
                  )}
                  {c.resultat && (
                    <div className="lj-muted">
                      <strong>Résultat :</strong> {c.resultat}
                    </div>
                  )}
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noreferrer">
                      Consulter la décision
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "question" && (
        <div className="lj-card">
          <div className="lj-section-title">❓ Poser une question sur cette clause</div>
          <textarea
            className="lj-textarea"
            rows={3}
            placeholder="Ex. : cette clause est-elle opposable si le salarié refuse le renouvellement ?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button className="lj-btn small" onClick={handleAsk} disabled={asking || !question.trim()}>
            {asking ? "Réponse en cours…" : "Poser la question"}
          </button>
          {answer && (
            <div className="lj-clause-text" style={{ marginTop: 8 }}>
              <RichText>{answer}</RichText>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const emptyAI: ClauseAI = {
  summary: "",
  riskLevel: "Medium",
  riskScore: 50,
  litigation: "",
  issues: [],
  advice: "",
  alternatives: [],
};

export default ClauseDetail;
