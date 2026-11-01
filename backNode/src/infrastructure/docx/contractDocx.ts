import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { ContractBlock } from "../../services/contractDocument.js";

// Livrable Word d'un achat unitaire (Pack Contrat) : le contrat modifiable, sans filigrane.
// Même mise en forme que l'export Word du front (Calibri 11, marges 2,5 / 3,2 cm).

/** Word ignore les "\n" dans un TextRun : chaque ligne devient un run avec un retour à la ligne avant. */
function textRunsWithLineBreaks(text: string, bold = false): TextRun[] {
  return text.split("\n").map((line, index) => new TextRun({ text: line, bold, break: index > 0 ? 1 : undefined }));
}

/** Fichier Word du contrat. */
export function generateContractDocx(blocks: ContractBlock[]): Promise<Buffer> {
  const children = blocks.map((block) => {
    if (block.kind === "paragraph") {
      return new Paragraph({ spacing: { after: 120 }, children: textRunsWithLineBreaks(block.text) });
    }
    const isTitle = block.kind === "title";
    return new Paragraph({
      heading: isTitle ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
      alignment: isTitle ? AlignmentType.CENTER : undefined,
      spacing: { before: 240, after: 120 },
      children: textRunsWithLineBreaks(block.text, true),
    });
  });

  const wordDoc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { line: 276 } } } } },
    sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1800, right: 1800 } } }, children }],
  });
  return Packer.toBuffer(wordDoc);
}
