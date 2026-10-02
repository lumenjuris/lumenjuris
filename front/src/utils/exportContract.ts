// Téléchargement d'un contrat (texte brut) en Word ou en PDF.
// Utilisé par l'analyse des risques et par la négociation.
import { buildPdfFromText } from "../components/DashboardComponents/negotiation/buildPdfFromText";
import { textToBlocks } from "./contractBlocks";

export type ExportFormat = "docx" | "pdf";

/** Nom de fichier sans extension ni caractère interdit (ex : "Contrat / v2.pdf" → "Contrat - v2"). */
export function toExportBaseName(name: string | undefined): string {
  const base = (name || "document").replace(/\.[^/.]+$/, "").replace(/[\\/:*?"<>|]+/g, "-").trim();
  return base || "document";
}

/** Télécharge le texte en PDF sobre (même rendu que l'envoi en signature). */
export function downloadTextAsPdf(title: string, text: string, baseName: string): void {
  buildPdfFromText(title, text).save(`${baseName}.pdf`);
}

/**
 * Télécharge le texte en Word, mis en forme comme le PDF : titres en gras gardés
 * avec le paragraphe suivant, paragraphes justifiés, listes à puces, n° de page.
 * Titre du document facultatif (vide : le contrat porte déjà le sien).
 */
export async function downloadTextAsDocx(title: string, text: string, baseName: string): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, Footer, PageNumber } = await import("docx");
  const { saveAs } = await import("file-saver");

  const paragraphs = textToBlocks(text).map((block) => {
    if (block.kind === "heading") {
      return new Paragraph({ children: [new TextRun({ text: block.text, bold: true, size: 23 })], keepNext: true, spacing: { before: 280, after: 100 } });
    }
    if (block.kind === "item") {
      return new Paragraph({ children: [new TextRun(block.text)], bullet: { level: 0 }, alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 } });
    }
    return new Paragraph({ children: [new TextRun(block.text)], alignment: AlignmentType.JUSTIFIED, spacing: { after: 140 } });
  });
  if (title.trim()) {
    paragraphs.unshift(new Paragraph({ children: [new TextRun({ text: title.trim(), bold: true, size: 32 })], spacing: { after: 280 } }));
  }

  const wordDoc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22, color: "141414" }, paragraph: { spacing: { line: 276 } } } } },
    sections: [{
      properties: { page: { margin: { top: 1300, bottom: 1300, left: 1300, right: 1300 } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], size: 17, color: "787878" })],
          })],
        }),
      },
      children: paragraphs,
    }],
  });
  saveAs(await Packer.toBlob(wordDoc), `${baseName}.docx`);
}
