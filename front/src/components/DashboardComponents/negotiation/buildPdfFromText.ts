// PDF d'un contrat (négociation, complétion, export de l'analyse), même mise en page
// que l'export Word : titre centré, titres d'articles en gras, paragraphes justifiés,
// gras et italique d'origine, puces, numéros de page.
import { jsPDF } from "jspdf";
import { blockRuns, textToBlocks, type ContractBlock, type Run } from "../../../utils/contractBlocks";

const NAVY: [number, number, number] = [27, 48, 73];
const INK: [number, number, number] = [25, 25, 25];

type Word = { text: string; style: string; width: number; spaceBefore: boolean };

export function buildPdfFromText(title: string, text: string): jsPDF {
  return buildPdfFromBlocks(title, textToBlocks(text));
}

export function buildPdfFromBlocks(title: string, blocks: ContractBlock[]): jsPDF {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 64;
  const maxW = pageW - margin * 2;
  let y = margin;

  // Largeur réelle d'un mot : somme des largeurs de ses caractères. getTextWidth
  // rapproche certaines paires (« V. ») que le PDF n'applique pas : les mots se chevauchaient.
  const charWidths = new Map<string, number>();
  const measure = (text: string, style: string, size: number) => {
    let width = 0;
    for (const char of text) {
      const key = `${style}|${char}`;
      let unit = charWidths.get(key);
      if (unit === undefined) {
        pdf.setFont("helvetica", style);
        unit = pdf.getStringUnitWidth(char);
        charWidths.set(key, unit);
      }
      width += unit * size;
    }
    return width;
  };

  // Découpe les morceaux stylés en lignes de mots qui tiennent dans `width`.
  const layout = (runs: Run[], size: number, width: number, bold: boolean): Word[][] => {
    pdf.setFontSize(size);
    const words: Word[] = [];
    let pendingSpace = false;
    for (const run of runs) {
      const isBold = bold || run.bold;
      const style = isBold ? (run.italic ? "bolditalic" : "bold") : run.italic ? "italic" : "normal";
      for (const part of run.text.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { pendingSpace = true; continue; }
        words.push({ text: part, style, width: measure(part, style, size), spaceBefore: pendingSpace });
        pendingSpace = false;
      }
    }
    const space = measure(" ", "normal", size);
    const lines: Word[][] = [[]];
    let lineWidth = 0;
    for (const word of words) {
      const current = lines[lines.length - 1];
      const added = (current.length && word.spaceBefore ? space : 0) + word.width;
      if (current.length && lineWidth + added > width) { lines.push([word]); lineWidth = word.width; }
      else { current.push(word); lineWidth += added; }
    }
    return lines.filter((line) => line.length);
  };

  const write = (
    runs: Run[],
    o: { size: number; bold?: boolean; color?: [number, number, number]; indent?: number; center?: boolean; justify?: boolean; bullet?: boolean; before?: number; after: number; keepWithNext?: number },
  ) => {
    const lineH = o.size * 1.5;
    const x = margin + (o.indent ?? 0);
    const width = maxW - (o.indent ?? 0);
    const lines = layout(runs, o.size, width, Boolean(o.bold));
    const space = measure(" ", "normal", o.size);
    pdf.setTextColor(...(o.color ?? INK));
    y += o.before ?? 0;
    // Un titre ne reste jamais seul en bas de page (on réserve la place de la suite) ;
    // un paragraphe peut se couper, mais pas en laissant une ligne seule.
    const needed = o.keepWithNext !== undefined ? lineH * lines.length + o.keepWithNext : lineH * Math.min(2, lines.length);
    if (y + needed > pageH - margin) { pdf.addPage(); y = margin; }
    lines.forEach((line, i) => {
      if (y + lineH > pageH - margin) { pdf.addPage(); y = margin; }
      if (o.bullet && i === 0) { pdf.setFont("helvetica", "normal"); pdf.text("•", margin + 6, y); }
      const gaps = line.filter((word, j) => j > 0 && word.spaceBefore).length;
      const natural = line.reduce((sum, word, j) => sum + word.width + (j > 0 && word.spaceBefore ? space : 0), 0);
      // Justifié sauf la dernière ligne du paragraphe.
      const extra = o.justify && i < lines.length - 1 && gaps ? (width - natural) / gaps : 0;
      let cursor = o.center ? (pageW - natural) / 2 : x;
      line.forEach((word, j) => {
        if (j > 0 && word.spaceBefore) cursor += space + extra;
        pdf.setFont("helvetica", word.style);
        pdf.text(word.text, cursor, y);
        cursor += word.width;
      });
      y += lineH;
    });
    y += o.after;
  };

  const [first, ...rest] = blocks;
  const docTitle = title.trim() || (first?.kind === "heading" ? first.text : "");
  const body = !title.trim() && first?.kind === "heading" ? rest : blocks;
  if (docTitle) write([{ text: docTitle }], { size: 15, bold: true, color: NAVY, center: true, after: 18 });

  body.forEach((block, i) => {
    const runs = blockRuns(block);
    if (block.kind === "heading") {
      // « TITRE IV. » puis « RÉMUNÉRATION » : les titres qui se suivent restent ensemble.
      const keepWithNext = body[i + 1]?.kind === "heading" ? 70 : 32;
      write(runs, { size: 11, bold: true, color: NAVY, before: 10, after: 4, keepWithNext });
    } else if (block.kind === "item") {
      write(runs, { size: 10.5, indent: 18, justify: true, bullet: true, after: 4 });
    } else {
      write(runs, { size: 10.5, justify: true, after: 8 });
    }
  });

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(130, 130, 130);
    pdf.text(`${page} / ${pages}`, pageW / 2, pageH - 30, { align: "center" });
  }
  return pdf;
}
