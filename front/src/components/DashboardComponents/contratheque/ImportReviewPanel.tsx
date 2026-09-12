import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, ChevronDown, ChevronRight, Loader2, RotateCw } from "lucide-react";
import {
  IMPORT_FIELDS, RELATION_OPTIONS, RENEWAL_OPTIONS,
  computeFieldStatus, formatFieldValue, getFieldConfig,
} from "./importReview";
import type { FieldStatus, ReviewField } from "./importReview";
import { FIELD_STATUS_STYLE, FieldStatusHeading } from "./FieldStatus";

export interface FieldChanges {
  value?: string | null;
  confirmedByUser?: boolean;
}

interface Props {
  fields: ReviewField[];
  textStatus: "waiting" | "loading" | "ready" | "error";
  aiStatus: "waiting" | "running" | "ready" | "error";
  error?: string;
  onChangeField: (key: string, changes: FieldChanges) => void;
  onRetryAi: () => void;
  /** Champ que l'utilisateur regarde (pour surligner sa valeur dans le contrat). */
  onFocusField: (key: string | null) => void;
  /** Appelé quand le dernier champ à traiter vient d'être traité. */
  onAllFieldsHandled: () => void;
}

/**
 * Panneau de revue : les champs sont rangés par statut, dans cet ordre
 *   1. À compléter  2. À vérifier  3. Validés (replié)  4. Facultatifs (replié)
 * pour que l'utilisateur voie tout de suite où intervenir.
 */
