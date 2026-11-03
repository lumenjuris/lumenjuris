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

/**
 * Synthèse IA du contrat (structure du prompt « Comprendre contrat », sans le
 * niveau de risque). Les valeurs sont libres (texte, liste, objet) : elles sont
 * mises en forme de façon générique par `valueToText` / `valueToLines`.
 */
export type AiContractSummary = {
  resume_executif?: unknown;
  objet?: unknown;
  parties?: unknown;
  dates?: unknown;
  conditions_financieres?: unknown;
  obligations?: unknown;
  resiliation?: unknown;
  responsabilite?: unknown;
  clauses_particulieres?: unknown;
  delais_importants?: unknown;
  annexes?: unknown;
  points_attention?: unknown;
};

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
  /** Synthèse IA ; null si l'IA n'a pas répondu (fiche sans IA) */
  aiSummary: AiContractSummary | null;
};

// Bas de page utile : en dessous, on passe à la page suivante avant d'écrire
const PAGE_BOTTOM = 841.89 - MARGIN;

/** Passe à la page suivante s'il ne reste pas `neededHeight` points. */
function ensureSpace(pdf: PdfDoc, neededHeight: number) {
  if (pdf.y + neededHeight > PAGE_BOTTOM) {
    pdf.addPage();
    pdf.y = MARGIN;
  }
}

/** Titre de section de la fiche (petites capitales, filet dessous). */
function sectionTitle(pdf: PdfDoc, label: string) {
  pdf.moveDown(1);
  ensureSpace(pdf, 50);
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

  pdf.font("Helvetica").fontSize(9.5);
  // Une valeur longue peut déborder sur la page suivante ; on évite seulement de
  // commencer une ligne tout en bas de page.
  ensureSpace(pdf, Math.min(pdf.heightOfString(value, { width: valueW }), 120) + 4);
  const startY = pdf.y;

  pdf.fillColor(MUTED).text(label, MARGIN, startY, { width: labelW });
  const labelBottom = pdf.y;
  pdf.fillColor(INK).text(value, valueX, startY, { width: valueW });
  pdf.y = Math.max(labelBottom, pdf.y) + 4;
}

/** Paragraphe de texte courant. */
function paragraph(pdf: PdfDoc, text: string) {
  pdf.font("Helvetica").fontSize(9.5).fillColor(INK);
  ensureSpace(pdf, 30);
  pdf.text(text, MARGIN, pdf.y, { width: CONTENT_W, lineGap: 2 });
}

/** Liste à puces. */
function bulletList(pdf: PdfDoc, items: string[]) {
  pdf.font("Helvetica").fontSize(9.5).fillColor(INK);
  items.forEach((item) => {
    ensureSpace(pdf, 20);
    pdf.text(`•  ${item}`, MARGIN, pdf.y, { width: CONTENT_W, lineGap: 1.5 });
    pdf.moveDown(0.2);
  });
}

// Libellés français des clés renvoyées par l'IA (les autres sont simplement « humanisées »)
const KEY_LABELS: Record<string, string> = {
  date_signature: "Date de signature",
  date_effet: "Date d'effet",
  date_fin: "Date de fin",
  duree: "Durée",
  renouvellement: "Renouvellement",
  tacite_reconduction: "Tacite reconduction",
  prix: "Prix",
  devise: "Devise",
  modalites_paiement: "Modalités de paiement",
  modalites_de_paiement: "Modalités de paiement",
  echeances: "Échéances",
  acomptes: "Acomptes",
  penalites: "Pénalités",
  interets_retard: "Intérêts de retard",
  interets_de_retard: "Intérêts de retard",
  conditions: "Conditions",
  preavis: "Préavis",
  resiliation_anticipee: "Résiliation anticipée",
  causes_resiliation: "Causes de résiliation",
  causes_de_resiliation: "Causes de résiliation",
  limitation_responsabilite: "Limitation de responsabilité",
  limitation_de_responsabilite: "Limitation de responsabilité",
  exclusions: "Exclusions",
  plafonds: "Plafonds",
  dommages_exclus: "Dommages exclus",
  nom: "Nom",
  type: "Type",
  qualite: "Qualité",
  adresse: "Adresse",
  representant: "Représentant",
  confidentialite: "Confidentialité",
  propriete_intellectuelle: "Propriété intellectuelle",
  non_concurrence: "Non-concurrence",
  non_sollicitation: "Non-sollicitation",
  exclusivite: "Exclusivité",
  rgpd: "RGPD",
  sous_traitance: "Sous-traitance",
  force_majeure: "Force majeure",
  mediation: "Médiation",
  competence_territoriale: "Compétence territoriale",
  loi_applicable: "Loi applicable",
  periode_essai: "Période d'essai",
  employeur: "Employeur",
  salarie: "Salarié",
  client: "Client",
  prestataire: "Prestataire",
  bailleur: "Bailleur",
  locataire: "Locataire",
  vendeur: "Vendeur",
  acheteur: "Acheteur",
};

