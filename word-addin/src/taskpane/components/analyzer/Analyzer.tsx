import * as React from "react";
import AnalysisForm from "./AnalysisForm";
import ClauseList from "./ClauseList";
import ClauseDetail from "./ClauseDetail";
import ClauseCountBadge from "./ClauseCountBadge";
import StatusMessage, { Status } from "../common/StatusMessage";
import { AnalysisContext, ClauseRisk } from "../../core/types";
import { analyzeContract, AuthError } from "../../core/lumenService";
import { clearHighlights, getDocumentText, highlightClauses, selectClause } from "../../core/wordDocument";

type Screen = "form" | "results";

interface Props {
  /** Session expirée pendant une analyse : App renvoie vers la connexion. */
  onSessionExpired: (notice: Status) => void;
}

/**
 * Analyse des risques : formulaire de contexte → liste des clauses → fiche détail.
 * Tout l'état de l'analyse vit ici, App ne gère que la connexion et le menu.
 */
const Analyzer: React.FC<Props> = ({ onSessionExpired }) => {
  const [screen, setScreen] = React.useState<Screen>("form");
  const [documentText, setDocumentText] = React.useState("");
  const [analyzing, setAnalyzing] = React.useState(false);
  const [highlighting, setHighlighting] = React.useState(false);
  const [status, setStatus] = React.useState<Status | null>(null);
  const [clauses, setClauses] = React.useState<ClauseRisk[]>([]);
  const [missingIds, setMissingIds] = React.useState<string[]>([]);
  const [appliedIds, setAppliedIds] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<ClauseRisk | null>(null);

  // Lecture du document à l'ouverture, pour pré-remplir le formulaire (IA).
  React.useEffect(() => {
    getDocumentText()
      .then(setDocumentText)
      .catch(() => {
        /* best-effort */
      });
  }, []);

  /** Lance l'analyse avec le contexte du formulaire (texte lu à la volée). */
  const handleAnalyze = async (context: AnalysisContext) => {
    setStatus(null);
    let text = "";
    try {
      text = await getDocumentText();
    } catch (error) {
      setStatus({ kind: "err", text: `Lecture du document impossible : ${String(error)}` });
      return;
    }
    if (!text || text.trim().length < 100) {
      setStatus({ kind: "warn", text: "Document vide ou trop court : ouvrez un contrat dans Word." });
      return;
    }

    setScreen("results");
    setAnalyzing(true);
    setSelected(null);
    setClauses([]);
    setMissingIds([]);
    setAppliedIds([]);
    try {
      const found = await analyzeContract(text, context);
      setClauses(found);

      if (found.length === 0) {
        setStatus({ kind: "ok", text: "Aucune clause à risque détectée." });
        return;
      }

      // Liste affichée immédiatement, surlignage en arrière-plan.
      setHighlighting(true);
      void highlightClauses(found)
        .then((report) => setMissingIds(report.missing))
        .catch((e) => setStatus({ kind: "warn", text: `Surlignage impossible : ${String(e)}` }))
        .finally(() => setHighlighting(false));
    } catch (error) {
      if (error instanceof AuthError) {
        onSessionExpired({ kind: "warn", text: "Votre session a expiré. Reconnectez-vous pour continuer." });
        return;
      }
      setStatus({
        kind: "err",
        text: `Analyse échouée : ${error instanceof Error ? error.message : String(error)} Si le problème persiste, contactez-nous via lumenjuris.com.`,
      });
    } finally {
      setAnalyzing(false);
    }
  };

  /** Retour au formulaire pour relancer une analyse (efface les surlignages). */
  const handleNewAnalysis = async () => {
    await clearHighlights().catch(() => {});
    setClauses([]);
    setMissingIds([]);
    setSelected(null);
    setStatus(null);
    setScreen("form");
  };

  /* ---------- Fiche détail (fenêtre modale de la plateforme) ---------- */
  if (selected) {
    return (
      <ClauseDetail
        clause={selected}
        onClose={() => setSelected(null)}
        onApplied={(id) => setAppliedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
      />
    );
  }

  /* ---------- Formulaire de contexte ---------- */
  if (screen === "form") {
    return <AnalysisForm documentText={documentText} analyzing={analyzing} status={status} onSubmit={handleAnalyze} />;
  }

  /* ---------- Résultats : liste des clauses ---------- */
  return (
    <>
      <div className="lj-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <button className="lj-btn secondary small" onClick={handleNewAnalysis} disabled={analyzing || highlighting}>
            ← Nouvelle analyse
          </button>
          {!analyzing && !highlighting && clauses.length > 0 && <ClauseCountBadge clauses={clauses} />}
        </div>
        {analyzing && <p className="lj-muted" style={{ margin: "8px 0 0" }}>Analyse IA en cours…</p>}
        {highlighting && <p className="lj-muted" style={{ margin: "8px 0 0" }}>Surlignage dans le document…</p>}
        <StatusMessage status={status} />
      </div>

      <ClauseList
        clauses={clauses}
        missingIds={missingIds}
        appliedIds={appliedIds}
        onOpen={(clause) => {
          // Sélectionne la clause surlignée dans le document, puis ouvre sa fiche.
          void selectClause(clause.id);
          setSelected(clause);
        }}
      />
    </>
  );
};

export default Analyzer;
