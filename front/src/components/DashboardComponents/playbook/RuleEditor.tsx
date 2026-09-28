import { useState } from "react";
import { X, Loader2, ChevronDown } from "lucide-react";
import { playbookApi } from "./api";
import { PLAYBOOK_CATEGORIES, RULE_TYPE_HINT, RULE_TYPE_LABEL, SEVERITY_LABEL } from "./types";
import type { PlaybookRule, RuleInput, RuleSeverity, RuleType } from "./types";

interface Props {
  rule: PlaybookRule | null; // null = création
  /** Playbook dans lequel une nouvelle règle est créée. */
  playbookId?: string;
  onClose: () => void;
  onSaved: () => void;
}

const INPUT = "w-full px-3 py-2 border border-line rounded-lg text-sm text-ink outline-none focus:border-brand/40 focus:shadow-ring-brand transition-all placeholder:text-ink-placeholder";
const SELECT = "w-full px-3 py-2 border border-line rounded-lg text-sm text-ink-secondary outline-none focus:border-brand/40 cursor-pointer";

/** Fenêtre de création / modification d'une règle du Playbook (même style que l'éditeur de clause). */
export function RuleEditor({ rule, playbookId, onClose, onSaved }: Props) {
  const [name, setName] = useState(rule?.name ?? "");
  const [category, setCategory] = useState(rule?.category ?? "Autre");
  const [ruleType, setRuleType] = useState<RuleType>(rule?.ruleType ?? "MAX");
  const [expectedValue, setExpectedValue] = useState(rule?.expectedValue ?? "");
  const [severity, setSeverity] = useState<RuleSeverity>(rule?.severity ?? "MEDIUM");
  const [suggestion, setSuggestion] = useState(rule?.suggestion ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [keywords, setKeywords] = useState(rule?.keywords.join(", ") ?? "");
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);
  const [showMore, setShowMore] = useState(!!(rule?.description || rule?.keywords.length));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const categories = PLAYBOOK_CATEGORIES.includes(category) ? PLAYBOOK_CATEGORIES : [category, ...PLAYBOOK_CATEGORIES];

  async function save() {
    if (!name.trim()) {
      setError("Donnez un nom à la règle.");
      return;
    }
    setBusy(true); setError("");
    const payload: RuleInput = {
      name: name.trim(),
      category,
      ruleType,
      expectedValue: expectedValue.trim() || null,
      unit: null,
      severity,
      suggestion: suggestion.trim() || null,
      description: description.trim() || null,
      keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
      isActive,
    };
    try {
      if (rule) await playbookApi.update(rule.id, payload);
      else await playbookApi.create({ ...payload, playbookId });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-card shadow-card-md w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-line sticky top-0 bg-white rounded-t-card">
          <h2 className="text-base font-semibold text-ink">{rule ? "Modifier la règle" : "Nouvelle règle"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-ink-muted hover:bg-surface-subtle transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && <div className="text-sm text-danger-dark bg-danger-light border border-danger/20 px-3 py-2 rounded-lg">{error}</div>}

          <Field label="Nom de la règle">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Durée maximale de cession du droit à l'image" className={INPUT} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Catégorie">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={SELECT}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Type de règle">
              <select value={ruleType} onChange={(e) => setRuleType(e.target.value as RuleType)} className={SELECT}>
                {(Object.keys(RULE_TYPE_LABEL) as RuleType[]).map((t) => <option key={t} value={t}>{RULE_TYPE_LABEL[t]}</option>)}
              </select>
            </Field>
          </div>

          <Field label={ruleType === "INSTRUCTION" || ruleType === "REQUIRED" || ruleType === "FORBIDDEN" ? "Ce qui est attendu" : "Valeur"}>
            <input value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} placeholder={RULE_TYPE_HINT[ruleType]} className={INPUT} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Importance">
              <select value={severity} onChange={(e) => setSeverity(e.target.value as RuleSeverity)} className={SELECT}>
                {(Object.keys(SEVERITY_LABEL) as RuleSeverity[]).map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
              </select>
            </Field>
            <Field label="Statut">
              <label className="flex h-[38px] items-center gap-2 text-sm text-ink-secondary cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-brand" />
                Règle active
              </label>
            </Field>
          </div>

          <Field label="Suggestion de correction (facultatif)">
            <textarea value={suggestion} onChange={(e) => setSuggestion(e.target.value)} rows={2} placeholder="ex. Limiter la cession à 24 mois." className={`${INPUT} resize-y`} />
          </Field>

          {!showMore ? (
            <button type="button" onClick={() => setShowMore(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-brand transition-colors">
              <ChevronDown className="w-3.5 h-3.5" /> Plus d'options (précision, mots-clés)
            </button>
          ) : (
            <div className="space-y-4 pt-4 border-t border-line-subtle">
              <Field label="Précision (facultatif)">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Contexte ou exception à connaître." className={`${INPUT} resize-y`} />
              </Field>
              <Field label="Mots-clés à repérer dans le contrat (séparés par des virgules)">
                <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="ex. cession, image, photographie" className={INPUT} />
              </Field>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-line">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-ink-secondary rounded-xl hover:bg-surface-subtle transition-colors">Annuler</button>
          <button onClick={() => void save()} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-hover transition-all disabled:opacity-50">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ink-secondary mb-1.5">{label}</label>
      {children}
    </div>
  );
}
