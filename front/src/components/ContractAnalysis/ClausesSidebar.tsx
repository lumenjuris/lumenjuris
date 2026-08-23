import React from "react";
import { ShieldAlert } from "lucide-react";
import { ClauseRisk } from "../../types";
import { ClauseRiskCard } from "./ClauseRiskCard";
import { TextPatch } from "../../store/documentTextStore";

interface ClausesSidebarProps {
  clauses: ClauseRisk[];
  onClauseClick?: (clause: ClauseRisk, index: number) => void;
  isVisible: boolean;
  activeClauseId?: string | null;
  recommandationApplied?: TextPatch[];
}

const LEGEND = [
  { label: "Critique", dot: "bg-red-500", text: "text-red-700" },
  { label: "Moyen", dot: "bg-orange-400", text: "text-orange-700" },
  { label: "Modéré", dot: "bg-green-500", text: "text-green-700" },
] as const;

export const ClausesSidebar: React.FC<ClausesSidebarProps> = ({
  clauses,
  onClauseClick,
  isVisible = true,
  recommandationApplied,
}) => {
  if (!isVisible || !clauses || clauses.length === 0) {
    return null;
  }

  const handleClauseClick = (clause: ClauseRisk, index: number) => {
    if (onClauseClick) {
      onClauseClick(clause, index);
    }
  };

  const critiqueCount = clauses.filter((c) => c.riskScore === 5).length;
  const moyenCount = clauses.filter(
    (c) => c.riskScore >= 3 && c.riskScore < 5,
  ).length;

  return (
    <div className="w-full md:w-80 bg-white border rounded-lg flex flex-col h-fit">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-blue-primary border-b border-gray-100 px-4 pt-4 pb-3 rounded-t-lg">
        {/* Title + count */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-gray-500 stroke-[1.5]" />
            <span className="text-sm font-semibold text-white tracking-tight">
              Risques détectés
            </span>
          </div>
          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {clauses.length}
          </span>
        </div>

        {/* Summary counters */}
        {(critiqueCount > 0 || moyenCount > 0) && (
          <div className="flex gap-2 mb-3">
            {critiqueCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                {critiqueCount} critique{critiqueCount > 1 ? "s" : ""}
              </span>
            )}
            {moyenCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-700 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
                {moyenCount} moyen{moyenCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* Color legend */}
        <div className="flex items-center gap-3 text-[11px] border-t border-white bg-white px-2.5 py-1.5 rounded-xl">
          <span className="text-blue-primary font-medium uppercase tracking-wider text-[10px]">
            Légende
          </span>
          {LEGEND.map(({ label, dot, text }) => (
            <span
              key={label}
              className={`flex items-center gap-1 font-medium ${text}`}
            >
              <span className={`w-2 h-2 rounded-full ${dot} inline-block`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Clauses list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {clauses.map((clause, index) => (
          <ClauseRiskCard
            key={clause.id}
            clause={clause}
            onClick={() => handleClauseClick(clause, index)}
            recommandationApplied={recommandationApplied}
          />
        ))}
      </div>
    </div>
  );
};
