import PDFDocument from "pdfkit";
import type { ContractBlock, ContractField } from "../../services/contractDocument.js";
import { BG_SOFT, INK, LINE, MUTED, drawLogo } from "./invoicePDF.js";

// Livrables PDF d'un achat unitaire (Pack Contrat) :
//  - le contrat sans filigrane ;
//  - la fiche de synthèse (v1 sans IA : informations lues dans le contrat).

type PdfDoc = InstanceType<typeof PDFDocument>;

// Même mise en page que l'export PDF du front (marges 56 pt, A4)
const MARGIN = 56;
const PAGE_W = 595.28;
const CONTENT_W = PAGE_W - MARGIN * 2;

/** Rassemble le flux pdfkit dans un Buffer. */
function renderToBuffer(doc: PdfDoc, draw: (doc: PdfDoc) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      draw(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

// ── Contrat ─────────────────────────────────────────────────────────────────

/** PDF du contrat, sans filigrane. */
export function generateContractPDF(title: string, blocks: ContractBlock[]): Promise<Buffer> {
  const doc: PdfDoc = new PDFDocument({
    size: "A4",
    margin: MARGIN,
    compress: true,
    info: { Title: title, Author: "Lumen Juris" },
  });

  return renderToBuffer(doc, (pdf) => {
    pdf.fillColor(INK);
    blocks.forEach((block, index) => {
      if (block.kind === "title") {
        pdf.font("Helvetica-Bold").fontSize(15).text(block.text, { width: CONTENT_W });
        pdf.moveDown(0.6);
      } else if (block.kind === "heading") {
        // Espace avant l'article (sauf en tête de document) pour le détacher du paragraphe précédent
        if (index > 0) pdf.moveDown(0.5);
        pdf.font("Helvetica-Bold").fontSize(11.5).text(block.text, { width: CONTENT_W });
        pdf.moveDown(0.3);
      } else {
        pdf.font("Helvetica").fontSize(10.5).text(block.text, { width: CONTENT_W, lineGap: 2 });
        pdf.moveDown(0.6);
      }
    });
  });
}

// ── Fiche de synthèse ───────────────────────────────────────────────────────

export type ContractSummaryData = {
  contractTitle: string;
  contractType: string | null;
  /** Date d'enregistrement du contrat en contrathèque */
  createdAt: Date;
  fields: ContractField[];
  /** Titres des articles, dans l'ordre */
  articleTitles: string[];
  purchaseReference: string;
  paidAt: Date | null;
};

/** Titre de section de la fiche (petites capitales, filet dessous). */
function sectionTitle(pdf: PdfDoc, label: string) {
  pdf.moveDown(1);
  pdf.font("Helvetica-Bold").fontSize(9).fillColor(MUTED)
    .text(label.toUpperCase(), MARGIN, pdf.y, { width: CONTENT_W, characterSpacing: 1 });
  const lineY = pdf.y + 3;
  pdf.moveTo(MARGIN, lineY).lineTo(MARGIN + CONTENT_W, lineY).lineWidth(0.5).strokeColor(LINE).stroke();
  pdf.y = lineY + 8;
  pdf.fillColor(INK);
}

/** Ligne « libellé : valeur » sur deux colonnes. */
function labelValueRow(pdf: PdfDoc, label: string, value: string) {
  const labelW = CONTENT_W * 0.38;
  const valueX = MARGIN + labelW + 10;
  const valueW = CONTENT_W - labelW - 10;
  const startY = pdf.y;

  pdf.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(label, MARGIN, startY, { width: labelW });
  const labelBottom = pdf.y;
  pdf.font("Helvetica").fontSize(9.5).fillColor(INK).text(value, valueX, startY, { width: valueW });
  pdf.y = Math.max(labelBottom, pdf.y) + 4;
}

/** Fiche récapitulative du contrat acheté. */
export function generateContractSummaryPDF(data: ContractSummaryData): Promise<Buffer> {
  const doc: PdfDoc = new PDFDocument({
    size: "A4",
    margin: MARGIN,
    compress: true,
    info: { Title: `Fiche de synthèse — ${data.contractTitle}`, Author: "Lumen Juris" },
  });

  return renderToBuffer(doc, (pdf) => {
    drawLogo(pdf, MARGIN, MARGIN);
    pdf.y = MARGIN + 40;

    pdf.font("Helvetica-Bold").fontSize(9).fillColor(MUTED)
      .text("FICHE DE SYNTHÈSE", MARGIN, pdf.y, { characterSpacing: 1 });
    pdf.moveDown(0.3);
    pdf.font("Helvetica-Bold").fontSize(18).fillColor(INK)
      .text(data.contractTitle, MARGIN, pdf.y, { width: CONTENT_W });

    sectionTitle(pdf, "Le contrat");
    labelValueRow(pdf, "Type de contrat", data.contractType || "Non précisé");
    labelValueRow(pdf, "Généré le", formatDate(data.createdAt));
    labelValueRow(pdf, "Nombre d'articles", String(data.articleTitles.length));

    sectionTitle(pdf, "Informations renseignées");
    if (data.fields.length === 0) {
      pdf.font("Helvetica").fontSize(9.5).fillColor(MUTED)
        .text("Aucun champ renseigné dans le contrat.", MARGIN, pdf.y, { width: CONTENT_W });
    } else {
      data.fields.forEach((field) => labelValueRow(pdf, field.label, field.value));
    }

    if (data.articleTitles.length > 0) {
      sectionTitle(pdf, "Plan du contrat");
      pdf.font("Helvetica").fontSize(9.5).fillColor(INK);
      data.articleTitles.forEach((articleTitle) => {
        pdf.text(`•  ${articleTitle}`, MARGIN, pdf.y, { width: CONTENT_W });
        pdf.moveDown(0.15);
      });
    }

    sectionTitle(pdf, "Achat");
    labelValueRow(pdf, "Référence", data.purchaseReference);
    labelValueRow(pdf, "Date d'achat", data.paidAt ? formatDate(data.paidAt) : "—");
    labelValueRow(pdf, "Formule", "Pack Contrat Professionnel — paiement unique");

    // Mention de prudence : la fiche ne remplace ni le contrat ni un conseil
    pdf.moveDown(1.5);
    const noteY = pdf.y;
    const noteText =
      "Ce document récapitule les informations saisies dans le contrat. Il ne remplace pas le contrat " +
      "lui-même, qui seul fait foi entre les parties, ni un conseil juridique adapté à votre situation.";
    const noteHeight = pdf.font("Helvetica").fontSize(8.5).heightOfString(noteText, { width: CONTENT_W - 20 });
    pdf.rect(MARGIN, noteY, CONTENT_W, noteHeight + 16).fill(BG_SOFT);
    pdf.fillColor(MUTED).text(noteText, MARGIN + 10, noteY + 8, { width: CONTENT_W - 20 });
  });
}
