import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, X } from "lucide-react";
import {
  RELATION_OPTIONS, RENEWAL_OPTIONS,
  computeFieldStatus, formatFieldValue, getFieldConfig,
} from "./importReview";
import type { FieldInputKind, FieldStatus, ReviewField } from "./importReview";
import { FIELD_STATUS_STYLE, FieldStatusHeading } from "./FieldStatus";

export interface FieldChanges {
  value?: string | null;
  confirmedByUser?: boolean;
  markedAbsent?: boolean;
}

interface Props {
  fields: ReviewField[];
  /** Modification locale : frappe, choix, confirmation, déclaration d'absence. */
  onChangeField: (key: string, changes: FieldChanges) => void;
  /**
   * Champ terminé (sortie du champ, confirmation, choix) : c'est le moment
   * d'enregistrer. Utilisé par la fiche contrat ; pendant l'import, rien n'est
   * écrit avant le clic final, donc la prop n'est pas fournie.
   */
  onCommitField?: (key: string) => void;
  /** Champ regardé, pour le surligner dans le contrat. */
  onFocusField?: (key: string | null) => void;
  /** Appelé quand le dernier champ à traiter vient d'être traité. */
  onAllFieldsHandled?: () => void;
  /** Place le curseur sur le premier champ à traiter dès l'affichage. */
  autoFocusFirstField?: boolean;
  /** Champs en cours d'enregistrement. */
  savingKeys?: string[];
}

/**
 * Liste des champs d'un contrat, rangés par ce qu'il reste à faire :
 *   1. À compléter  2. À vérifier  3. Validés (replié)  4. Facultatifs (replié)
 *
 * Partagé par l'import et la fiche contrat, pour que les mêmes couleurs, les
 * mêmes libellés et les mêmes gestes valent partout.
 */
