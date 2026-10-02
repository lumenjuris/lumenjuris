import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { contractApi } from "./api";
import { FieldReviewList } from "./FieldReviewList";
import type { FieldChanges } from "./FieldReviewList";
import { IMPORT_FIELDS, applyDeductions, buildReviewFields, isEmptyValue, normalizeFieldValue } from "./importReview";
import type { ReviewField } from "./importReview";
import type { ContractDetail, ValidationStatus } from "./types";

interface Props {
  contract: ContractDetail;
  /** Recharge la fiche en arrière-plan après un enregistrement. */
  onSaved: () => void;
  /** Prévient la fiche du début et de la fin de l'analyse IA (bouton du bandeau). */
  onAnalysingChange?: (analysing: boolean) => void;
}

/** Commande exposée à la fiche : le bouton « Analyser » est dans le bandeau. */
export interface ContractFieldsPanelHandle {
  analyse: () => Promise<void>;
}

/**
 * Informations du contrat sur la fiche : mêmes états et mêmes gestes que
 * pendant l'import (à compléter / à vérifier / validé), mais chaque champ est
 * enregistré dès qu'on le quitte, et non à chaque frappe.
 */
export const ContractFieldsPanel = forwardRef<ContractFieldsPanelHandle, Props>(function ContractFieldsPanel({ contract, onSaved, onAnalysingChange }, ref) {
  const [fields, setFields] = useState<ReviewField[]>(() => buildFields(contract));
  const [savingKeys, setSavingKeys] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [analysing, setAnalysing] = useState(false);
  const [notice, setNotice] = useState("");

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

  /**
   * Fait lire le contrat par l'IA (même analyse qu'à l'import) et remplit les
   * champs encore vides ou non validés. Les valeurs sont enregistrées comme
   * suggestions de l'IA : l'échéance est suivie tout de suite, et chaque champ
   * reste « à vérifier » jusqu'à sa validation. Un champ validé par
   * l'utilisateur n'est jamais remplacé.
   */
  async function analyseAndFill() {
    const text = contract.ocrText?.trim();
    if (!text) return;
    setAnalysing(true);
    onAnalysingChange?.(true);
    setError("");
    setNotice("");
    try {
      const suggestions = buildReviewFields(await contractApi.extractMetadata(text)).filter((suggestion) => {
        const current = fieldsRef.current.find((field) => field.key === suggestion.key);
        return !isEmptyValue(suggestion.value) && !current?.confirmedByUser && !current?.markedAbsent;
      });
      await Promise.all(suggestions.map((suggestion) =>
        contractApi.validateField(contract.id, suggestion.key, suggestion.value, "AI_SUGGESTED")));
      for (const suggestion of suggestions) {
        savedValues.current[suggestion.key] = suggestion.value;
        savedStatuses.current[suggestion.key] = "AI_SUGGESTED";
      }
      // Confiance remise à zéro : comme après un rechargement, tout reste à vérifier.
      const filled = suggestions.map((suggestion) => ({ ...suggestion, aiValue: suggestion.value, confidence: 0 }));
      setFields((previous) => applyDeductions([
        ...previous.map((field) => filled.find((suggestion) => suggestion.key === field.key) ?? field),
        ...filled.filter((suggestion) => !previous.some((field) => field.key === suggestion.key)),
      ]));
      setNotice(filled.length
        ? `${filled.length} champ${filled.length > 1 ? "s" : ""} rempli${filled.length > 1 ? "s" : ""} par l'IA : vérifiez-les puis validez-les.`
        : "L'IA n'a trouvé aucune nouvelle information dans le contrat.");
      onSaved();
    } catch {
      setError("L'analyse du contrat a échoué. Réessayez dans un instant.");
    } finally {
      setAnalysing(false);
      onAnalysingChange?.(false);
    }
  }

  useImperativeHandle(ref, () => ({ analyse: analyseAndFill }));

  return (
    <div className="bg-white rounded-card border border-line shadow-card p-3 space-y-3">

      {analysing && (
        <p className="text-xs text-ink-muted">L'IA lit le contrat : dates, durée, préavis, montant… Cela prend environ 20 secondes.</p>
      )}
      {notice && (
        <p role="status" className="text-xs text-ink-secondary bg-brand-light border border-brand/20 px-3 py-2 rounded-lg">{notice}</p>
      )}

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
});

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
