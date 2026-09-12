/**
 * Logique de la revue d'import (aucun affichage ici).
 *
 * Rôle : transformer les champs renvoyés par l'IA en champs « à revoir »,
 * calculer le statut de chacun (à compléter / à vérifier / validé), déduire
 * ce qui peut l'être, puis préparer les données envoyées au backend.
 */
import type { ExtractedField, ValidationStatus } from "./types";

// ─── Configuration des champs ────────────────────────────────────────────────

/** Type de saisie proposé à l'utilisateur pour un champ. */
export type FieldInputKind = "text" | "date" | "number" | "amount" | "renewal" | "relation";

export interface ImportFieldConfig {
  key: string;
  label: string;
  kind: FieldInputKind;
  /** Unité affichée à droite de la saisie ("jours", "mois"). */
  unit?: string;
  /** Champ facultatif : vide, il ne demande aucune action à l'utilisateur. */
  optional?: boolean;
}

/**
 * Champs de la revue, dans l'ORDRE DE PRIORITÉ d'affichage : d'abord ceux qui
 * déclenchent les alertes d'échéance, puis l'identification du contrat, puis
 * le reste.
 */
export const IMPORT_FIELDS: ImportFieldConfig[] = [
  { key: "end_date", label: "Date d'échéance", kind: "date" },
  { key: "renewal_type", label: "Renouvellement", kind: "renewal" },
  { key: "notice_period_days", label: "Préavis de dénonciation", kind: "number", unit: "jours" },
  { key: "is_b2c", label: "Type de relation", kind: "relation" },
  { key: "counterparty_name", label: "Cocontractant", kind: "text" },
  { key: "contract_type", label: "Type de contrat", kind: "text" },
  { key: "effective_date", label: "Date d'effet", kind: "date" },
  { key: "signature_date", label: "Date de signature", kind: "date" },
  { key: "duration_months", label: "Durée", kind: "number", unit: "mois" },
  { key: "amount", label: "Montant", kind: "amount" },
  { key: "currency", label: "Devise", kind: "text", optional: true },
  { key: "governing_law", label: "Droit applicable", kind: "text", optional: true },
  { key: "sensitive_clauses", label: "Clauses sensibles", kind: "text", optional: true },
];

/** En dessous de ce score, une valeur trouvée par l'IA est « à vérifier ». */
export const CONFIDENCE_THRESHOLD = 0.8;

export const RENEWAL_OPTIONS = [
  { value: "none", label: "Aucun" },
  { value: "tacit", label: "Tacite" },
  { value: "express", label: "Expresse" },
];

export const RELATION_OPTIONS = [
  { value: "false", label: "B2B" },
  { value: "true", label: "B2C" },
];

export function getFieldConfig(key: string): ImportFieldConfig {
  const config = IMPORT_FIELDS.find((field) => field.key === key);
  // Clé inconnue (ajoutée côté IA sans mise à jour du front) : on l'affiche
  // quand même, comme champ texte facultatif.
  return config ?? { key, label: key, kind: "text", optional: true };
}

// ─── Champ en cours de revue ─────────────────────────────────────────────────

/** "ai" = valeur proposée par l'IA ; "calculated" = déduite d'autres champs. */
export type FieldOrigin = "ai" | "calculated";

export interface ReviewField {
  key: string;
  /** Valeur actuelle, normalisée (dates en AAAA-MM-JJ, B2C en "true"/"false"…). */
  value: string | null;
  /** Valeur proposée par l'IA, pour savoir si l'utilisateur l'a corrigée. */
  aiValue: string | null;
  confidence: number;
  origin: FieldOrigin;
  /** L'utilisateur a saisi, corrigé ou confirmé ce champ. */
  confirmedByUser: boolean;
  /**
   * L'utilisateur a déclaré que l'information ne figure pas dans le contrat.
   * Le champ est alors traité, même s'il reste vide.
   */
  markedAbsent: boolean;
}

