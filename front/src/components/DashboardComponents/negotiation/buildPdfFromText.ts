// PDF d'un contrat (négociation, complétion, export de l'analyse), même mise en page
// que l'export Word : titre centré, titres d'articles en gras, paragraphes justifiés,
// puces, numéros de page.
import { jsPDF } from "jspdf";
import { textToBlocks, type ContractBlock } from "../../../utils/contractBlocks";

const NAVY: [number, number, number] = [27, 48, 73];
const INK: [number, number, number] = [25, 25, 25];

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

  const write = (
    txt: string,
    o: { size: number; bold?: boolean; color?: [number, number, number]; indent?: number; center?: boolean; justify?: boolean; bullet?: boolean; before?: number; after: number; keepWithNext?: number },
  ) => {
    const lineH = o.size * 1.5;
    const x = margin + (o.indent ?? 0);
    const width = maxW - (o.indent ?? 0);
    pdf.setFont("helvetica", o.bold ? "bold" : "normal");
    pdf.setFontSize(o.size);
    pdf.setTextColor(...(o.color ?? INK));
    const lines = pdf.splitTextToSize(txt, width) as string[];
    y += o.before ?? 0;
    // Un titre ne reste jamais seul en bas de page (on réserve la place de la suite) ;
    // un paragraphe peut se couper, mais pas en laissant une ligne seule.
    const needed = o.keepWithNext !== undefined ? lineH * lines.length + o.keepWithNext : lineH * Math.min(2, lines.length);
    if (y + needed > pageH - margin) { pdf.addPage(); y = margin; }
    lines.forEach((line, i) => {
      if (y + lineH > pageH - margin) { pdf.addPage(); y = margin; }
      if (o.bullet && i === 0) pdf.text("•", margin + 6, y); // sur la même page que sa première ligne
      if (o.center) pdf.text(line, pageW / 2, y, { align: "center" });
      // jsPDF ne justifie pas la dernière ligne d'un texte : on lui en donne une vide.
      else if (o.justify && i < lines.length - 1) pdf.text([line, ""], x, y, { align: "justify", maxWidth: width });
      else pdf.text(line, x, y);
      y += lineH;
    });
    y += o.after;
  };

  const [first, ...rest] = blocks;
  const docTitle = title.trim() || (first?.kind === "heading" ? first.text : "");
  const body = !title.trim() && first?.kind === "heading" ? rest : blocks;
  if (docTitle) write(docTitle, { size: 15, bold: true, color: NAVY, center: true, after: 18 });

  for (const block of body) {
    if (block.kind === "heading") {
      write(block.text, { size: 11, bold: true, color: NAVY, before: 10, after: 4, keepWithNext: 32 });
    } else if (block.kind === "item") {
      write(block.text, { size: 10.5, indent: 18, justify: true, bullet: true, after: 4 });
    } else {
      write(block.text, { size: 10.5, justify: true, after: 8 });
    }
  }

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
