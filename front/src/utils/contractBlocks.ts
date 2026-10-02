// Reconstruit la structure d'un contrat à partir de son texte brut, pour l'exporter
// proprement en Word ou en PDF. Le texte extrait d'un PDF arrive coupé ligne par
// ligne : sans ce travail, l'export collait tout en un bloc ou gardait les coupures.

export type ContractBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "item"; text: string };

const HEADING_WORDS = /^(article|art\.|chapitre|titre|section|sous-section|annexe|pr[ée]ambule|expos[ée]|entre les soussign[ée]s|fait [àa] )/i;
const ROMAN_HEADING = /^[IVXLC]+\s*[.\-–—)]\s+\S/;
const NUMBERED_HEADING = /^\d+(\.\d+)*\s*[.)–-]?\s+[A-ZÀ-Ý]/;
const ITEM = /^([-•·▪●◦*]|[a-z]\)|\d+\)|[ivx]+\))\s+/i;
const MAX_HEADING_LENGTH = 100;

function isUpperCaseLine(line: string): boolean {
  const letters = line.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
}

function isHeading(line: string): boolean {
  if (line.length > MAX_HEADING_LENGTH || /[,;]$/.test(line)) return false;
  if (HEADING_WORDS.test(line) && !/^fait [àa] /i.test(line)) return line.length <= 80 || /^article/i.test(line);
  return ROMAN_HEADING.test(line) || (NUMBERED_HEADING.test(line) && !/\.$/.test(line)) || isUpperCaseLine(line);
}

/** « Article 1 : Les époux… » sur une seule ligne : titre court + texte. */
function splitHeadingAndBody(line: string): [string, string] | null {
  if (!/^(article|art\.|chapitre|titre|section|annexe|\d+(\.\d+)*|[IVXLC]+)\b/i.test(line)) return null;
  const match = line.match(/^(.{1,80}?)\s*[:–—]\s+(.{20,})$/);
  if (!match) return null;
  // La suite doit être une phrase (pas « DOCUMENTS CONTRACTUELS ET ORDRE DE PRIORITÉ »).
  const body = match[2].trim();
  const isSentence = body !== body.toUpperCase() && (body.split(/\s+/).length >= 8 || /[.;]$/.test(body));
  return isSentence ? [match[1].trim(), body] : null;
}

export function textToBlocks(text: string): ContractBlock[] {
  const lines = text.replace(/\r/g, "").split("\n").map((line) => line.replace(/\s+/g, " ").trim());

  // Longueur d'une ligne « pleine » : une ligne nettement plus courte qui finit une
  // phrase termine aussi le paragraphe.
  const lengths = lines.filter(Boolean).map((line) => line.length).sort((a, b) => a - b);
  const fullLine = lengths.length ? lengths[Math.floor(lengths.length * 0.9)] : 0;

  const blocks: ContractBlock[] = [];
  let current: { kind: "paragraph" | "item"; parts: string[]; lastLine: string } | null = null;

  const flush = () => {
    if (current) blocks.push({ kind: current.kind, text: current.parts.join(" ") });
    current = null;
  };

  for (const line of lines) {
    if (!line) { flush(); continue; }

    const split = splitHeadingAndBody(line);
    if (split) {
      flush();
      blocks.push({ kind: "heading", text: split[0] });
      current = { kind: "paragraph", parts: [split[1]], lastLine: line };
      continue;
    }
    if (isHeading(line)) {
      flush();
      blocks.push({ kind: "heading", text: line });
      continue;
    }
    if (ITEM.test(line)) {
      flush();
      current = { kind: "item", parts: [line.replace(ITEM, "")], lastLine: line };
      continue;
    }

    // La ligne continue le paragraphe si elle commence en minuscule, ou si la
    // précédente est pleine, ou si elle s'arrête au milieu d'une phrase sans être courte.
    const previous = current?.lastLine ?? "";
    const continuesParagraph =
      current !== null &&
      (/^[a-zà-ÿ(]/.test(line) ||
        previous.length >= fullLine * 0.85 ||
        (!/[.:;!?»"]$/.test(previous) && previous.length >= fullLine * 0.6));
    if (current && continuesParagraph) {
      current.parts.push(line);
      current.lastLine = line;
    } else {
      flush();
      current = { kind: "paragraph", parts: [line], lastLine: line };
    }
  }
  flush();
  return blocks;
}
