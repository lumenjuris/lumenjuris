import { useRef, useState } from "react";
import { ClauseRisk } from "../../types";
import { ClauseTooltip } from "./ClauseTooltip";
import { TextPatch } from "../../store/documentTextStore";

interface PropsClauseCard {
  clause: ClauseRisk;
  onClick: () => void;
  recommandationApplied?: TextPatch[];
}
export function ClauseRiskCard({
  clause,
  onClick,
  recommandationApplied,
}: PropsClauseCard) {
  const iconRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  const getRiskColor = (riskScore: number) => {
    if (riskScore === 5) return "bg-red-card-primary border-red-600 text-red-900"; // Critique
    if (riskScore >= 3)
      return "bg-yellow-card-primary border-black text-orange-800"; // Moyen
    return "bg-green-card-primary border-green-800 text-green-900"; // Modéré
  };

  const getRiskBadge = (riskScore: number) => {
    if (riskScore === 5) return "text-red-card-primary bg-white border border-black"; // Critique
    if (riskScore >= 3)
      return "border-yellow-card-text bg-white text-yellow-card-text border"; // Moyen
    if (riskScore === -1)
      return "border-blue-300 bg-white border text-blue-500"; //modified
      return "border-green-700 bg-white border text-green-card-primary"; // Modéré
  };

  const getRiskLabel = (riskScore: number) => {
    if (riskScore === 5) return "Critique";
    if (riskScore >= 3) return "Moyen";
    return "Modéré";
  };

  const getRiskType = (riskScore: number) => {
    if (riskScore === 5) return "flex font-medium text-red-card-primary bg-white p-2 rounded-lg border border-red-800"
    if (riskScore >= 3) 
      return "flex font-medium text-yellow-card-text bg-white p-2 rounded-lg border border-yellow-card-text"
    return "flex font-medium text-green-card-primary bg-white p-2 rounded-lg border border-green-800"
  }

  const thisClauseIsModified = recommandationApplied?.some(
    (reco) => reco.clauseId == clause.id && reco.active == true,
  );

  //Retour du JSX
  return (
    clause && (
      <div
        onClick={onClick}
        className={`
        p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md
        ${thisClauseIsModified ? "ring-1 ring-blue-500 bg-blue-50 " : getRiskColor(clause.riskScore)}
      `}
      >
        <div className="flex justify-between items-start mb-2">
          <span
            className={`px-4 py-2 rounded-full text-xs font-medium ${thisClauseIsModified ? getRiskBadge(-1) : getRiskBadge(clause.riskScore)}`}
          >
            {!thisClauseIsModified
              ? `Risque ${getRiskLabel(clause.riskScore)} ${clause.riskScore}/5`
              : "Recommandation Appliquée"}
          </span>

          <span
            ref={iconRef}
            className="cursor-pointer text-gray-700 hover:text-gray-900"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onClick={(e) => e.stopPropagation()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-circle-question-mark-icon"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </span>

          <ClauseTooltip
            anchorRef={iconRef}
            open={open}
            content={clause.content.split(" ").slice(0, 18).join(" ") + " …"}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          />
        </div>

        <div className={getRiskType(thisClauseIsModified ? -1 : clause.riskScore)}>
          {clause.type || "Clause générale"}
        </div>
      </div>
    )
  );
}
