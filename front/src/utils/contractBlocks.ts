// Reconstruit la structure d'un contrat à partir de son texte brut, pour l'exporter
// proprement en Word ou en PDF. Le texte extrait d'un PDF arrive coupé ligne par
// ligne : sans ce travail, l'export collait tout en un bloc ou gardait les coupures.

/** Morceau de texte avec son style (gras, italique), repris du document d'origine. */
export type Run = { text: string; bold?: boolean; italic?: boolean };

export type ContractBlock = {
  kind: "heading" | "paragraph" | "item";
  text: string;
  /** Styles d'origine ; absents pour un texte brut (un seul morceau, sans style). */
  runs?: Run[];
};

/** Morceaux d'un bloc : ses styles d'origine, ou tout son texte sans style. */
export function blockRuns(block: ContractBlock): Run[] {
  return block.runs ?? [{ text: block.text }];
}

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

const BLOCK_SELECTOR = "h1,h2,h3,h4,h5,h6,p,li,blockquote,td,th";

/**
 * Blocs d'un contrat en HTML (document affiché dans l'analyse) : on garde la
 * structure d'origine (titres, paragraphes, listes) et on ne devine que dans les
 * paragraphes (« Article 1 : … », lignes séparées par des retours à la ligne).
 */
export function htmlToBlocks(html: string): ContractBlock[] {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  body.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  const blocks: ContractBlock[] = [];
  for (const el of Array.from(body.querySelectorAll<HTMLElement>(BLOCK_SELECTOR))) {
    if (el.parentElement?.closest(BLOCK_SELECTOR)) continue; // déjà pris par son bloc parent
    const text = (el.textContent ?? "").trim();
    if (!text) continue;
    const oneLine = text.replace(/\s+/g, " ");
    // Plusieurs lignes ou « Article 1 : texte » (contrat issu d'un PDF) : on redécoupe le texte.
    if (el.tagName !== "LI" && (text.includes("\n") || splitHeadingAndBody(oneLine))) {
      blocks.push(...textToBlocks(text));
      continue;
    }
    const runs = elementRuns(el);
    const fullyBold = runs.every((run) => run.bold || !run.text.trim());
    const kind =
      /^H\d$/.test(el.tagName) || (oneLine.length <= MAX_HEADING_LENGTH && (fullyBold || isUpperCaseLine(oneLine)))
        ? "heading"
        : el.tagName === "LI" ? "item" : "paragraph";
    blocks.push({ kind, text: oneLine, runs });
  }
  return blocks.length ? blocks : textToBlocks(body.textContent ?? "");
}

/** Morceaux stylés d'un élément HTML, espaces regroupés comme à l'affichage. */
function elementRuns(el: HTMLElement): Run[] {
  const runs: Run[] = [];
  const walk = (node: Node, bold: boolean, italic: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").replace(/\s+/g, " ");
      const last = runs[runs.length - 1];
      if (last && last.bold === bold && last.italic === italic) last.text += text;
      else if (text) runs.push({ text, bold, italic });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName;
    node.childNodes.forEach((child) =>
      walk(child, bold || tag === "STRONG" || tag === "B", italic || tag === "EM" || tag === "I"));
  };
  walk(el, false, false);
  // Espaces en double à la jonction de deux morceaux, et en début / fin de bloc.
  runs.forEach((run, i) => { if (i > 0 && runs[i - 1].text.endsWith(" ")) run.text = run.text.replace(/^ /, ""); });
  if (runs[0]) runs[0].text = runs[0].text.trimStart();
  if (runs.length) runs[runs.length - 1].text = runs[runs.length - 1].text.trimEnd();
  return runs.filter((run) => run.text);
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