export function FieldReviewList({
  fields, onChangeField, onCommitField, onFocusField, onAllFieldsHandled,
  autoFocusFirstField = false, savingKeys = [],
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
  const listRef = useRef<HTMLDivElement>(null);

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
    if (hadFieldsToHandle && fieldsNeedingAction.length === 0) onAllFieldsHandled?.();
    previousActionCount.current = fieldsNeedingAction.length;
  }, [fieldsNeedingAction.length, onAllFieldsHandled]);

  // À l'arrivée des champs, le curseur se place sur le premier à traiter (sauf
  // si l'utilisateur est déjà en train de saisir ailleurs, ex. l'intitulé).
  const alreadyAutoFocused = useRef(false);
  useEffect(() => {
    if (!autoFocusFirstField || alreadyAutoFocused.current || fields.length === 0) return;
    alreadyAutoFocused.current = true;
    const nothingFocused = !document.activeElement || document.activeElement === document.body;
    if (nothingFocused && fieldsNeedingAction.length > 0) focusField(fieldsNeedingAction[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocusFirstField, fields.length]);

  function focusField(key: string) {
    const field = fields.find((candidate) => candidate.key === key);
    // Le focus posé par le code ne remonte pas toujours jusqu'au conteneur :
    // on pose nous-mêmes le verrou de position et on signale le champ regardé.
    // Sans ce verrou, une valeur effacée ferait disparaître le champ avant même
    // que sa sortie ne soit enregistrée.
    if (field) setFocusedField({ key, statusAtFocus: displayedStatus(field) });
    const firstControl = fieldContainers.current[key]?.querySelector<HTMLElement>("input, button");
    firstControl?.focus();
    onFocusField?.(key);
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
    onFocusField?.(field.key);
  }

  function handleBlur(event: React.FocusEvent<HTMLDivElement>, field: ReviewField) {
    // On passe d'un bouton à l'autre DANS le même champ : on n'a pas quitté le champ.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    // Le champ est quitté : c'est le moment d'enregistrer, pas à chaque frappe.
    commitAfterUpdate(field.key);
    // Un champ qui change de groupe disparaît puis réapparaît ailleurs, ce qui
    // déclenche aussi un blur. On ne considère la sortie comme réelle que si le
    // focus a quitté toute la liste, vérifié au tour de boucle suivant.
    window.setTimeout(() => {
      if (listRef.current?.contains(document.activeElement)) return;
      setFocusedField(null);
      onFocusField?.(null);
    }, 0);
  }

  /**
   * L'enregistrement part au tour suivant : appelé tout de suite, il lirait
   * l'état d'avant la modification et n'enregistrerait rien.
   */
  function commitAfterUpdate(key: string) {
    if (!onCommitField) return;
    window.setTimeout(() => onCommitField(key), 0);
  }

  function changeValue(field: ReviewField, value: string | null) {
    // Saisir une valeur annule une éventuelle déclaration d'absence.
    onChangeField(field.key, { value, confirmedByUser: true, markedAbsent: false });
  }

  function confirmField(field: ReviewField) {
    onChangeField(field.key, { confirmedByUser: true });
    commitAfterUpdate(field.key);
    goToNextField(field.key);
  }

  /**
   * L'information ne figure pas dans le contrat : le champ est traité et rejoint
   * les champs validés, sinon la revue ne pourrait jamais arriver à son terme.
   */
  function markAbsent(field: ReviewField) {
    onChangeField(field.key, { value: null, confirmedByUser: true, markedAbsent: true });
    commitAfterUpdate(field.key);
    goToNextField(field.key);
  }

  /** Choix par boutons (renouvellement, B2B/B2C) : un clic suffit, on enchaîne. */
  function chooseOption(field: ReviewField, value: string) {
    changeValue(field, value);
    commitAfterUpdate(field.key);
    goToNextField(field.key);
  }

  /** Props communes au conteneur de chaque champ (focus, blur, repérage). */
  function containerProps(field: ReviewField) {
    return {
      ref: (element: HTMLDivElement | null) => { fieldContainers.current[field.key] = element; },
      onFocus: () => handleFocus(field),
      onBlur: (event: React.FocusEvent<HTMLDivElement>) => handleBlur(event, field),
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

  return (
    <div ref={listRef} className="flex flex-col gap-3">
      {/*       <Progress readyCount={readyCount} totalCount={essentialFields.length} />
 */}      
 
 {/* Annonce aux lecteurs d'écran ce qu'il reste à faire, sans rien afficher. */}
      <p className="sr-only" role="status" aria-live="polite">
        {fieldsNeedingAction.length === 0
          ? "Toutes les informations sont prêtes"
          : `${fieldsNeedingAction.length} champs à traiter`}
      </p>

      {fieldsToComplete.length > 0 && (
        <section className="space-y-1.5">
          <FieldStatusHeading status="to_complete" count={fieldsToComplete.length} />
          {fieldsToComplete.map((field) => (
            <ActionFieldCard
              key={field.key}
              field={field}
              group="to_complete"
              saving={savingKeys.includes(field.key)}
              containerProps={containerProps(field)}
              control={renderControl(field)}
              onMarkAbsent={() => markAbsent(field)}
            />
          ))}
        </section>
      )}

      {fieldsToVerify.length > 0 && (
        <section className="space-y-1.5">
          <FieldStatusHeading status="to_verify" count={fieldsToVerify.length} />
          {fieldsToVerify.map((field) => (
            <ActionFieldCard
              key={field.key}
              field={field}
              group="to_verify"
              saving={savingKeys.includes(field.key)}
              containerProps={containerProps(field)}
              control={renderControl(field)}
              onConfirm={() => confirmField(field)}
            />
          ))}
        </section>
      )}

      {validatedFields.length > 0 && (
        <section className="space-y-2">
          <CollapsibleHeading open={showValidated} onToggle={() => setShowValidated(!showValidated)} controls="champs-valides">
            <FieldStatusHeading status="validated" count={validatedFields.length} />
          </CollapsibleHeading>
          {showValidated && (
            <div id="champs-valides" className="bg-white rounded-panel border border-line divide-y divide-line-subtle">
              {validatedFields.map((field) => (
                <div key={field.key} {...containerProps(field)} className="px-3 py-2">
                  {editingValidatedKey === field.key ? (
                    <div className="space-y-1.5">
                      <FieldLabel fieldKey={field.key} className="block text-xs text-ink-muted" />
                      {renderControl(field, true)}
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingValidatedKey(field.key);
                        setFocusedField({ key: field.key, statusAtFocus: "validated" });
                        onFocusField?.(field.key);
                      }}
                      aria-label={`Modifier ${getFieldConfig(field.key).label}`}
                      className="w-full flex items-center justify-between gap-3 text-left group"
                      title="Modifier"
                    >
                      <span className="text-xs text-ink-muted">{getFieldConfig(field.key).label}</span>
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        {savingKeys.includes(field.key) && <Loader2 className="w-3 h-3 animate-spin text-ink-subtle" />}
                        <span className="text-sm text-ink-secondary truncate group-hover:text-ink">{formatFieldValue(field)}</span>
                      </span>
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
          <CollapsibleHeading open={showOptional} onToggle={() => setShowOptional(!showOptional)} controls="champs-facultatifs">
            <span className="text-xs font-semibold text-ink-muted">Facultatif · {optionalFields.length}</span>
          </CollapsibleHeading>
          {showOptional && (
            <div id="champs-facultatifs" className="space-y-2">
              {optionalFields.map((field) => (
                <div key={field.key} {...containerProps(field)} className="bg-white rounded-panel border border-line p-3 space-y-1.5">
                  <FieldLabel fieldKey={field.key} className="block text-xs text-ink-muted" />
                  {renderControl(field)}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

// Identifiants stables reliant le libellé, la saisie et son unité : sans eux,
// un lecteur d'écran annonce « champ de saisie » sans dire de quoi il s'agit.
function fieldLabelId(key: string) { return `champ-libelle-${key}`; }
function fieldControlId(key: string) { return `champ-saisie-${key}`; }
function fieldUnitId(key: string) { return `champ-unite-${key}`; }

function isChoiceField(kind: FieldInputKind): boolean {
  return kind === "renewal" || kind === "relation";
}

/** Libellé d'un champ, relié à sa saisie. */
function FieldLabel({
  fieldKey, className = "text-xs font-medium text-ink-secondary",
}: {
  fieldKey: string;
  className?: string;
}) {
  const config = getFieldConfig(fieldKey);
  // Un champ à choix n'a pas de saisie unique à cibler : c'est le groupe de
  // boutons qui porte le libellé, via aria-labelledby.
  if (isChoiceField(config.kind)) {
    return <span id={fieldLabelId(fieldKey)} className={className}>{config.label}</span>;
  }
  return (
    <label id={fieldLabelId(fieldKey)} htmlFor={fieldControlId(fieldKey)} className={className}>
      {config.label}
    </label>
  );
}

/* function Progress({ readyCount, totalCount }: { readyCount: number; totalCount: number }) {
  const percent = totalCount === 0 ? 100 : Math.round((readyCount / totalCount) * 100);
  const allReady = readyCount === totalCount;
  return (
    <div className="space-y-1.5">
      <div
        role="progressbar"
        aria-label="Informations prêtes"
        aria-valuemin={0}
        aria-valuemax={totalCount}
        aria-valuenow={readyCount}
        className="h-1.5 rounded-full bg-surface-muted overflow-hidden"
      >
        <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
      <p className={`text-xs ${allReady ? "text-success-dark font-semibold" : "text-ink-muted"}`}>
        {allReady ? "Toutes les informations sont prêtes" : `${readyCount} sur ${totalCount} informations prêtes`}
      </p>
    </div>
  );
} */

function CollapsibleHeading({
  open, onToggle, controls, children,
}: {
  open: boolean;
  onToggle: () => void;
  /** Identifiant du bloc ouvert ou fermé par ce titre. */
  controls: string;
  children: React.ReactNode;
}) {
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      className="flex items-center gap-1 hover:opacity-80 transition-opacity"
    >
      {children}
      <Chevron className="w-3.5 h-3.5 text-ink-subtle" />
    </button>
  );
}

/** Carte d'un champ qui demande une action (à compléter ou à vérifier). */
function ActionFieldCard({
  field, group, saving, containerProps, control, onConfirm, onMarkAbsent,
}: {
  field: ReviewField;
  group: "to_complete" | "to_verify";
  saving: boolean;
  containerProps: {
    ref: (element: HTMLDivElement | null) => void;
    onFocus: () => void;
    onBlur: (event: React.FocusEvent<HTMLDivElement>) => void;
  };
  control: React.ReactNode;
  onConfirm?: () => void;
  onMarkAbsent?: () => void;
}) {
  const config = getFieldConfig(field.key);
  // Le champ est traité mais garde sa place tant que l'utilisateur est dedans.
  const alreadyHandled = computeFieldStatus(field) === "validated";
  const borderClass = alreadyHandled ? "border-success/40" : FIELD_STATUS_STYLE[group].borderClass;

  return (
    <div {...containerProps} className={`bg-white rounded-lg border px-2.5 py-1.5 transition-colors flex items-center gap-2 ${borderClass}`}>
      <div className="w-[34%] shrink-0 flex items-center gap-1 min-w-0">
        <FieldLabel fieldKey={field.key} className="text-xs font-medium text-ink-secondary leading-tight" />
        {saving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-subtle" />
        ) : alreadyHandled ? (
          <Check className="w-3.5 h-3.5 text-success" />
        ) : field.origin === "calculated" ? (
          <span className="text-[10px] text-ink-subtle">calculée</span>
        ) : null}
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-1.5">
        <div className="flex-1 min-w-0">{control}</div>
        {onConfirm && !alreadyHandled && (
          <button
            onClick={onConfirm}
            aria-label={`Confirmer ${config.label}`}
            title="Confirmer"
            className="shrink-0 p-1.5 text-info-dark bg-info-light rounded-md hover:bg-info/20 transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        {onMarkAbsent && !alreadyHandled && (
          <button
            onClick={onMarkAbsent}
            aria-label={`${config.label} : information absente du contrat`}
            title="Cette information ne figure pas dans le contrat"
            className="shrink-0 p-1.5 text-ink-subtle rounded-md hover:bg-surface-subtle hover:text-ink-secondary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
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
  const inputClass = "w-full text-sm px-2 py-1 rounded-md border border-line text-ink outline-none focus:border-brand/40 focus:shadow-ring-brand placeholder:text-ink-placeholder transition-all";

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      onEnter();
    }
  }

  if (config.kind === "renewal" || config.kind === "relation") {
    const options = config.kind === "renewal" ? RENEWAL_OPTIONS : RELATION_OPTIONS;
    return (
      <div role="group" aria-labelledby={fieldLabelId(field.key)} className="flex gap-1.5">
        {options.map((option) => {
          const selected = field.value === option.value;
          return (
            <button
              key={option.value}
              autoFocus={autoFocus && selected}
              aria-pressed={selected}
              onClick={() => onChoose(option.value)}
              className={`flex-1 px-2 py-1.5 text-sm rounded-lg border transition-colors ${selected ? "border-brand bg-brand-light text-brand font-semibold" : "border-line text-ink-secondary hover:bg-surface-subtle"
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
        id={fieldControlId(field.key)}
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
        id={fieldControlId(field.key)}
        autoFocus={autoFocus}
        inputMode={isNumeric ? "decimal" : undefined}
        aria-describedby={config.unit ? fieldUnitId(field.key) : undefined}
        value={field.value ?? ""}
        onChange={(event) => onValueChange(event.target.value || null)}
        onKeyDown={handleKeyDown}
        placeholder="À remplir"
        className={inputClass}
      />
      {config.unit && <span id={fieldUnitId(field.key)} className="text-xs text-ink-muted shrink-0">{config.unit}</span>}
    </div>
  );
}
