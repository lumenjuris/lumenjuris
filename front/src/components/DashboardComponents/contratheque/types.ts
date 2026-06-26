/**
 * Types partagés du module Contrathèque (miroir des DTO backend).
 * Voir doc/CONTRATHEQUE.md.
 */

export type ContractStatus =
  | "DRAFT" | "IN_NEGOTIATION" | "ACTIVE" | "TACIT_RENEWAL" | "EXPIRED" | "TERMINATED";

export type RenewalType = "NONE" | "TACIT" | "EXPRESS";

export type ValidationStatus = "AI_SUGGESTED" | "HUMAN_VALIDATED" | "HUMAN_CORRECTED";

export interface TagDTO {
  id: string;
  label: string;
  color: string;
}

export interface FolderDTO {
  id: string;
  name: string;
  parentExternalId: string | null;
}

export interface ContractListItem {
  id: string;
  title: string;
  contractType: string | null;
  counterpartyName: string | null;
  responsibleName: string | null;
  status: ContractStatus;
  signatureDate: string | null;
  endDate: string | null;
  isB2C: boolean;
  renewalType: RenewalType;
  amount: string | null;
  currency: string | null;
  folderExternalId: string | null;
  tags: TagDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface ContractStats {
  total: number;
  expiringIn90Days: number;
  tacitRenewal: number;
  withoutEndDate: number;
}

export interface MetadataField {
  fieldKey: string;
  value: string | null;
  confidenceScore: number | null;
  validationStatus: ValidationStatus;
  validatedById: number | null;
  validatedAt: string | null;
}

export interface AmendmentDTO {
  id: string;
  title: string;
  summary: string | null;
  signatureDate: string | null;
  effectiveDate: string | null;
  hasDocument: boolean;
  createdAt: string;
}

export interface VersionDTO {
  versionNumber: number;
  note: string | null;
  hasDocument: boolean;
  createdAt: string;
  contentText: string | null;
}

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  userId: number;
  userName?: string | null;
  createdAt: string;
}

export type ApprovalStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

export interface ContractComment {
  id: string;
  body: string;
  resolved: boolean;
  userId: number;
  userName: string | null;
  createdAt: string;
}

export interface ContractDetail {
  id: string;
  title: string;
  contractType: string | null;
  counterpartyName: string | null;
  responsibleName: string | null;
  status: ContractStatus;
  approvalStatus: ApprovalStatus;
  approvalNote: string | null;
  approvedById: number | null;
  approvedAt: string | null;
  signatureDate: string | null;
  effectiveDate: string | null;
  endDate: string | null;
  durationMonths: number | null;
  renewalType: RenewalType;
  noticePeriodDays: number | null;
  isB2C: boolean;
  amount: string | null;
  currency: string | null;
  governingLaw: string | null;
  hasDocument: boolean;
  ocrText: string | null;
  isArchived: boolean;
  retentionUntil: string | null;
  folderExternalId: string | null;
  tags: TagDTO[];
  metadataFields: MetadataField[];
  amendments: AmendmentDTO[];
  versions: VersionDTO[];
  auditLogs: AuditEntry[];
  comments: ContractComment[];
  createdAt: string;
  updatedAt: string;
}

/** Champ extrait par l'IA (résultat de /extract). */
export interface ExtractedField {
  field_key: string;
  value: string | null;
  confidence_score: number;
}

export interface ListFilters {
  status?: ContractStatus | "";
  type?: string;
  counterparty?: string;
  responsible?: string;
  folder?: string;
  tags?: string[];
  isB2C?: boolean | null;
  q?: string;
  signedFrom?: string;
  signedTo?: string;
  endFrom?: string;
  endTo?: string;
  sortBy?: "title" | "signatureDate" | "endDate" | "status" | "createdAt" | "amount";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

// ─── Libellés & helpers d'affichage ──────────────────────────────────────────

export const STATUS_LABEL: Record<ContractStatus, string> = {
  DRAFT: "Brouillon",
  IN_NEGOTIATION: "En négociation",
  ACTIVE: "Signé / actif",
  TACIT_RENEWAL: "Tacite reconduction",
  EXPIRED: "Échu",
  TERMINATED: "Résilié",
};

export const STATUS_STYLE: Record<ContractStatus, { bg: string; fg: string }> = {
  DRAFT: { bg: "#f1f5f9", fg: "#64748b" },
  IN_NEGOTIATION: { bg: "#fef3c7", fg: "#92400e" },
  ACTIVE: { bg: "#d1fae5", fg: "#065f46" },
  TACIT_RENEWAL: { bg: "#dbeafe", fg: "#1e40af" },
  EXPIRED: { bg: "#fee2e2", fg: "#991b1b" },
  TERMINATED: { bg: "#f3f4f6", fg: "#6b7280" },
};

export const RENEWAL_LABEL: Record<RenewalType, string> = {
  NONE: "Aucun",
  TACIT: "Tacite",
  EXPRESS: "Expresse",
};

/** Libellés humains des clés de métadonnées extraites. */
export const FIELD_LABEL: Record<string, string> = {
  contract_type: "Type de contrat",
  counterparty_name: "Cocontractant",
  signature_date: "Date de signature",
  effective_date: "Date d'effet",
  end_date: "Date d'échéance",
  duration_months: "Durée (mois)",
  renewal_type: "Renouvellement",
  notice_period_days: "Préavis (jours)",
  amount: "Montant",
  currency: "Devise",
  governing_law: "Droit applicable",
  is_b2c: "B2C (consommateur)",
  sensitive_clauses: "Clauses sensibles",
};

/** "JJ/MM/AAAA" à partir d'un ISO. */
export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Nombre de jours avant échéance (négatif = dépassé), ou null. */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ─── Échéances (gestion des renouvellements + calendrier) ────────────────────

export type DeadlineType = "END_DATE" | "NOTICE_DEADLINE" | "CHATEL_INFO";

export interface DeadlineEvent {
  contractId: string;
  contractTitle: string;
  counterpartyName: string | null;
  status: ContractStatus;
  isB2C: boolean;
  renewalType: RenewalType;
  noticePeriodDays: number | null;
  type: DeadlineType;
  date: string;
}

export const DEADLINE_LABEL: Record<DeadlineType, string> = {
  END_DATE: "Échéance du contrat",
  NOTICE_DEADLINE: "Dénonciation avant tacite reconduction",
  CHATEL_INFO: "Information consommateur (loi Chatel)",
};

export const DEADLINE_SHORT: Record<DeadlineType, string> = {
  END_DATE: "Échéance",
  NOTICE_DEADLINE: "Préavis",
  CHATEL_INFO: "Chatel",
};

export const DEADLINE_COLOR: Record<DeadlineType, string> = {
  END_DATE: "#ef4444",
  NOTICE_DEADLINE: "#f59e0b",
  CHATEL_INFO: "#7c3aed",
};

export type Severity = "overdue" | "urgent" | "soon" | "upcoming";

/** Sévérité d'une échéance selon le nombre de jours restants. */
export function severityOf(days: number): Severity {
  if (days < 0) return "overdue";
  if (days <= 15) return "urgent";
  if (days <= 45) return "soon";
  return "upcoming";
}

export const SEVERITY_STYLE: Record<Severity, { bg: string; fg: string; label: string }> = {
  overdue: { bg: "#fee2e2", fg: "#991b1b", label: "En retard" },
  urgent: { bg: "#ffedd5", fg: "#9a3412", label: "Urgent" },
  soon: { bg: "#fef3c7", fg: "#92400e", label: "Bientôt" },
  upcoming: { bg: "#dbeafe", fg: "#1e40af", label: "À venir" },
};
