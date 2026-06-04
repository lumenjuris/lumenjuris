import PDFDocument from "pdfkit";

export type InvoiceData = {
  invoiceNumber: string;
  date: Date;
  customerName: string;
  customerEmail: string;
  planName: string;
  interval: string;
  amountTTCCents: number;
  stripePaymentIntentId?: string;
};

const PURPLE = "#716af9";
const GRAY_DARK = "#1f2937";
const GRAY_MID = "#6b7280";
const GRAY_LIGHT = "#e5e7eb";
const GRAY_BG = "#f9fafb";

const VAT_RATE = 0.2;

function centToEuro(cents: number): number {
  return cents / 100;
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function intervalLabel(interval: string): string {
  return interval === "year" ? "Annuel" : "Mensuel";
}

export function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, compress: true });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const ttcEuros = centToEuro(data.amountTTCCents);
    const htEuros = ttcEuros / (1 + VAT_RATE);
    const tvaEuros = ttcEuros - htEuros;

    const pageWidth = doc.page.width - 100; // content width (margins 50 each side)
    const left = 50;

    // ── Header band ──────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 80).fill(PURPLE);

    doc
      .fillColor("#ffffff")
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("Lumen Juris", left, 22);

    doc
      .fillColor("#ddd6ff")
      .fontSize(9)
      .font("Helvetica")
      .text("lumenjuris.com  ·  contact@lumenjuris.com", left, 48);

    doc
      .fillColor("#ffffff")
      .fontSize(26)
      .font("Helvetica-Bold")
      .text("FACTURE", 0, 22, { align: "right", width: doc.page.width - left });

    doc
      .fillColor("#ddd6ff")
      .fontSize(9)
      .font("Helvetica")
      .text(`N° ${data.invoiceNumber}`, 0, 50, {
        align: "right",
        width: doc.page.width - left,
      });

    // ── Invoice meta block ────────────────────────────────────
    let y = 110;

    doc
      .fillColor(GRAY_MID)
      .fontSize(8)
      .font("Helvetica")
      .text("DATE D'ÉMISSION", left, y);

    doc
      .fillColor(GRAY_DARK)
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(formatDate(data.date), left, y + 12);

    // ── Billing-to block ──────────────────────────────────────
    y = 110;
    const rightCol = left + pageWidth / 2;

    doc
      .fillColor(GRAY_MID)
      .fontSize(8)
      .font("Helvetica")
      .text("FACTURER À", rightCol, y);

    doc
      .fillColor(GRAY_DARK)
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(data.customerName || "—", rightCol, y + 12);

    doc
      .fillColor(GRAY_MID)
      .fontSize(9)
      .font("Helvetica")
      .text(data.customerEmail, rightCol, y + 26);

    // ── Divider ───────────────────────────────────────────────
    y = 175;
    doc
      .moveTo(left, y)
      .lineTo(left + pageWidth, y)
      .strokeColor(GRAY_LIGHT)
      .lineWidth(1)
      .stroke();

    // ── Table header ─────────────────────────────────────────
    y = 190;
    const colDesc = left;
    const colQty = left + pageWidth * 0.5;
    const colHT = left + pageWidth * 0.65;
    const colTVA = left + pageWidth * 0.78;
    const colTTC = left + pageWidth * 0.9;

    doc.rect(left, y, pageWidth, 22).fill(GRAY_BG);

    doc.fillColor(GRAY_MID).fontSize(8).font("Helvetica-Bold");
    doc.text("DESCRIPTION", colDesc + 8, y + 7);
    doc.text("QTÉ", colQty, y + 7);
    doc.text("PRIX HT", colHT, y + 7);
    doc.text("TVA", colTVA, y + 7);
    doc.text("TOTAL TTC", colTTC - 8, y + 7, { align: "right", width: 50 });

    // ── Table row ─────────────────────────────────────────────
    y += 22;
    doc
      .rect(left, y, pageWidth, 30)
      .strokeColor(GRAY_LIGHT)
      .lineWidth(0.5)
      .stroke();

    const rowY = y + 10;
    doc.fillColor(GRAY_DARK).fontSize(10).font("Helvetica-Bold");
    doc.text(
      `Plan ${data.planName} — ${intervalLabel(data.interval)}`,
      colDesc + 8,
      rowY,
    );

    doc.font("Helvetica").fontSize(10).fillColor(GRAY_DARK);
    doc.text("1", colQty, rowY);
    doc.text(formatEur(htEuros), colHT, rowY);
    doc.text(formatEur(tvaEuros), colTVA, rowY);
    doc.text(formatEur(ttcEuros), colTTC - 8, rowY, {
      align: "right",
      width: 50,
    });

    // ── Tax summary ───────────────────────────────────────────
    y += 30 + 20;
    const summaryLeft = left + pageWidth * 0.6;
    const summaryWidth = pageWidth * 0.4;

    function summaryRow(
      label: string,
      value: string,
      bold = false,
      highlight = false,
    ) {
      if (highlight) {
        doc.rect(summaryLeft - 8, y - 4, summaryWidth + 8, 24).fill(PURPLE);
      }

      doc
        .fillColor(highlight ? "#ffffff" : bold ? GRAY_DARK : GRAY_MID)
        .fontSize(bold ? 10 : 9)
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .text(label, summaryLeft, y);

      doc
        .fillColor(highlight ? "#ffffff" : GRAY_DARK)
        .fontSize(bold ? 10 : 9)
        .font("Helvetica-Bold")
        .text(value, summaryLeft, y, { align: "right", width: summaryWidth });

      y += highlight ? 24 : 18;
    }

    summaryRow("Sous-total HT", formatEur(htEuros));
    summaryRow(`TVA (${VAT_RATE * 100} %)`, formatEur(tvaEuros));

    // divider before total
    doc
      .moveTo(summaryLeft, y)
      .lineTo(summaryLeft + summaryWidth, y)
      .strokeColor(GRAY_LIGHT)
      .lineWidth(0.5)
      .stroke();
    y += 8;

    summaryRow("TOTAL TTC", formatEur(ttcEuros), true, true);

    // ── Payment ref ───────────────────────────────────────────
    if (data.stripePaymentIntentId) {
      y += 30;
      doc
        .fillColor(GRAY_MID)
        .fontSize(8)
        .font("Helvetica")
        .text("RÉFÉRENCE DE PAIEMENT", left, y);
      doc
        .fillColor(GRAY_DARK)
        .fontSize(9)
        .font("Helvetica")
        .text(data.stripePaymentIntentId, left, y + 12);
    }

    // ── Footer ────────────────────────────────────────────────
    const footerY = doc.page.height - 60;
    doc
      .moveTo(left, footerY)
      .lineTo(left + pageWidth, footerY)
      .strokeColor(GRAY_LIGHT)
      .lineWidth(0.5)
      .stroke();

    doc
      .fillColor(GRAY_MID)
      .fontSize(8)
      .font("Helvetica")
      .text(
        `Lumen Juris · lumenjuris.com · contact@lumenjuris.com\nDocument généré le ${formatDate(new Date())}`,
        left,
        footerY + 10,
        { align: "center", width: pageWidth },
      );

    doc.end();
  });
}
