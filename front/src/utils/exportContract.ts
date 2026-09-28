// Téléchargement d'un contrat (texte brut) en Word ou en PDF.
// Utilisé par l'analyse des risques et par la négociation.
import { buildPdfFromText } from "../components/DashboardComponents/negotiation/buildPdfFromText";

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

/** Télécharge le texte en Word : un titre, puis un paragraphe par bloc séparé d'une ligne vide. */
export async function downloadTextAsDocx(title: string, text: string, baseName: string): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const { saveAs } = await import("file-saver");

  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.replace(/\n/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter(Boolean)
    .map((block) => new Paragraph({ children: [new TextRun({ text: block })], spacing: { after: 160 } }));

  const wordDoc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { line: 276 } } } } },
    sections: [{
      properties: { page: { margin: { top: 1440, bottom: 1440, left: 1800, right: 1800 } } },
      children: [new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, spacing: { after: 240 } }), ...paragraphs],
    }],
  });
  saveAs(await Packer.toBlob(wordDoc), `${baseName}.docx`);
}
