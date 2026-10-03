// Téléchargement d'un contrat en Word ou en PDF, avec la même mise en page :
// titre centré, titres d'articles en gras, paragraphes justifiés, puces, n° de page.
// Utilisé par l'analyse des risques, la négociation et l'analyse playbook.
import { buildPdfFromBlocks } from "../components/DashboardComponents/negotiation/buildPdfFromText";
import { blockRuns, textToBlocks, type ContractBlock } from "./contractBlocks";

export type ExportFormat = "docx" | "pdf";

/** Nom de fichier sans extension ni caractère interdit (ex : "Contrat / v2.pdf" → "Contrat - v2"). */
export function toExportBaseName(name: string | undefined): string {
  const base = (name || "document").replace(/\.[^/.]+$/, "").replace(/[\\/:*?"<>|]+/g, "-").trim();
  return base || "document";
}

export function downloadTextAsPdf(title: string, text: string, baseName: string): void {
  downloadBlocksAsPdf(title, textToBlocks(text), baseName);
}

export function downloadTextAsDocx(title: string, text: string, baseName: string): Promise<void> {
  return downloadBlocksAsDocx(title, textToBlocks(text), baseName);
}

export function downloadBlocksAsPdf(title: string, blocks: ContractBlock[], baseName: string): void {
  buildPdfFromBlocks(title, blocks).save(`${baseName}.pdf`);
}

export async function downloadBlocksAsDocx(title: string, blocks: ContractBlock[], baseName: string): Promise<void> {
  const { saveAs } = await import("file-saver");
  saveAs(await buildDocxBlob(title, blocks), `${baseName}.docx`);
}

/** Sans titre fourni, le premier titre du contrat sert de titre du document (comme le PDF). */
export async function buildDocxBlob(title: string, blocks: ContractBlock[]): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, Footer, PageNumber } = await import("docx");

  const NAVY = "1B3049";
  const [first, ...rest] = blocks;
  const docTitle = title.trim() || (first?.kind === "heading" ? first.text : "");
  const body = !title.trim() && first?.kind === "heading" ? rest : blocks;

  // Gras et italique d'origine conservés, morceau par morceau.
  const textRuns = (block: ContractBlock, heading: boolean) =>
    blockRuns(block).map((run) => new TextRun({
      text: run.text,
      bold: heading || run.bold,
      italics: run.italic,
      ...(heading ? { size: 22, color: NAVY } : {}),
    }));

  const paragraphs = body.map((block) => {
    if (block.kind === "heading") {
      return new Paragraph({ children: textRuns(block, true), keepNext: true, spacing: { before: 240, after: 80 } });
    }
    return new Paragraph({
      children: textRuns(block, false),
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: block.kind === "item" ? 60 : 140 },
      ...(block.kind === "item" ? { bullet: { level: 0 } } : {}),
    });
  });
  if (docTitle) {
    paragraphs.unshift(new Paragraph({ children: [new TextRun({ text: docTitle, bold: true, size: 30, color: NAVY })], alignment: AlignmentType.CENTER, spacing: { after: 360 } }));
  }

  const wordDoc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 21, color: "191919" }, paragraph: { spacing: { line: 300 } } } } },
    sections: [{
      properties: { page: { margin: { top: 1280, bottom: 1280, left: 1280, right: 1280 } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], size: 17, color: "828282" })],
          })],
        }),
      },
      children: paragraphs,
    }],
  });
  return Packer.toBlob(wordDoc);
}
