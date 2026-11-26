import * as React from "react";
import { AnalysisContext } from "../../core/types";
import { DEFAULT_CONTEXT, detectContract } from "../../core/lumenService";
import StatusMessage, { Status } from "../common/StatusMessage";

interface Props {
  documentText: string;
  analyzing: boolean;
  status: Status | null;
  onSubmit: (context: AnalysisContext) => void;
}

/** Placeholder adaptatif de la mission — repris du formulaire plateforme. */
function getMissionPlaceholder(contractType: string): string {
  const type = contractType.toLowerCase();
  if (type.includes("bail") || type.includes("location")) {
    return "Ex: Vérifier les charges cachées, protéger mes droits de locataire, analyser le dépôt de garantie...";
  }
  if (type.includes("travail") || type.includes("emploi")) {
    return "Ex: Vérifier la période d'essai, analyser les clauses de non-concurrence, négocier le télétravail...";
  }
  if (type.includes("vente") || type.includes("achat")) {
    return "Ex: Vérifier les garanties, analyser les conditions de livraison, négocier les délais...";
  }
  if (type.includes("prestation") || type.includes("service")) {
    return "Ex: Vérifier les livrables, analyser les pénalités de retard, clarifier la propriété intellectuelle...";
  }
  return "Ex: vérifier la conformité légale, protéger vos intérêts, identifier les risques...";
}

/**
 * Écran d'accueil = contexte d'analyse (réplique du formulaire contextuel de
 * la plateforme). Tous les champs sont présentés directement, pré-remplis par
 * l'IA (/api/analyzer/detect-contract) dès l'ouverture, puis l'analyse se lance ici même.
 */
const AnalysisForm: React.FC<Props> = ({ documentText, analyzing, status, onSubmit }) => {
  const [context, setContext] = React.useState<AnalysisContext>({ ...DEFAULT_CONTEXT });
  const [detecting, setDetecting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isEquitable = context.interestOrientation === "balanced";

  // Détection IA au chargement pour pré-remplir le formulaire (comme la plateforme).
  React.useEffect(() => {
    if (!documentText || documentText.length < 100) return undefined;
    let active = true;
    setDetecting(true);
    detectContract(documentText)
      .then((ai) => {
        if (!active) return;
        setContext((prev) => ({
          ...prev,
          contractType: ai.contractType ?? prev.contractType,
          userRole: ai.userRole ?? prev.userRole,
          specificQuestions: ai.specificQuestions ?? prev.specificQuestions,
          mission: ai.mission ?? prev.mission,
          analysisDepth: ai.analysisDepth ?? prev.analysisDepth,
          interestOrientation: ai.interestOrientation ?? prev.interestOrientation,
          legalRegime: ai.legalRegime ?? prev.legalRegime,
          contractObjective: ai.contractObjective ?? prev.contractObjective,
        }));
      })
      .catch(() => {
        /* pré-remplissage best-effort */
      })
      .finally(() => active && setDetecting(false));
    return () => {
      active = false;
    };
  }, [documentText]);

  const handleSubmit = () => {
    // Seul le type de contrat (et la position si non équilibré) est requis :
    // le reste est pré-rempli par l'IA et facultatif, pour lancer sans friction.
    if (!context.contractType.trim()) {
      setError("Indiquez au moins le type de contrat.");
      return;
    }
    if (!isEquitable && !context.userRole.trim()) {
      setError("Indiquez votre position contractuelle.");
      return;
    }
    setError(null);
    onSubmit({
      ...context,
      specificQuestions: context.specificQuestions || "Analyse générale des risques",
      missionContext: context.mission || "Analyse contractuelle",
    });
  };

  return (
    <div className="lj-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Analyser ce contrat</h3>
        {detecting && <span className="lj-muted">Pré-remplissage IA…</span>}
      </div>

      <label className="lj-label">Type de contrat</label>
      <input
        className="lj-input"
        type="text"
        value={context.contractType}
        placeholder="ex: Contrat de travail, Contrat commercial..."
        onChange={(e) => setContext({ ...context, contractType: e.target.value })}
      />

      {isEquitable ? (
        <div className="lj-status ok">⚖️ Contrat équilibré : la position contractuelle est neutre.</div>
      ) : (
        <>
          <label className="lj-label">Votre position contractuelle</label>
          <label className="lj-radio">
            <input
              type="radio"
              name="userRole"
              value="position_favorable"
              checked={context.userRole === "position_favorable"}
              onChange={(e) => setContext({ ...context, userRole: e.target.value, interestOrientation: "assertive" })}
            />
            <span>
              <strong>🏛️ Position favorable</strong> — j&apos;ai l&apos;avantage contractuel
            </span>
          </label>
          <label className="lj-radio">
            <input
              type="radio"
              name="userRole"
              value="position_vulnerable"
              checked={context.userRole === "position_vulnerable"}
              onChange={(e) => setContext({ ...context, userRole: e.target.value, interestOrientation: "defensive" })}
            />
            <span>
              <strong>🛡️ Position vulnérable</strong> — je suis en situation de faiblesse
            </span>
          </label>
        </>
      )}

      <label className="lj-label">🎯 Orientation de l&apos;analyse</label>
      <label className="lj-radio">
        <input
          type="radio"
          name="interestOrientation"
          value="defensive"
          checked={context.interestOrientation === "defensive"}
          onChange={() => setContext({ ...context, interestOrientation: "defensive" })}
        />
        <span>
          <strong>🛡️ Défensif</strong> — protéger mes intérêts, identifier tous les risques
        </span>
      </label>
      <label className="lj-radio">
        <input
          type="radio"
          name="interestOrientation"
          value="balanced"
          checked={context.interestOrientation === "balanced"}
          onChange={() => setContext({ ...context, interestOrientation: "balanced" })}
        />
        <span>
          <strong>⚖️ Équilibré</strong> — analyse objective des deux parties
        </span>
      </label>
      <label className="lj-radio">
        <input
          type="radio"
          name="interestOrientation"
          value="assertive"
          checked={context.interestOrientation === "assertive"}
          onChange={() => setContext({ ...context, interestOrientation: "assertive" })}
        />
        <span>
          <strong>⚡ Assertif</strong> — maximiser mes avantages contractuels
        </span>
      </label>

      <label className="lj-label">
        Régime juridique <span className="lj-muted">(optionnel)</span>
      </label>
      <input
        className="lj-input"
        type="text"
        value={context.legalRegime || ""}
        placeholder="ex: Droit privé – Contrat commercial"
        onChange={(e) => setContext({ ...context, legalRegime: e.target.value })}
      />

      <label className="lj-label">
        Objectif du contrat <span className="lj-muted">(optionnel)</span>
      </label>
      <input
        className="lj-input"
        type="text"
        value={context.contractObjective || ""}
        placeholder="ex: Sécuriser un partenariat"
        onChange={(e) => setContext({ ...context, contractObjective: e.target.value })}
      />

      <label className="lj-label">
        Mission spécifique <span className="lj-muted">(optionnel)</span>
      </label>
      <textarea
        className="lj-textarea"
        rows={2}
        value={context.mission || ""}
        placeholder={getMissionPlaceholder(context.contractType)}
        onChange={(e) => setContext({ ...context, mission: e.target.value })}
      />

      {error && <div className="lj-status err">{error}</div>}
      <StatusMessage status={status} />

      <button className="lj-btn" onClick={handleSubmit} disabled={analyzing} style={{ marginTop: 10, width: "100%" }}>
        {analyzing ? "Analyse en cours…" : "🔍 Analyser le document"}
      </button>
    </div>
  );
};

export default AnalysisForm;