/** « tacite_reconduction » → « Tacite reconduction » (si absent du dictionnaire). */
function humanizeKey(key: string): string {
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  const spaced = key.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return !value.trim();
  if (Array.isArray(value)) return value.every(isEmptyValue);
  if (typeof value === "object") return Object.values(value as object).every(isEmptyValue);
  return false;
}

/** Valeur mise sur une seule ligne (texte, liste ou objet). */
function valueToText(value: unknown): string {
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.filter((item) => !isEmptyValue(item)).map(valueToText).join(" ; ");
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => !isEmptyValue(entry))
      .map(([key, entry]) => `${humanizeKey(key)} : ${valueToText(entry)}`)
      .join(" — ");
  }
  return "";
}

/** Une ligne par élément d'une liste. */
function valueToLines(value: unknown): string[] {
  if (isEmptyValue(value)) return [];
  if (Array.isArray(value)) return value.filter((item) => !isEmptyValue(item)).map(valueToText);
  return [valueToText(value)];
}

/** Section « libellé : valeur » à partir d'un objet de l'IA (ex : dates, résiliation). */
function objectSection(pdf: PdfDoc, title: string, value: unknown) {
  if (isEmptyValue(value)) return;
  sectionTitle(pdf, title);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => !isEmptyValue(entry))
      .forEach(([key, entry]) => labelValueRow(pdf, humanizeKey(key), valueToText(entry)));
  } else {
    bulletList(pdf, valueToLines(value));
  }
}

/** Section en liste à puces (ex : parties, délais, points de vigilance). */
function listSection(pdf: PdfDoc, title: string, value: unknown) {
  const lines = valueToLines(value);
  if (lines.length === 0) return;
  sectionTitle(pdf, title);
  bulletList(pdf, lines);
}

/**
 * Parties : une ligne par partie, son nom à gauche et le reste à droite
 * (ex : « Société Exemple SAS » → « employeur · personne morale · 10 rue… »).
 */
function partiesSection(pdf: PdfDoc, value: unknown) {
  if (!Array.isArray(value)) {
    listSection(pdf, "Parties", value);
    return;
  }
  const parties = value.filter((party) => !isEmptyValue(party));
  if (parties.length === 0) return;

  sectionTitle(pdf, "Parties");
  parties.forEach((party) => {
    if (!party || typeof party !== "object" || typeof (party as { nom?: unknown }).nom !== "string") {
      bulletList(pdf, [valueToText(party)]);
      return;
    }
    const { nom, representant, ...details } = party as Record<string, unknown>;
    const description = [
      ...Object.values(details).filter((detail) => !isEmptyValue(detail)).map(valueToText),
      ...(isEmptyValue(representant) ? [] : [`représentée par ${valueToText(representant)}`]),
    ].join(" · ");
    labelValueRow(pdf, String(nom), description || "—");
  });
}

