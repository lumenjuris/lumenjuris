import { escapeHtml } from "./escapeHtml";
import { TextPatch } from "../../store/documentTextStore";
import { ClauseRisk } from "../../types";

// CSS inline car Tailwind via les class n'est pas compatible avec le Quill
const setCssClauseInlineStyle = (clauseRisk: number): string => {
  const colorMap: Record<number, string> = {
    1: "background-color:#dcfce7;border-bottom:2px solid #bbf7d0;",
    2: "background-color:#dcfce7;border-bottom:2px solid #bbf7d0;",
    3: "background-color:#ffedd5;border-bottom:2px solid #fed7aa;",
    4: "background-color:#ffedd5;border-bottom:2px solid #fed7aa;",
    5: "background-color:#fee2e2;border-bottom:2px solid #fecaca;",
    10: "background-color:#dbeafe;border-bottom:2px solid #bfdbfe;",
  };
  const base = "cursor:pointer;user-select:none;padding:1px;line-height:30px;";
  return (colorMap[clauseRisk] || "background-color:#ffedd5;") + base;
};

const startsNewArticle = (str: string) =>
  str.startsWith("Article") || str.startsWith("ARTICLE");

interface formatContentToHtmlProps {
  text: string;
  clauseRiskRange: { start: number; end: number; clauseId: string }[];
  patches: TextPatch[];
  clauses: ClauseRisk[];
}

export const formatContentToHtml = ({
  text,
  clauseRiskRange,
  patches,
  clauses,
}: formatContentToHtmlProps): string => {
  if (!text.trim()) return "";

  const htmlParts: string[] = [];
  let cursor = 0;

  const processTextFragment = (fragment: string) => {
    const paragraphs = fragment
      .split("\n\n")
      .filter((paragraph) => paragraph.trim());
    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (!trimmed) continue;
      if (startsNewArticle(trimmed)) {
        const title = escapeHtml(trimmed.replace(/^##\s*/, ""));
        htmlParts.push(
          `<h3 style="font-size:1.125rem;color:#111827;border-bottom:1px solid #e5e7eb;padding-bottom:0.5rem;margin-top:2rem;margin-bottom:1.5rem;">\n${title}</h3><br/>`,
        );
      } else {
        const escaped = escapeHtml(trimmed).replace(/\n\n/g, "<br/>");
        htmlParts.push(
          `<p style="margin-bottom:1rem;line-height:1.625;color:#1f2937;">${escaped}</p><br/>`,
        );
      }
    }
  };

  for (const range of clauseRiskRange) {
    const { start, end, clauseId } = range;

    processTextFragment(text.slice(cursor, start));

    const clause = text.slice(start, end);
    const isPatched = patches.some(
      (patch) => patch.clauseId === clauseId && patch.active,
    );
    const displayText = isPatched
      ? (patches.find((patch) => patch.clauseId === clauseId && patch.active)
          ?.newSlice ?? clause)
      : clause;

    const clauseRisk =
      clauses.find((clause) => clause.id === clauseId)?.riskScore ?? 3;
    const style = setCssClauseInlineStyle(isPatched ? 10 : clauseRisk);
    const escapedClause = escapeHtml(displayText).replace(/\n\n/g, "<br/>");

    htmlParts.push(
      `<span style="${style}" data-clause-risk-id="${clauseId}">${escapedClause}</span>`,
    );

    cursor = end;
  }

  if (cursor < text.length) {
    processTextFragment(text.slice(cursor));
  }

  return htmlParts.join("");
};