export function ImportReviewPanel({
  fields, textStatus, aiStatus, error, onChangeField, onRetryAi, onFocusField, onAllFieldsHandled,
}: Props) {
  /**
   * Un champ en cours d'édition garde sa place : il ne change de groupe qu'à la
   * sortie du champ, sinon il sauterait sous les doigts de l'utilisateur.
   */
  const [focusedField, setFocusedField] = useState<{ key: string; statusAtFocus: FieldStatus } | null>(null);
  const [showValidated, setShowValidated] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [editingValidatedKey, setEditingValidatedKey] = useState<string | null>(null);
  const fieldContainers = useRef<Record<string, HTMLDivElement | null>>({});

  function displayedStatus(field: ReviewField): FieldStatus {
    if (focusedField?.key === field.key) return focusedField.statusAtFocus;
    return computeFieldStatus(field);
  }

  const fieldsToComplete = fields.filter((field) => displayedStatus(field) === "to_complete");
  const fieldsToVerify = fields.filter((field) => displayedStatus(field) === "to_verify");
  const validatedFields = fields.filter((field) => displayedStatus(field) === "validated");
  const optionalFields = fields.filter((field) => displayedStatus(field) === "optional");
  const fieldsNeedingAction = [...fieldsToComplete, ...fieldsToVerify];

  // Progression : seuls les champs essentiels comptent.
  const essentialFields = fields.filter((field) => !getFieldConfig(field.key).optional);
  const readyCount = essentialFields.filter((field) => computeFieldStatus(field) === "validated").length;

  // Prévient le parent quand le dernier champ à traiter vient de l'être.
  const previousActionCount = useRef(fieldsNeedingAction.length);
  useEffect(() => {
    const hadFieldsToHandle = previousActionCount.current > 0;
    if (aiStatus === "ready" && hadFieldsToHandle && fieldsNeedingAction.length === 0) {
      onAllFieldsHandled();
    }
    previousActionCount.current = fieldsNeedingAction.length;
  }, [fieldsNeedingAction.length, aiStatus, onAllFieldsHandled]);

  // À l'arrivée des champs, le curseur se place sur le premier champ à traiter
  // (sauf si l'utilisateur est déjà en train de saisir ailleurs, ex. l'intitulé).
  useEffect(() => {
    if (aiStatus !== "ready") return;
    const nothingFocused = !document.activeElement || document.activeElement === document.body;
    if (nothingFocused && fieldsNeedingAction.length > 0) {
      focusField(fieldsNeedingAction[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiStatus]);

  function focusField(key: string) {
    const firstControl = fieldContainers.current[key]?.querySelector<HTMLElement>("input, button");
    firstControl?.focus();
  }

  /** Passe au champ suivant qui demande une action ; s'il n'y en a plus, quitte le champ. */
  function goToNextField(currentKey: string) {
    const currentIndex = fieldsNeedingAction.findIndex((field) => field.key === currentKey);
    const nextField = fieldsNeedingAction.slice(currentIndex + 1).find((field) => field.key !== currentKey)
      ?? fieldsNeedingAction.find((field) => field.key !== currentKey);

    if (nextField) {
      focusField(nextField.key);
    } else if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  function handleFocus(field: ReviewField) {
    if (focusedField?.key !== field.key) {
      setFocusedField({ key: field.key, statusAtFocus: displayedStatus(field) });
    }
    // L'utilisateur est passé à un autre champ : on referme le champ validé ouvert.
    if (editingValidatedKey !== null && editingValidatedKey !== field.key) {
      setEditingValidatedKey(null);
    }
    onFocusField(field.key);
  }

  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    // On passe d'un bouton à l'autre DANS le même champ : on n'a pas quitté le champ.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setFocusedField(null);
    onFocusField(null);
  }

  function changeValue(field: ReviewField, value: string | null) {
    onChangeField(field.key, { value, confirmedByUser: true });
  }

  function confirmField(field: ReviewField) {
    onChangeField(field.key, { confirmedByUser: true });
    goToNextField(field.key);
  }

  /** Choix par boutons (renouvellement, B2B/B2C) : un clic suffit, on enchaîne. */
  function chooseOption(field: ReviewField, value: string) {
    changeValue(field, value);
    goToNextField(field.key);
  }

  /** Props communes au conteneur de chaque champ (focus, blur, repérage). */
  function containerProps(field: ReviewField) {
    return {
      ref: (element: HTMLDivElement | null) => { fieldContainers.current[field.key] = element; },
      onFocus: () => handleFocus(field),
      onBlur: (event: React.FocusEvent<HTMLDivElement>) => handleBlur(event),
    };
  }

  function renderControl(field: ReviewField, autoFocus = false) {
    return (
      <FieldControl
        field={field}
        autoFocus={autoFocus}
        onValueChange={(value) => changeValue(field, value)}
        onChoose={(value) => chooseOption(field, value)}
        onEnter={() => confirmField(field)}
      />
    );
  }

  // ── États de chargement / erreur ──────────────────────────────────────────
  if (textStatus === "error") {
    return (
      <div className="flex items-start gap-2 text-sm text-danger-dark bg-danger-light border border-danger/20 px-4 py-3 rounded-panel">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{error ?? "Ce document n'a pas pu être lu."} Il ne sera pas enregistré.</span>
      </div>
    );
  }

  if (aiStatus === "error") {
    return (
      <div className="bg-white rounded-panel border border-danger/30 shadow-card p-4 space-y-3">
        <div className="flex items-start gap-2 text-sm text-danger-dark">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error ?? "L'analyse du contrat a échoué."}</span>
        </div>
        <button onClick={onRetryAi} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-ink-secondary border border-line rounded-xl hover:bg-surface-subtle transition-all">
          <RotateCw className="w-4 h-4" /> Relancer l'analyse
        </button>
      </div>
    );
  }

  if (aiStatus !== "ready") {
    return <PendingFields />;
  }

  // ── Revue ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <Progress readyCount={readyCount} totalCount={essentialFields.length} />

      {fieldsToComplete.length > 0 && (
        <section className="space-y-2">
          <FieldStatusHeading status="to_complete" count={fieldsToComplete.length} />
          {fieldsToComplete.map((field) => (
            <ActionFieldCard
              key={field.key}
              field={field}
              group="to_complete"
              containerProps={containerProps(field)}
              control={renderControl(field)}
            />
          ))}
        </section>
      )}

      {fieldsToVerify.length > 0 && (
        <section className="space-y-2">
          <FieldStatusHeading status="to_verify" count={fieldsToVerify.length} />
          {fieldsToVerify.map((field) => (
            <ActionFieldCard
              key={field.key}
              field={field}
              group="to_verify"
              containerProps={containerProps(field)}
              control={renderControl(field)}
              onConfirm={() => confirmField(field)}
            />
          ))}
        </section>
      )}

      {validatedFields.length > 0 && (
        <section className="space-y-2">
          <CollapsibleHeading open={showValidated} onToggle={() => setShowValidated(!showValidated)}>
            <FieldStatusHeading status="validated" count={validatedFields.length} />
          </CollapsibleHeading>
          {showValidated && (
            <div className="bg-white rounded-panel border border-line divide-y divide-line-subtle">
              {validatedFields.map((field) => (
                <div key={field.key} {...containerProps(field)} className="px-3 py-2">
                  {editingValidatedKey === field.key ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-ink-muted">{getFieldConfig(field.key).label}</p>
                      {renderControl(field, true)}
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingValidatedKey(field.key)}
                      className="w-full flex items-center justify-between gap-3 text-left group"
                      title="Modifier"
                    >
                      <span className="text-xs text-ink-muted">{getFieldConfig(field.key).label}</span>
                      <span className="text-sm text-ink-secondary truncate group-hover:text-ink">{formatFieldValue(field)}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {optionalFields.length > 0 && (
        <section className="space-y-2">
          <CollapsibleHeading open={showOptional} onToggle={() => setShowOptional(!showOptional)}>
            <span className="text-xs font-semibold text-ink-muted">Facultatif · {optionalFields.length}</span>
          </CollapsibleHeading>
          {showOptional && optionalFields.map((field) => (
            <div key={field.key} {...containerProps(field)} className="bg-white rounded-panel border border-line p-3 space-y-1.5">
              <p className="text-xs text-ink-muted">{getFieldConfig(field.key).label}</p>
              {renderControl(field)}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function Progress({ readyCount, totalCount }: { readyCount: number; totalCount: number }) {
  const percent = totalCount === 0 ? 100 : Math.round((readyCount / totalCount) * 100);
  const allReady = readyCount === totalCount;
  return (
    <div className="space-y-1.5">
      <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
        <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
      <p className={`text-xs ${allReady ? "text-success-dark font-semibold" : "text-ink-muted"}`}>
        {allReady ? "Toutes les informations sont prêtes" : `${readyCount} sur ${totalCount} informations prêtes`}
      </p>
    </div>
  );
}

function CollapsibleHeading({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: React.ReactNode }) {
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <button onClick={onToggle} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
      {children}
      <Chevron className="w-3.5 h-3.5 text-ink-subtle" />
    </button>
  );
}

/** Carte d'un champ qui demande une action (à compléter ou à vérifier). */
function ActionFieldCard({
  field, group, containerProps, control, onConfirm,
}: {
  field: ReviewField;
  group: "to_complete" | "to_verify";
  containerProps: {
    ref: (element: HTMLDivElement | null) => void;
    onFocus: () => void;
    onBlur: (event: React.FocusEvent<HTMLDivElement>) => void;
  };
  control: React.ReactNode;
  onConfirm?: () => void;
}) {
  const config = getFieldConfig(field.key);
  // Le champ est traité mais garde sa place tant que l'utilisateur est dedans.
  const alreadyHandled = computeFieldStatus(field) === "validated";
  const borderClass = alreadyHandled ? "border-success/40" : FIELD_STATUS_STYLE[group].borderClass;

  return (
    <div {...containerProps} className={`bg-white rounded-panel border shadow-card p-3 transition-colors ${borderClass}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-medium text-ink-secondary">{config.label}</span>
        {alreadyHandled ? (
          <Check className="w-3.5 h-3.5 text-success" />
        ) : field.origin === "calculated" ? (
          <span className="text-[11px] text-ink-subtle">calculée</span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">{control}</div>
        {onConfirm && !alreadyHandled && (
          <button
            onClick={onConfirm}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-info-dark bg-info-light rounded-lg hover:bg-info/20 transition-colors"
          >
            <Check className="w-3.5 h-3.5" /> Confirmer
          </button>
        )}
      </div>
    </div>
  );
}

/** Saisie adaptée au type de champ (date, nombre, choix…). */
function FieldControl({
  field, autoFocus, onValueChange, onChoose, onEnter,
}: {
  field: ReviewField;
  /** Place le curseur dans la saisie dès l'affichage (ouverture d'un champ validé). */
  autoFocus: boolean;
  onValueChange: (value: string | null) => void;
  onChoose: (value: string) => void;
  onEnter: () => void;
}) {
  const config = getFieldConfig(field.key);
  const inputClass = "w-full text-sm px-2.5 py-1.5 rounded-lg border border-line text-ink outline-none focus:border-brand/40 focus:shadow-ring-brand placeholder:text-ink-placeholder transition-all";

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      onEnter();
    }
  }

  if (config.kind === "renewal" || config.kind === "relation") {
    const options = config.kind === "renewal" ? RENEWAL_OPTIONS : RELATION_OPTIONS;
    return (
      <div className="flex gap-1.5">
        {options.map((option) => {
          const selected = field.value === option.value;
          return (
            <button
              key={option.value}
              autoFocus={autoFocus && selected}
              onClick={() => onChoose(option.value)}
              className={`flex-1 px-2 py-1.5 text-sm rounded-lg border transition-colors ${
                selected ? "border-brand bg-brand-light text-brand font-semibold" : "border-line text-ink-secondary hover:bg-surface-subtle"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (config.kind === "date") {
    return (
      <input
        type="date"
        autoFocus={autoFocus}
        value={field.value ?? ""}
        onChange={(event) => onValueChange(event.target.value || null)}
        onClick={(event) => event.currentTarget.showPicker?.()}
        onKeyDown={handleKeyDown}
        className={`${inputClass} cursor-pointer`}
      />
    );
  }

  const isNumeric = config.kind === "number" || config.kind === "amount";
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        autoFocus={autoFocus}
        inputMode={isNumeric ? "decimal" : undefined}
        value={field.value ?? ""}
        onChange={(event) => onValueChange(event.target.value || null)}
        onKeyDown={handleKeyDown}
        placeholder="À remplir"
        className={inputClass}
      />
      {config.unit && <span className="text-xs text-ink-muted shrink-0">{config.unit}</span>}
    </div>
  );
}

/** Squelette affiché pendant l'analyse : les vrais libellés, sans valeur. */
function PendingFields() {
  const essentialFields = IMPORT_FIELDS.filter((field) => !field.optional);
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-xs font-semibold text-brand">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyse du contrat…
      </p>
      {essentialFields.map((field) => (
        <div key={field.key} className="bg-white rounded-panel border border-line p-3 animate-pulse">
          <span className="text-xs text-ink-placeholder">{field.label}</span>
          <div className="h-7 mt-1.5 rounded-lg bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}