/** Clauses particulières : seulement celles présentes dans le contrat. */
function clausesSection(pdf: PdfDoc, value: unknown) {
  if (!Array.isArray(value)) return;
  const presentClauses = value.filter(
    (clause) => clause && typeof clause === "object" && (clause as { presente?: unknown }).presente === true,
  ) as { type?: unknown; resume?: unknown }[];
  if (presentClauses.length === 0) return;

  sectionTitle(pdf, "Clauses particulières");
  presentClauses.forEach((clause) => {
    const label = humanizeKey(String(clause.type ?? "clause"));
    const resume = typeof clause.resume === "string" && clause.resume.trim() ? clause.resume : "Présente";
    labelValueRow(pdf, label, resume);
  });
}

/** Contenu rédigé par l'IA (gpt-5.2, prompt « Comprendre contrat »). */
function aiSections(pdf: PdfDoc, summary: AiContractSummary) {
  if (typeof summary.resume_executif === "string" && summary.resume_executif.trim()) {
    sectionTitle(pdf, "En résumé");
    paragraph(pdf, summary.resume_executif);
  }
  if (typeof summary.objet === "string" && summary.objet.trim()) {
    sectionTitle(pdf, "Objet du contrat");
    paragraph(pdf, summary.objet);
  }
  partiesSection(pdf, summary.parties);
  objectSection(pdf, "Dates et durée", summary.dates);
  objectSection(pdf, "Conditions financières", summary.conditions_financieres);
  objectSection(pdf, "Obligations principales", summary.obligations);
  objectSection(pdf, "Résiliation", summary.resiliation);
  objectSection(pdf, "Responsabilité", summary.responsabilite);
  clausesSection(pdf, summary.clauses_particulieres);
  listSection(pdf, "Délais importants", summary.delais_importants);
  listSection(pdf, "Annexes", summary.annexes);
  listSection(pdf, "Points de vigilance", summary.points_attention);
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

    if (data.aiSummary) aiSections(pdf, data.aiSummary);

    sectionTitle(pdf, "Informations renseignées");
    if (data.fields.length === 0) {
      pdf.font("Helvetica").fontSize(9.5).fillColor(MUTED)
        .text("Aucun champ renseigné dans le contrat.", MARGIN, pdf.y, { width: CONTENT_W });
    } else {
      data.fields.forEach((field) => labelValueRow(pdf, field.label, field.value));
    }

    if (data.articleTitles.length > 0) {
      sectionTitle(pdf, "Plan du contrat");
      bulletList(pdf, data.articleTitles);
    }

    sectionTitle(pdf, "Achat");
    labelValueRow(pdf, "Référence", data.purchaseReference);
    labelValueRow(pdf, "Date d'achat", data.paidAt ? formatDate(data.paidAt) : "—");
    labelValueRow(pdf, "Formule", "Pack Contrat Professionnel — paiement unique");

    // Mention de prudence : la fiche ne remplace ni le contrat ni un conseil ;
    // si l'IA a rédigé la synthèse, on le dit clairement.
    pdf.moveDown(1.5);
    const noteText = data.aiSummary
      ? "Synthèse générée par intelligence artificielle à partir du contrat : elle peut comporter des " +
        "imprécisions. Elle ne remplace pas le contrat lui-même, qui seul fait foi entre les parties, " +
        "ni un conseil juridique adapté à votre situation."
      : "Ce document récapitule les informations saisies dans le contrat. Il ne remplace pas le contrat " +
        "lui-même, qui seul fait foi entre les parties, ni un conseil juridique adapté à votre situation.";
    const noteHeight = pdf.font("Helvetica").fontSize(8.5).heightOfString(noteText, { width: CONTENT_W - 20 });
    ensureSpace(pdf, noteHeight + 16);
    const noteY = pdf.y;
    pdf.rect(MARGIN, noteY, CONTENT_W, noteHeight + 16).fill(BG_SOFT);
    pdf.fillColor(MUTED).text(noteText, MARGIN + 10, noteY + 8, { width: CONTENT_W - 20 });
  });
}
