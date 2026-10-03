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

  // Titre de la clause : bloc (et non flex) pour qu'un long mot comme
  // « validité/contrepartie/renonciation » passe à la ligne au lieu de déborder.
  const TITLE_CLASS = "block min-w-0 break-words [overflow-wrap:anywhere] text-sm leading-snug font-medium bg-white px-2.5 py-1.5 rounded-md border";
  const getRiskType = (riskScore: number) => {
    if (riskScore === 5) return `${TITLE_CLASS} text-red-card-primary border-red-800`
    if (riskScore >= 3)
      return `${TITLE_CLASS} text-yellow-card-text border-yellow-card-text`
    if (riskScore === -1)
      return `${TITLE_CLASS} text-blue-500 border-blue-300` //modified
    return `${TITLE_CLASS} text-green-card-primary border-green-800` // Modéré
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
        min-w-0 p-2.5 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md
        ${thisClauseIsModified ? "ring-1 ring-blue-500 bg-blue-50 " : getRiskColor(clause.riskScore)}
      `}
      >
        <div className="flex justify-between items-center gap-2 mb-1.5">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${thisClauseIsModified ? getRiskBadge(-1) : getRiskBadge(clause.riskScore)}`}
          >
            {!thisClauseIsModified
              ? `Risque ${getRiskLabel(clause.riskScore)} ${clause.riskScore}/5`
              : "Recommandation Appliquée"}
          </span>

          <span
            ref={iconRef}
            className="shrink-0 cursor-pointer text-gray-700 hover:text-gray-900"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onClick={(e) => e.stopPropagation()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
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
