import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { contractApi } from "./api";
import { FieldReviewList } from "./FieldReviewList";
import type { FieldChanges } from "./FieldReviewList";
import { IMPORT_FIELDS, applyDeductions, isEmptyValue, normalizeFieldValue } from "./importReview";
import type { ReviewField } from "./importReview";
import type { ContractDetail, ValidationStatus } from "./types";

interface Props {
  contract: ContractDetail;
  /** Recharge la fiche en arrière-plan après un enregistrement. */
  onSaved: () => void;
}

/**
 * Informations du contrat sur la fiche : mêmes états et mêmes gestes que
 * pendant l'import (à compléter / à vérifier / validé), mais chaque champ est
 * enregistré dès qu'on le quitte, et non à chaque frappe.
 */
export function ContractFieldsPanel({ contract, onSaved }: Props) {
  const [fields, setFields] = useState<ReviewField[]>(() => buildFields(contract));
  const [savingKeys, setSavingKeys] = useState<string[]>([]);
  const [error, setError] = useState("");

  // Ce que le serveur connaît déjà : évite de réécrire un champ inchangé.
  const savedValues = useRef<Record<string, string | null>>(initialSavedValues(contract));
  const savedStatuses = useRef<Record<string, ValidationStatus>>(initialSavedStatuses(contract));
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  // Enregistrement différé par champ : filet de sécurité si l'utilisateur quitte
  // la fiche sans sortir du champ qu'il vient de modifier.
  const pendingSaves = useRef<Record<string, number>>({});

  useEffect(() => {
    const timers = pendingSaves.current;
    return () => {
      for (const key of Object.keys(timers)) {
        window.clearTimeout(timers[key]);
        void commitField(key);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(key: string, changes: FieldChanges) {
    setFields((previous) => {
      const updated = previous.map((field) => (field.key === key ? { ...field, ...changes } : field));
      // Une nouvelle valeur peut permettre d'en déduire une autre (durée → échéance).
      return applyDeductions(updated);
    });
    window.clearTimeout(pendingSaves.current[key]);
    pendingSaves.current[key] = window.setTimeout(() => { void commitField(key); }, 1500);
  }

  async function commitField(key: string) {
    window.clearTimeout(pendingSaves.current[key]);
    delete pendingSaves.current[key];
    const field = fieldsRef.current.find((candidate) => candidate.key === key);
    if (!field) return;
    // Passer dans un champ sans rien y faire ne vaut pas validation.
    if (!field.confirmedByUser && !field.markedAbsent) return;

    const valueToSave = field.markedAbsent || isEmptyValue(field.value) ? null : field.value;
    const unchanged = savedValues.current[key] === valueToSave;
    const alreadyValidated = savedStatuses.current[key] !== undefined && savedStatuses.current[key] !== "AI_SUGGESTED";
    if (unchanged && alreadyValidated) return;

    // Valeur inchangée = l'humain confirme l'IA ; valeur différente = correction.
    const status: ValidationStatus = unchanged ? "HUMAN_VALIDATED" : "HUMAN_CORRECTED";

    setSavingKeys((previous) => [...previous, key]);
    setError("");
    try {
      await contractApi.validateField(contract.id, key, valueToSave, status);
      savedValues.current[key] = valueToSave;
      savedStatuses.current[key] = status;
      onSaved();
    } catch {
      setError("La modification n'a pas pu être enregistrée. Réessayez.");
      // Le champ redevient « à traiter » : l'utilisateur voit que rien n'est acquis.
      setFields((previous) => previous.map((candidate) =>
        candidate.key === key ? { ...candidate, confirmedByUser: false, markedAbsent: false } : candidate,
      ));
    } finally {
      setSavingKeys((previous) => previous.filter((candidate) => candidate !== key));
    }
  }

  return (
    <div className="bg-white rounded-card border border-line shadow-card p-4 space-y-3">
      <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Informations du contrat</p>

      {error && (
        <div role="alert" className="flex items-start gap-2 text-xs text-danger-dark bg-danger-light border border-danger/20 px-3 py-2 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <FieldReviewList
        fields={fields}
        onChangeField={handleChange}
        onCommitField={commitField}
        savingKeys={savingKeys}
      />
    </div>
  );
}

// ─── Construction des champs à partir du contrat ─────────────────────────────

/** "2026-03-01T00:00:00.000Z" → "2026-03-01" (format attendu par une saisie date). */
function isoDay(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

/**
 * Valeur lisible dans les colonnes du contrat, pour les champs sans métadonnée
 * enregistrée (contrats créés depuis l'analyseur, ou importés avant la refonte).
 */
function valueFromColumns(contract: ContractDetail, key: string): string | null {
  switch (key) {
    case "contract_type": return contract.contractType;
    case "counterparty_name": return contract.counterpartyName;
    case "signature_date": return isoDay(contract.signatureDate);
    case "effective_date": return isoDay(contract.effectiveDate);
    case "end_date": return isoDay(contract.endDate);
    case "duration_months": return contract.durationMonths != null ? String(contract.durationMonths) : null;
    case "notice_period_days": return contract.noticePeriodDays != null ? String(contract.noticePeriodDays) : null;
    case "renewal_type": return contract.renewalType.toLowerCase();
    case "is_b2c": return contract.isB2C ? "true" : "false";
    case "amount": return contract.amount;
    case "currency": return contract.currency;
    case "governing_law": return contract.governingLaw;
    default: return null;
  }
}

/** Valeur de départ d'un champ : la métadonnée si elle existe, sinon la colonne. */
function rawValueOf(contract: ContractDetail, key: string): string | null {
  const metadata = contract.metadataFields.find((field) => field.fieldKey === key);
  return metadata ? metadata.value : valueFromColumns(contract, key);
}

function buildFields(contract: ContractDetail): ReviewField[] {
  const knownKeys = IMPORT_FIELDS.map((config) => config.key);
  const extraKeys = contract.metadataFields
    .map((field) => field.fieldKey)
    .filter((key) => !knownKeys.includes(key));

  const fields = [...knownKeys, ...extraKeys].map((key) => {
    const metadata = contract.metadataFields.find((field) => field.fieldKey === key);
    const value = normalizeFieldValue(key, rawValueOf(contract, key));
    const validatedByHuman = metadata ? metadata.validationStatus !== "AI_SUGGESTED" : false;
    return {
      key,
      value,
      aiValue: value,
      confidence: metadata?.confidenceScore ?? 0,
      origin: "ai" as const,
      confirmedByUser: validatedByHuman,
      // Une valeur vide validée par un humain = information déclarée absente.
      markedAbsent: validatedByHuman && isEmptyValue(value),
    };
  });

  return applyDeductions(fields);
}

function initialSavedValues(contract: ContractDetail): Record<string, string | null> {
  const values: Record<string, string | null> = {};
  for (const field of buildFields(contract)) {
    values[field.key] = isEmptyValue(field.value) ? null : field.value;
  }
  return values;
}

function initialSavedStatuses(contract: ContractDetail): Record<string, ValidationStatus> {
  const statuses: Record<string, ValidationStatus> = {};
  for (const metadata of contract.metadataFields) {
    statuses[metadata.fieldKey] = metadata.validationStatus;
  }
  return statuses;
}
