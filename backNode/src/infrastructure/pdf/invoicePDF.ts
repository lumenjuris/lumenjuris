import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { encryptBuffer } from "../../services/encryption.js";

// Ligne de facturation additionnelle (ex: options prises avec l'abonnement).
// Le prix est TTC, exprimé en centimes, comme `amountTTCCents`.
export type InvoiceItem = {
  label: string; // libellé affiché, ex: "Membre supplémentaire (cluster)"
  quantity: number; // quantité, ex: 2
  unitPriceTTCCents: number; // prix unitaire TTC en centimes, ex: 20000 = 200,00 €
};

export type InvoiceData = {
  invoiceNumber: string;
  date: Date;
  customerName: string;
  customerEmail: string;
  customerAddress?: string; // ex: "12 rue des Lilas\n75011 Paris"
  customerVatNumber?: string; // optionnel, B2B intracommunautaire
  planName: string;
  interval: string;
  amountTTCCents: number; // montant TTC de l'abonnement (hors items ci-dessous)
  items?: InvoiceItem[]; // options/suppléments facturés en plus de l'abonnement
  stripePaymentIntentId?: string;
  paymentMethodLabel?: string; // défaut: "Carte bancaire"
};

type PdfDoc = InstanceType<typeof PDFDocument>;

// ── Infos vendeur (pré-remplies via variables d'environnement) ──────────────
// À définir dans .env / config de déploiement (voir liste en bas de fichier).
// Lu à chaque génération (et non au chargement du module) pour que les valeurs
// du .env soient prises en compte même si dotenv est initialisé après l'import.
function getVendor() {
  return {
    legalName: process.env.LUMEN_JURIS_LEGAL_NAME || "Lumen Juris",
    legalForm: process.env.LUMEN_JURIS_LEGAL_FORM || "",
    address: process.env.LUMEN_JURIS_ADDRESS || "22 Avenue des Champs\n81000 Albi, France",
    siret: process.env.LUMEN_JURIS_SIRET || "",
    vatNumber: process.env.LUMEN_JURIS_VAT_NUMBER || "",
    phone: process.env.LUMEN_JURIS_PHONE || "",
    email: process.env.LUMEN_JURIS_EMAIL || "contact@lumenjuris.com",
    website: process.env.LUMEN_JURIS_WEBSITE || "lumenjuris.com",
  };
}

// ── Palette ─────────────────────────────────────────────────────────────────
const BLUE = "#5B9DF5"; // bleu de marque (identique au mailer)
const BLUE_SOFT = "#9CB8E8"; // bleu secondaire ("Juris")
const INK = "#1f2937"; // texte principal
const MUTED = "#6b7280"; // texte secondaire
const LINE = "#e5e7eb"; // filets / bordures
const BG_SOFT = "#f9fafb"; // fonds de blocs

// Taux de TVA appliqué à toutes les factures (exporté : source unique de vérité,
// réutilisé par le calcul fiscal du monitoring).
export const TVA_RATE = 0.2;

// ── Mise en page ────────────────────────────────────────────────────────────
const MARGIN = 50;
const PAGE_W = 595.28; // A4
const CONTENT_W = PAGE_W - MARGIN * 2;
const RIGHT = MARGIN + CONTENT_W;

// ── Helpers de formatage ────────────────────────────────────────────────────
function centToEuro(cents: number): number {
  return cents / 100;
}

