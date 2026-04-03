import { ClauseRisk } from "../../types";
import { TextPatch } from "../../store/documentTextStore";
import { findBestClauseSpan } from "../textPatchLocator";

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

interface TextNodeEntry {
  node: Text;
  start: number;
  end: number;
}

function buildTextNodeMap(root: Element): TextNodeEntry[] {
  const result: TextNodeEntry[] = [];
  let offset = 0;

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text.length > 0) {
        result.push({ node: node as Text, start: offset, end: offset + text.length });
        offset += text.length;
      }
    } else {
      for (const child of Array.from(node.childNodes)) {
        walk(child);
      }
    }
  };

  walk(root);
  return result;
}

/**
 * Injecte les spans de clauses dans le HTML formaté issu du backend.
 * Utilise l'API Range du DOM pour un découpage correct des nœuds texte,
 * y compris quand la clause chevauche des éléments inline (<strong>, <em>).
 * Traite les clauses en ordre décroissant de position pour ne pas perturber les offsets.
 */
export function injectClausesIntoHtml(
  baseHtml: string,
  clauses: ClauseRisk[],
  patches: TextPatch[]
): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(baseHtml, "text/html");
  const root = doc.body;

  // Texte total du HTML : base pour findBestClauseSpan
  const htmlText = root.textContent || "";
  if (!htmlText.trim()) return baseHtml;

  // Calculer les ranges de chaque clause sur le texte extrait du HTML
  const clauseRanges: Array<{ start: number; end: number; clauseId: string }> = [];
  for (const clause of clauses) {
    const range = findBestClauseSpan(htmlText, clause);
    if (range) {
      clauseRanges.push({ start: range.start, end: range.end, clauseId: clause.id });
    }
  }

  // Tri décroissant par start : on injecte de la fin vers le début
  // → les offsets des ranges non encore traités restent valides
  clauseRanges.sort((a, b) => b.start - a.start);

  for (const { start, end, clauseId } of clauseRanges) {
    const clause = clauses.find((c) => c.id === clauseId)!;
    const patch = patches.find((p) => p.clauseId === clauseId && p.active);
    const riskScore = patch ? 10 : (clause.riskScore ?? 3);
    const style = setCssClauseInlineStyle(riskScore);

    // Reconstruire la map à chaque fois car le DOM a pu changer
    const nodeMap = buildTextNodeMap(root);

    // Trouver les nœuds texte qui recouvrent [start, end)
    const first = nodeMap.find((n) => n.start <= start && n.end > start);
    const last = nodeMap.find((n) => n.start < end && n.end >= end);

    if (!first || !last) continue;

    const domRange = doc.createRange();
    domRange.setStart(first.node, start - first.start);
    domRange.setEnd(last.node, end - last.start);

    const span = doc.createElement("span");
    span.setAttribute("data-clause-risk-id", clauseId);
    span.setAttribute("style", style);

    if (patch) {
      // Remplacer le contenu par le texte de la recommandation appliquée
      span.textContent = patch.newSlice;
      domRange.deleteContents();
      domRange.insertNode(span);
    } else {
      // Déplacer le contenu sélectionné (avec son formatage inline) dans le span
      span.appendChild(domRange.extractContents());
      domRange.insertNode(span);
    }
  }

  return root.innerHTML;
}
