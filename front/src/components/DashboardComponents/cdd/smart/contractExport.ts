// Construction des fichiers d'un contrat (PDF / Word) à partir du contenu de l'éditeur.
// Sorti de SmartCddEditor pour alléger l'éditeur. Les documents sans filigrane d'un
// achat (Pack Contrat) sont, eux, générés par le backend (voir ContractPackComponents).
import { jsPDF } from "jspdf";

/** Nœud du document TipTap (sortie de `editor.getJSON()`). */
export type JNode = { type: string; attrs?: Record<string, unknown>; text?: string; content?: JNode[] };

const FILIGRANE_TEXT = "Généré par Lumen Juris";

/** Texte d'un bloc, avec la valeur saisie à la place de chaque champ. */
export function inlineText(nodes?: JNode[]): string {
  if (!nodes) return "";
  return nodes
    .map((n) =>
      n.type === "text" ? n.text ?? ""
        : n.type === "hardBreak" ? "\n"
          : n.type === "variable" ? (String(n.attrs?.value || "") || "…")
            : inlineText(n.content),
    )
    .join("");
}

/** Encadré « Généré par Lumen Juris » : en haut à droite de la 1re page, en bas des suivantes. */
function addFiligraneToPdf(pdf: jsPDF, pageWidth: number, margin: number, pageH: number) {
  const totalPages = pdf.getNumberOfPages();
  const rightX = pageWidth - margin;
  const center = pageWidth / 2;
  const paddingX = 8;
  const paddingY = 4;
  const fontSize = 10;
  const borderRadius = 4;

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor("#213957");
    pdf.setDrawColor("#213957");
    pdf.setLineWidth(1);

    const textWidth = pdf.getTextWidth(FILIGRANE_TEXT);
    const boxW = textWidth + paddingX * 2;
    const boxH = fontSize + 2 * paddingY;

    if (i === 1) {
      const centerY = 32;
      const boxX = rightX - boxW;
      const boxY = centerY - fontSize;
      pdf.roundedRect(boxX, boxY, boxW, boxH, borderRadius, borderRadius, "S")
      pdf.text(FILIGRANE_TEXT, rightX - paddingX, centerY, { align: "right", baseline: "middle" });
    } else {
      const centerY = pageH - 32;
      const boxX = center - boxW / 2;
      const boxY = centerY - fontSize;
      pdf.roundedRect(boxX, boxY, boxW, boxH, borderRadius, borderRadius, "S");
      pdf.text(FILIGRANE_TEXT, center, centerY, { align: "center", baseline: "middle" });
    }
  }
}

/** Construit le PDF du contrat (réutilisé pour l'export, la signature et la contrathèque). */
export function buildContractPdf(json: JNode, withFiligrane: boolean): jsPDF {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56, maxW = pdf.internal.pageSize.getWidth() - margin * 2, pageH = pdf.internal.pageSize.getHeight();
  const pageWidth = pdf.internal.pageSize.getWidth();
  let y = margin;
  const block = (txt: string, bold: boolean, size: number, gap = 8) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(size);
    for (const line of pdf.splitTextToSize(txt || " ", maxW) as string[]) {
      if (y + size + 2 > pageH - margin) { pdf.addPage(); y = margin; }
      pdf.text(line, margin, y); y += size + 2;
    }
    y += gap;
  };
  for (const n of json.content ?? []) {
    const txt = inlineText(n.content);
    if (n.type === "heading") {
      // Espace avant le titre (sauf en haut de page) pour le détacher du paragraphe précédent.
      if (y > margin) y += 8;
      block(txt, true, n.attrs?.level === 2 ? 15 : 11.5, 4);
    }
    else if (txt.trim()) block(txt, false, 10.5, 8);
  }
  if (withFiligrane) {
    addFiligraneToPdf(pdf, pageWidth, margin, pageH);
  }
  return pdf;
}

/** PDF du contrat encodé en base64 (format attendu par la contrathèque). */
export function contractPdfBase64(json: JNode, withFiligrane: boolean): string {
  const dataUri = buildContractPdf(json, withFiligrane).output("datauristring");
  return dataUri.split(",")[1] ?? "";
}

/** Construit le fichier Word du contrat. */
export async function buildContractDocx(json: JNode, withFiligrane: boolean): Promise<Blob> {
  const docx = await import("docx");
  const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Header, Footer } = docx;
  // Word ignore les "\n" dans un TextRun : chaque ligne devient un run avec un retour à la ligne avant.

  const textRunsWithLineBreaks = (txt: string, bold = false) =>
    txt.split("\n").map((line, index) => new TextRun({ text: line, bold, break: index > 0 ? 1 : undefined }));
  const children = (json.content ?? []).map((n) => {
    const txt = inlineText(n.content);
    if (n.type === "heading") {
      const isTitle = n.attrs?.level === 2;
      return new Paragraph({
        heading: isTitle ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
        alignment: isTitle ? AlignmentType.CENTER : undefined,
        spacing: { before: 240, after: 120 },
        children: textRunsWithLineBreaks(txt, true),
      });
    }
    return new Paragraph({ spacing: { after: 120 }, children: textRunsWithLineBreaks(txt) });
  });

  const waterMark = new TextRun({
    text: FILIGRANE_TEXT, bold: true, size: 18, color: "213957"
  })
  const firstPageHeader = new Header({
    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [waterMark] })],
  })
  const footer = new Footer({
    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [waterMark] })],
  })
  const wordDoc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { line: 276 } } } } },
    sections: [
      {
        properties: {
          page: { margin: { top: 1440, bottom: 1440, left: 1800, right: 1800 } },
          titlePage: withFiligrane,
        },
        headers:
          withFiligrane
            ? { first: firstPageHeader }
            : undefined,
        footers: withFiligrane
          ? { default: footer }
          : undefined,
        children
      }],
  });
  return docx.Packer.toBlob(wordDoc);
}

/** Déclenche le téléchargement d'un fichier dans le navigateur. */
export async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  const { saveAs } = await import("file-saver");
  saveAs(blob, fileName);
}
