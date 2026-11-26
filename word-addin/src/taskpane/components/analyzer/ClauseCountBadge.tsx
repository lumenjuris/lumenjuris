import * as React from "react";
import { ClauseRisk } from "../../core/types";

/** Pastille compacte : nombre de clauses détectées, teintée selon la sévérité la plus haute. */
const ClauseCountBadge: React.FC<{ clauses: ClauseRisk[] }> = ({ clauses }) => {
  const maxScore = Math.max(...clauses.map((c) => c.riskScore));
  const css = maxScore >= 4 ? "high" : maxScore >= 3 ? "medium" : "low";
  return (
    <span className={`lj-count-badge ${css}`}>
      {clauses.length} clause{clauses.length > 1 ? "s" : ""} détectée{clauses.length > 1 ? "s" : ""}
    </span>
  );
};

export default ClauseCountBadge;