// Formatage manuel : Intl.NumberFormat("fr-FR") insère une espace fine
// insécable (U+202F) comme séparateur de milliers, absente de la police
// Helvetica de pdfkit (le rendu casse). On utilise une espace classique.
function formatEur(amount: number): string {
  const [intPart, decPart] = amount.toFixed(2).split(".");
  const withSpaces = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${withSpaces},${decPart} €`;
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

// Dossier de rangement mensuel : ./facture/mai_2026, ./facture/juin_2026, ...
// (sans accent pour rester compatible avec tous les systèmes de fichiers)
function monthFolder(date: Date): string {
  const months = [
    "janvier", "fevrier", "mars", "avril", "mai", "juin",
    "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
  ];
  return `${months[date.getMonth()]}_${date.getFullYear()}`;
}

// ── Configuration du document ───────────────────────────────────────────────
// Crée le document PDF (l'enregistrement sur disque se fait dans generateInvoicePDF).
function createDocument(data: InvoiceData): PdfDoc {
  const doc: PdfDoc = new PDFDocument({
    size: "A4",
    margin: MARGIN,
    compress: true,
    info: {
      Title: `Facture Lumen Juris n° ${data.invoiceNumber}`,
      Author: getVendor().legalName,
      Subject: "Facture",
    },
  });

  return doc;
}

/**
 * Archive la facture dans ./facture/<mois>_<année>/, chiffrée (AES-256-GCM) :
 * elle contient les données personnelles du client. Pour la relire :
 * decryptBuffer(fs.readFileSync(chemin)) — voir src/services/encryption.ts.
 */
function saveEncryptedCopy(data: InvoiceData, pdf: Buffer) {
  const dir = path.join("./facture", monthFolder(data.date));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `facture_${data.invoiceNumber}.pdf.enc`), encryptBuffer(pdf));
}

// ── Logo Lumen Juris (repris du mailer) ─────────────────────────────────────
// Deux cercles concentriques bleus + le wordmark "Lumen Juris".
function drawLogo(doc: PdfDoc, x: number, y: number) {
  const size = 12;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const s = size / 32; // le SVG d'origine est en viewBox 32x32

  doc.save();
  doc.lineWidth(2 * s);
  doc.circle(cx, cy, 13 * s).stroke(BLUE); // anneau extérieur
  doc.circle(cx, cy, 4.5 * s).fill(BLUE); // point central
  doc.restore();

  const textX = x + size + 2;
  const textY = y + size / 2 - 6;
  doc
    .fontSize(18)
    .font("Helvetica-Bold")
    .fillColor(INK)
    .text("Lumen", textX, textY, { continued: true })
    .fillColor(BLUE_SOFT)
    .text(" Juris");
}

// *** En-tête *** 
// Logo à gauche, bloc "FACTURE" + numéro/date à droite.
function createHeader(doc: PdfDoc, data: InvoiceData) {
  const top = MARGIN;

  drawLogo(doc, MARGIN, top);

  doc
    .font("Helvetica-Bold")
    .fontSize(26)
    .fillColor(BLUE)
    .text("FACTURE", MARGIN, top - 4, { align: "right", width: CONTENT_W });

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(MUTED)
    .text(`N° ${data.invoiceNumber}`, MARGIN, top + 26, {
      align: "right",
      width: CONTENT_W,
    })
    .text(`Émise le ${formatDate(data.date)}`, MARGIN, top + 40, {
      align: "right",
      width: CONTENT_W,
    });

  // filet de séparation sous l'en-tête
  const lineY = top + 62;
  doc.moveTo(MARGIN, lineY).lineTo(RIGHT, lineY).lineWidth(1).strokeColor(LINE).stroke();
}

// Partie de l'emeteur (lumenjuris) et le client
function createParties(doc: PdfDoc, data: InvoiceData) {
  const top = MARGIN + 82;
  const colW = CONTENT_W / 2 - 10;
  const rightX = MARGIN + CONTENT_W / 2 + 10;

  // Émetteur (gauche)
  const v = getVendor();
  const seller: string[] = [];
  seller.push(v.legalForm ? `${v.legalName} — ${v.legalForm}` : v.legalName);
  if (v.address) seller.push(...v.address.split("\n"));
  if (v.phone) seller.push(`Tél. : ${v.phone}`);
  seller.push(v.email);
  if (v.siret) seller.push(`SIRET : ${v.siret}`);
  if (v.vatNumber) seller.push(`N° TVA : ${v.vatNumber}`);

  // Client (droite)
  const client: string[] = [data.customerName || "—", data.customerEmail];
  if (data.customerAddress) client.push(...data.customerAddress.split("\n"));
  if (data.customerVatNumber) client.push(`N° TVA : ${data.customerVatNumber}`);

  const labelY = top;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED);
  doc.text("ÉMETTEUR", MARGIN, labelY);
  doc.text("FACTURER À", rightX, labelY);

  const bodyY = labelY + 16;
  doc.font("Helvetica").fontSize(9).fillColor(INK);
  seller.forEach((l, i) => doc.text(l, MARGIN, bodyY + i * 13, { width: colW }));
  doc.font("Helvetica-Bold").text(client[0], rightX, bodyY, { width: colW });
  doc.font("Helvetica");
  client.slice(1).forEach((l, i) => doc.text(l, rightX, bodyY + 13 + i * 13, { width: colW }));

  const rows = Math.max(seller.length, client.length);
  return bodyY + rows * 13 + 20; // y de départ pour la suite
}

// Tableau des prestations + totaux
function createItemsAndTotals(doc: PdfDoc, data: InvoiceData, startY: number) {
  // Chaque ligne : libellé, quantité et prix unitaire TTC (en euros).
  // L'abonnement est toujours la 1re ligne ; les items éventuels s'ajoutent.
  const rows = [
    {
      label: `Abonnement ${data.planName} — ${intervalLabel(data.interval)}`,
      qty: 1,
      unitTTC: centToEuro(data.amountTTCCents),
    },
    ...(data.items ?? []).map((it) => ({
      label: it.label,
      qty: it.quantity,
      unitTTC: centToEuro(it.unitPriceTTCCents),
    })),
  ];

  // Le montant reçu est TTC : on en déduit le HT et la TVA, ligne par ligne.
  const totalTTC = rows.reduce((sum, r) => sum + r.qty * r.unitTTC, 0);
  const totalHT = totalTTC / (1 + TVA_RATE);
  const totalTVA = totalTTC - totalHT;

  // colonnes
  const cDesc = MARGIN + 10;
  const cQty = MARGIN + CONTENT_W * 0.55;
  const cHt = MARGIN + CONTENT_W * 0.66;
  const cTtcRight = RIGHT - 10;

  // en-tête du tableau
  let y = startY;
  doc.rect(MARGIN, y, CONTENT_W, 24).fill(BG_SOFT);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED);
  doc.text("DESCRIPTION", cDesc, y + 8);
  doc.text("QTÉ", cQty, y + 8);
  doc.text("PRIX HT", cHt, y + 8);
  doc.text("TOTAL TTC", cTtcRight - 90, y + 8, { width: 90, align: "right" });
  y += 24;

  // lignes de prestation
  rows.forEach((r) => {
    const unitHT = r.unitTTC / (1 + TVA_RATE); // prix unitaire HT
    const lineTTC = r.qty * r.unitTTC; // total TTC de la ligne
    const rowY = y + 10;

    doc.font("Helvetica-Bold").fontSize(10).fillColor(INK);
    doc.text(r.label, cDesc, rowY, { width: CONTENT_W * 0.5 });
    doc.font("Helvetica").fontSize(10);
    doc.text(String(r.qty), cQty, rowY);
    doc.text(formatEur(unitHT), cHt, rowY);
    doc.text(formatEur(lineTTC), cTtcRight - 90, rowY, { width: 90, align: "right" });

    y += 28;
    doc.moveTo(MARGIN, y).lineTo(RIGHT, y).lineWidth(0.5).strokeColor(LINE).stroke();
  });

  // ── Totaux (alignés à droite) ──
  y += 18;
  const boxW = CONTENT_W * 0.42;
  const boxX = RIGHT - boxW;
  const labelX = boxX;
  const valueW = boxW;

  const totalLine = (label: string, value: string) => {
    doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(label, labelX, y);
    doc.font("Helvetica-Bold").fillColor(INK).text(value, boxX, y, { width: valueW, align: "right" });
    y += 17;
  };

  totalLine("Sous-total HT", formatEur(totalHT));
  totalLine(`TVA (${TVA_RATE * 100} %)`, formatEur(totalTVA));

  // bandeau total TTC
  y += 4;
  doc.rect(boxX, y, boxW, 28).fill(BLUE);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#ffffff");
  doc.text("TOTAL TTC", labelX + 10, y + 9);
  doc.text(formatEur(totalTTC), boxX, y + 9, { width: valueW - 10, align: "right" });

  return y + 28 + 24;
}

// ── Informations de paiement ────────────────────────────────────────────────
function createPaymentInfo(doc: PdfDoc, data: InvoiceData, startY: number) {
  let y = startY;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("PAIEMENT", MARGIN, y);
  y += 14;

  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor(INK)
    .text(
      `Mode de paiement : ${data.paymentMethodLabel || "Carte bancaire (Stripe)"}`,
      MARGIN,
      y,
    );
  y += 14;

  if (data.stripePaymentIntentId) {
    doc.fillColor(MUTED).text(`Référence de transaction : ${data.stripePaymentIntentId}`, MARGIN, y);
    y += 14;
  }

  doc.fillColor(MUTED).text("Facture acquittée — aucun règlement n'est dû.", MARGIN, y);
  return y + 14;
}

// ── Pied de page ────────────────────────────────────────────────────────────
function createFooter(doc: PdfDoc) {
  // On annule la marge basse : sans cela, écrire en pied de page dépasse la
  // marge et pdfkit ajoute automatiquement des pages blanches.
  doc.page.margins.bottom = 0;

  const y = 800; // ~40pt du bas de l'A4 (841.89)
  doc.moveTo(MARGIN, y).lineTo(RIGHT, y).lineWidth(0.5).strokeColor(LINE).stroke();

  const v = getVendor();
  const legal = v.legalForm ? `${v.legalName} · ${v.legalForm}` : v.legalName;
  const contact = [v.website, v.email].filter(Boolean).join(" · ");

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(MUTED)
    .text(`${legal} · ${contact}`, MARGIN, y + 10, { width: CONTENT_W, align: "center" })
    .text(`Document généré le ${formatDate(new Date())}`, MARGIN, y + 22, {
      width: CONTENT_W,
      align: "center",
    });
}

// ── Point d'entrée ──────────────────────────────────────────────────────────
export function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = createDocument(data);
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => {
      const pdf = Buffer.concat(chunks);
      try {
        saveEncryptedCopy(data, pdf);
      } catch (err) {
        // L'archive sur disque ne doit pas empêcher l'envoi / le téléchargement de la facture.
        console.error("[facture] archivage chiffré impossible :", err);
      }
      resolve(pdf);
    });
    doc.on("error", reject);

    createHeader(doc, data);
    const afterParties = createParties(doc, data);
    const afterTotals = createItemsAndTotals(doc, data, afterParties);
    createPaymentInfo(doc, data, afterTotals);
    createFooter(doc);

    doc.end();
  });
}
