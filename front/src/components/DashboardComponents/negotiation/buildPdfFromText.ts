// Construit un PDF sobre à partir du texte d'un contrat (négociation, complétion,
// export de l'analyse) : titres, paragraphes et listes reconstruits par
// textToBlocks, numéros de page en pied.
import { jsPDF } from "jspdf";
import { textToBlocks } from "../../../utils/contractBlocks";

export function buildPdfFromText(title: string, text: string): jsPDF {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 64;
  const maxW = pdf.internal.pageSize.getWidth() - margin * 2;
  const pageH = pdf.internal.pageSize.getHeight();
  let y = margin;

  const ensureRoom = (height: number) => {
    if (y + height > pageH - margin) { pdf.addPage(); y = margin; }
  };

  const write = (txt: string, opts: { size: number; bold?: boolean; indent?: number; gapAfter: number }) => {
    const lineH = opts.size * 1.45;
    const x = margin + (opts.indent ?? 0);
    const width = maxW - (opts.indent ?? 0);
    pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
    pdf.setFontSize(opts.size);
    const lines = pdf.splitTextToSize(txt, width) as string[];
    for (const line of lines) {
      ensureRoom(lineH);
      pdf.text(line, x, y);
      y += lineH;
    }
    y += opts.gapAfter;
  };

  pdf.setTextColor(20, 20, 20);
  if (title.trim()) write(title.trim(), { size: 16, bold: true, gapAfter: 14 });

  for (const block of textToBlocks(text)) {
    if (block.kind === "heading") {
      ensureRoom(50); // un titre ne reste jamais seul en bas de page
      y += 8;
      write(block.text, { size: 11.5, bold: true, gapAfter: 4 });
    } else if (block.kind === "item") {
      ensureRoom(16);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10.5);
      pdf.text("•", margin + 6, y);
      write(block.text, { size: 10.5, indent: 18, gapAfter: 3 });
    } else {
      write(block.text, { size: 10.5, gapAfter: 7 });
    }
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`${page} / ${pages}`, pdf.internal.pageSize.getWidth() / 2, pageH - 28, { align: "center" });
  }
  return pdf;
}