export type FieldStatus = "to_complete" | "to_verify" | "validated" | "optional";

export function isEmptyValue(value: string | null): boolean {
  return value === null || value.trim() === "";
}

/**
 * Statut d'un champ, déduit de son contenu : l'utilisateur n'a jamais à le
 * choisir lui-même.
 */
export function computeFieldStatus(field: ReviewField): FieldStatus {
  const config = getFieldConfig(field.key);
  const isEmpty = isEmptyValue(field.value);

  // Un champ facultatif ne demande jamais d'action et ne compte pas dans la
  // progression : il reste dans son groupe, qu'il soit rempli ou non.
  if (config.optional) return "optional";
  // Information déclarée absente du contrat : il n'y a plus rien à faire.
  if (field.markedAbsent) return "validated";
  if (isEmpty) return "to_complete";
  if (field.confirmedByUser) return "validated";
  if (field.origin === "calculated") return "to_verify";
  if (field.confidence >= CONFIDENCE_THRESHOLD) return "validated";
  return "to_verify";
}

/** Nombre de champs qui demandent encore une action (à compléter + à vérifier). */
export function countFieldsToHandle(fields: ReviewField[]): number {
  return fields.filter((field) => {
    const status = computeFieldStatus(field);
    return status === "to_complete" || status === "to_verify";
  }).length;
}

/** Construit les champs de la revue à partir de la réponse de l'IA. */
export function buildReviewFields(extractedFields: ExtractedField[]): ReviewField[] {
  const knownKeys = IMPORT_FIELDS.map((config) => config.key);
  const unknownKeys = extractedFields
    .map((extracted) => extracted.field_key)
    .filter((key) => !knownKeys.includes(key));

  const fields = [...knownKeys, ...unknownKeys].map((key) => {
    const extracted = extractedFields.find((candidate) => candidate.field_key === key);
    const normalizedValue = normalizeAiValue(getFieldConfig(key).kind, extracted?.value ?? null);
    return {
      key,
      value: normalizedValue,
      aiValue: normalizedValue,
      confidence: extracted?.confidence_score ?? 0,
      origin: "ai" as const,
      confirmedByUser: false,
      markedAbsent: false,
    };
  });

  return applyDeductions(fields);
}

// ─── Normalisation des valeurs de l'IA ───────────────────────────────────────

function normalizeAiValue(kind: FieldInputKind, rawValue: string | null): string | null {
  if (rawValue === null || rawValue.trim() === "") return null;
  const text = rawValue.trim();

  switch (kind) {
    case "date":
      return toIsoDate(text);
    case "number": {
      const parsed = parseFrenchNumber(text);
      return parsed === null ? null : String(Math.round(parsed));
    }
    case "amount": {
      const parsed = parseFrenchNumber(text);
      return parsed === null ? null : String(parsed);
    }
    case "renewal":
      return toRenewalValue(text);
    case "relation":
      return toRelationValue(text);
    default:
      return text;
  }
}

/**
 * Normalise une valeur venant du backend (colonne ou métadonnée enregistrée)
 * pour l'afficher dans la saisie du champ.
 */
export function normalizeFieldValue(key: string, rawValue: string | null): string | null {
  return normalizeAiValue(getFieldConfig(key).kind, rawValue);
}

