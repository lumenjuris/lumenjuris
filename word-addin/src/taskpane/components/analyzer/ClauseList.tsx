import * as React from "react";
import { ClauseRisk } from "../../core/types";

const riskBadge = (score: number): { label: string; css: string } =>
  score >= 4
    ? { label: `${score}/5`, css: "high" }
    : score >= 3
      ? { label: `${score}/5`, css: "medium" }
      : { label: `${score}/5`, css: "low" };

/** Arrière-plan très léger + liseré teintés selon le niveau de risque. */
const riskTint = (score: number): { background: string; borderLeft: string } =>
  score >= 4
    ? { background: "#fef4f4", borderLeft: "3px solid #f0a7a7" }
    : score >= 3
      ? { background: "#fffaf0", borderLeft: "3px solid #f3c88a" }
      : { background: "#fefdf3", borderLeft: "3px solid #eadf9a" };

/** Teinte « appliquée » (verte) : la recommandation a été insérée au document. */
const appliedTint = { background: "#f0fdf4", borderLeft: "3px solid #86efac" };

interface Props {
  clauses: ClauseRisk[];
  missingIds: string[];
  appliedIds: string[];
  onOpen: (clause: ClauseRisk) => void;
}

/**
 * Liste des clauses à risque détectées (équivalent ClausesSidebar de la
 * plateforme). Clic sur une carte → sélectionne la clause surlignée dans le
 * document Word ET ouvre sa fiche détail.
 */
const ClauseList: React.FC<Props> = ({ clauses, missingIds, appliedIds, onOpen }) => {
  if (clauses.length === 0) return null;

  const sorted = [...clauses].sort((a, b) => b.riskScore - a.riskScore);

  return (
    <div>
      {sorted.map((clause) => {
        const badge = riskBadge(clause.riskScore);
        const missing = missingIds.includes(clause.id);
        const applied = appliedIds.includes(clause.id);
        return (
          <div
            className="lj-card lj-clickable"
            key={clause.id}
            onClick={() => onOpen(clause)}
            role="button"
            tabIndex={0}
            style={applied ? appliedTint : riskTint(clause.riskScore)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <h3 style={{ margin: 0 }}>{clause.type}</h3>
              {applied ? (
                <span className="lj-count-badge low" style={{ whiteSpace: "nowrap" }}>✓ Appliquée</span>
              ) : (
                <span className={`lj-badge ${badge.css}`}>{badge.label}</span>
              )}
            </div>
            {missing && (
              <span className="lj-muted" style={{ display: "block", marginTop: 6 }}>
                Non localisée dans le document
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ClauseList;