/** "2026-03-01" ou "01/03/2026" → "2026-03-01". Null si la date est illisible. */
function toIsoDate(text: string): string | null {
  // Format demandé à l'IA : AAAA-MM-JJ (parfois suivi d'une heure).
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month}-${day}`;
  }
  // Repli : format français JJ/MM/AAAA.
  const frenchMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (frenchMatch) {
    const [, day, month, year] = frenchMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return null;
}

/**
 * Lit un nombre écrit à la française : "24 000,50 €" → 24000.5.
 * Retourne null si le texte ne contient aucun nombre exploitable.
 */
export function parseFrenchNumber(text: string): number | null {
  // On ne garde que les chiffres et les séparateurs : "24 000,50 €" → "24000,50".
  let cleaned = text.replace(/[^\d.,-]/g, "");
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    // "24.000,50" : les points séparent les milliers, la virgule est décimale.
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    cleaned = cleaned.replace(",", ".");
  }

  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRenewalValue(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("tacit")) return "tacit";
  if (lower.includes("expres")) return "express";
  if (lower === "none" || lower.includes("aucun")) return "none";
  return null;
}

/**
 * Le backend Python renvoie le booléen converti en texte, donc "True"/"False"
 * (avec une majuscule) : on compare en minuscules.
 */
function toRelationValue(text: string): string | null {
  const lower = text.toLowerCase();
  if (["true", "oui", "yes", "b2c"].includes(lower)) return "true";
  if (["false", "non", "no", "b2b"].includes(lower)) return "false";
  return null;
}

// ─── Déductions automatiques ─────────────────────────────────────────────────

const AVERAGE_DAYS_PER_MONTH = 30.44;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Remplit les champs qui se déduisent des autres, pour éviter une saisie à
 * l'utilisateur :
 *   - date d'échéance = date d'effet + durée ;
 *   - durée = écart entre date d'effet et date d'échéance ;
 *   - devise = EUR dès qu'un montant est connu.
 *
 * Une valeur donnée par l'IA ou saisie par l'utilisateur n'est JAMAIS
 * remplacée : seuls les champs vides (ou déjà calculés) sont recalculés.
 */
export function applyDeductions(fields: ReviewField[]): ReviewField[] {
  let result = deduceEndDate(fields);
  result = deduceDuration(result);
  result = deduceCurrency(result);
  return result;
}

function findField(fields: ReviewField[], key: string): ReviewField | undefined {
  return fields.find((field) => field.key === key);
}

/** Le champ peut recevoir une valeur calculée (vide, ou déjà calculé, et pas confirmé). */
function canBeCalculated(field: ReviewField | undefined): field is ReviewField {
  if (!field || field.confirmedByUser || field.markedAbsent) return false;
  return isEmptyValue(field.value) || field.origin === "calculated";
}

/** Valeur fiable pour servir de base à un calcul (pas elle-même calculée). */
function isSourceValue(field: ReviewField | undefined): field is ReviewField & { value: string } {
  return !!field && !isEmptyValue(field.value) && field.origin !== "calculated";
}

/** Écrit (ou efface, si null) une valeur calculée dans un champ. */
function setCalculatedValue(fields: ReviewField[], key: string, calculatedValue: string | null): ReviewField[] {
  return fields.map((field) => {
    if (field.key !== key) return field;
    if (calculatedValue !== null) {
      return { ...field, value: calculatedValue, origin: "calculated" };
    }
    // Plus assez d'informations pour calculer : on remet le champ tel que l'IA l'a laissé.
    if (field.origin === "calculated") {
      return { ...field, value: field.aiValue, origin: "ai" };
    }
    return field;
  });
}

function deduceEndDate(fields: ReviewField[]): ReviewField[] {
  const endDate = findField(fields, "end_date");
  if (!canBeCalculated(endDate)) return fields;

  const effectiveDate = findField(fields, "effective_date");
  const duration = findField(fields, "duration_months");
  let calculatedEndDate: string | null = null;

  if (isSourceValue(effectiveDate) && isSourceValue(duration)) {
    const durationInMonths = parseFrenchNumber(duration.value);
    if (durationInMonths !== null && durationInMonths > 0) {
      calculatedEndDate = computeEndDate(effectiveDate.value, durationInMonths);
    }
  }
  return setCalculatedValue(fields, "end_date", calculatedEndDate);
}

function deduceDuration(fields: ReviewField[]): ReviewField[] {
  const duration = findField(fields, "duration_months");
  if (!canBeCalculated(duration)) return fields;

  const effectiveDate = findField(fields, "effective_date");
  const endDate = findField(fields, "end_date");
  let calculatedDuration: string | null = null;

  if (isSourceValue(effectiveDate) && isSourceValue(endDate)) {
    const months = computeMonthsBetween(effectiveDate.value, endDate.value);
    if (months > 0) calculatedDuration = String(months);
  }
  return setCalculatedValue(fields, "duration_months", calculatedDuration);
}

function deduceCurrency(fields: ReviewField[]): ReviewField[] {
  const currency = findField(fields, "currency");
  if (!canBeCalculated(currency)) return fields;

  const amount = findField(fields, "amount");
  const hasAmount = !!amount && !isEmptyValue(amount.value);
  return setCalculatedValue(fields, "currency", hasAmount ? "EUR" : null);
}

/** "2026-03-01" → Date locale (sans décalage de fuseau horaire). */
function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Un contrat de 12 mois qui prend effet le 1er mars 2026 se termine la veille
 * de sa date anniversaire, soit le 28 février 2027.
 */
function computeEndDate(effectiveIsoDate: string, durationInMonths: number): string {
  const start = parseIsoDate(effectiveIsoDate);
  const dayBeforeAnniversary = new Date(
    start.getFullYear(),
    start.getMonth() + Math.round(durationInMonths),
    start.getDate() - 1,
  );
  return formatIsoDate(dayBeforeAnniversary);
}

/** Inverse de computeEndDate : du 01/03/2026 au 28/02/2027 → 12 mois. */
function computeMonthsBetween(effectiveIsoDate: string, endIsoDate: string): number {
  const start = parseIsoDate(effectiveIsoDate);
  const dayAfterEnd = parseIsoDate(endIsoDate);
  dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);
  const days = (dayAfterEnd.getTime() - start.getTime()) / MILLISECONDS_PER_DAY;
  return Math.round(days / AVERAGE_DAYS_PER_MONTH);
}

// ─── Intitulé du contrat ─────────────────────────────────────────────────────

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "contrat_acme-v2.pdf" → "Contrat acme v2". */
export function titleFromFileName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  const withSpaces = withoutExtension.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return withSpaces ? capitalize(withSpaces) : "Contrat importé";
}

/** "Contrat de prestation – Acme SAS" quand l'IA a trouvé le type et le cocontractant. */
export function suggestTitle(fields: ReviewField[]): string | null {
  const contractType = findField(fields, "contract_type")?.value?.trim();
  const counterparty = findField(fields, "counterparty_name")?.value?.trim();
  if (!contractType || !counterparty) return null;
  return `${capitalize(contractType)} – ${counterparty}`;
}

// ─── Affichage ───────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** Valeur lisible pour la liste compacte des champs validés. */
export function formatFieldValue(field: ReviewField): string {
  if (field.markedAbsent) return "Non mentionné";
  if (isEmptyValue(field.value)) return "—";
  const value = field.value as string;
  const config = getFieldConfig(field.key);

  switch (config.kind) {
    case "date": {
      const [year, month, day] = value.split("-");
      return `${day}/${month}/${year}`;
    }
    case "renewal":
      return RENEWAL_OPTIONS.find((option) => option.value === value)?.label ?? value;
    case "relation":
      return value === "true" ? "B2C (consommateur)" : "B2B (professionnel)";
    case "amount": {
      const parsed = parseFrenchNumber(value);
      return parsed === null ? value : parsed.toLocaleString("fr-FR");
    }
    case "number":
      return config.unit ? `${value} ${config.unit}` : value;
    default:
      return value;
  }
}

/** Insère un séparateur tous les 3 chiffres : "24000" → "24 000". */
function groupThousands(digits: string, separator: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

/**
 * Textes à surligner dans le contrat quand l'utilisateur regarde un champ,
 * pour qu'il retrouve d'un coup d'œil d'où vient la valeur.
 */
export function buildSearchTerms(field: ReviewField): string[] {
  if (isEmptyValue(field.value)) return [];
  const value = (field.value as string).trim();
  const config = getFieldConfig(field.key);

  switch (config.kind) {
    case "date": {
      const [year, month, day] = value.split("-");
      const dayNumber = Number(day);
      const monthName = MONTH_NAMES[Number(month) - 1];
      const terms = [
        `${day}/${month}/${year}`,
        `${dayNumber}/${Number(month)}/${year}`,
        `${dayNumber} ${monthName} ${year}`,
        `${day} ${monthName} ${year}`,
      ];
      if (dayNumber === 1) terms.push(`1er ${monthName} ${year}`);
      return terms;
    }
    case "amount": {
      const integerPart = String(Math.trunc(parseFrenchNumber(value) ?? 0));
      if (integerPart.length < 3) return [];
      return [integerPart, groupThousands(integerPart, " "), groupThousands(integerPart, ".")];
    }
    case "number":
      // Un petit nombre seul ("12") apparaîtrait partout : on cherche "12 mois".
      return config.unit ? [`${value} ${config.unit}`] : [];
    case "renewal":
      if (value === "tacit") return ["tacite reconduction", "tacitement"];
      if (value === "express") return ["reconduction expresse", "expressément"];
      return [];
    case "relation":
      return [];
    default:
      return value.length >= 3 ? [value] : [];
  }
}

// ─── Données envoyées au backend ─────────────────────────────────────────────

/**
 * Statut enregistré en base. Un champ que l'utilisateur n'a pas touché reste
 * « suggéré par l'IA », même s'il est affiché comme validé (score ≥ 0,8) : le
 * journal d'audit ne doit pas attribuer à l'humain une validation qu'il n'a
 * pas faite.
 */
function storedValidationStatus(field: ReviewField): ValidationStatus {
  if (!field.confirmedByUser) return "AI_SUGGESTED";
  return field.value === field.aiValue ? "HUMAN_VALIDATED" : "HUMAN_CORRECTED";
}

export function toMetadataPayload(fields: ReviewField[]) {
  return fields.map((field) => ({
    fieldKey: field.key,
    value: isEmptyValue(field.value) ? null : field.value,
    // Le score n'a de sens que pour une valeur proposée par l'IA.
    confidenceScore: field.origin === "ai" ? field.confidence : null,
    validationStatus: storedValidationStatus(field),
  }));
}

const RENEWAL_TO_COLUMN: Record<string, "NONE" | "TACIT" | "EXPRESS"> = {
  none: "NONE",
  tacit: "TACIT",
  express: "EXPRESS",
};

/** Colonnes structurées du contrat (filtres, tri, alertes d'échéance). */
export function toContractColumns(fields: ReviewField[]): Record<string, unknown> {
  function valueOf(key: string): string | null {
    const field = findField(fields, key);
    return field && !isEmptyValue(field.value) ? field.value : null;
  }
  function numberOf(key: string): number | null {
    const value = valueOf(key);
    return value === null ? null : parseFrenchNumber(value);
  }

  return {
    contractType: valueOf("contract_type"),
    counterpartyName: valueOf("counterparty_name"),
    signatureDate: valueOf("signature_date"),
    effectiveDate: valueOf("effective_date"),
    endDate: valueOf("end_date"),
    durationMonths: numberOf("duration_months"),
    noticePeriodDays: numberOf("notice_period_days"),
    amount: numberOf("amount"),
    currency: valueOf("currency") ?? "EUR",
    governingLaw: valueOf("governing_law"),
    isB2C: valueOf("is_b2c") === "true",
    renewalType: RENEWAL_TO_COLUMN[valueOf("renewal_type") ?? "none"] ?? "NONE",
    status: "ACTIVE",
  };
}
