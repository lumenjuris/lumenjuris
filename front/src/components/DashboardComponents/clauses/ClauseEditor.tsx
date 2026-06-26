import { useState } from "react";
import { X, Loader2, ShieldCheck, ChevronDown } from "lucide-react";
import { clauseApi } from "./api";
import { CATEGORY_LABEL, POSITION_LABEL } from "./types";
import type { Clause, ClauseCategory, ClausePosition, ClauseInput } from "./types";

interface Props {
  clause: Clause | null; // null = création
  onClose: () => void;
  onSaved: () => void;
}

/** Panneau modal de création / édition d'une clause. */
export function ClauseEditor({ clause, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(clause?.title ?? "");
  const [category, setCategory] = useState<ClauseCategory>(clause?.category ?? "AUTRE");
  const [position, setPosition] = useState<ClausePosition>(clause?.position ?? "IDEALE");
  const [body, setBody] = useState(clause?.body ?? "");
  const [notes, setNotes] = useState(clause?.notes ?? "");
  const [tags, setTags] = useState(clause?.tags.join(", ") ?? "");
  const [isApproved, setIsApproved] = useState(clause?.isApproved ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showMore, setShowMore] = useState(!!clause);

  async function save() {
    if (!title.trim() || !body.trim()) {
      setError("L'intitulé et le texte de la clause sont obligatoires.");
      return;
    }
    setBusy(true); setError("");
    const payload: ClauseInput = {
      title: title.trim(),
      category,
      position,
      body,
      notes: notes.trim() || null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      isApproved,
    };
    try {
      if (clause) await clauseApi.update(clause.id, payload);
      else await clauseApi.create(payload);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'enregistrement.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-card shadow-card-md w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line sticky top-0 bg-white rounded-t-card">
          <h2 className="text-base font-semibold text-ink">
            {clause ? "Modifier la clause" : "Nouvelle clause"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-ink-muted hover:bg-surface-subtle transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="text-sm text-danger-dark bg-danger-light border border-danger/20 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Intitulé */}
          <Field label="Intitulé">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex. Clause de confidentialité — durée 5 ans"
              className="w-full px-3 py-2 border border-line rounded-lg text-sm text-ink outline-none focus:border-brand/40 focus:shadow-ring-brand transition-all placeholder:text-ink-placeholder"
            />
          </Field>

          {/* Texte de la clause */}
          <Field label="Texte de la clause">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Rédigez ici le texte juridique de la clause…"
              className="w-full px-3 py-2 border border-line rounded-lg text-sm text-ink outline-none focus:border-brand/40 focus:shadow-ring-brand transition-all resize-y leading-relaxed placeholder:text-ink-placeholder"
            />
          </Field>

          {/* Plus d'options — masquées par défaut pour ne pas surcharger le formulaire */}
          {!showMore ? (
            <button
              type="button"
              onClick={() => setShowMore(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-brand transition-colors"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              Plus d'options (catégorie, tags, notes…)
            </button>
          ) : (
            <div className="space-y-4 pt-1 border-t border-line-subtle">
              {/* Catégorie + position */}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <Field label="Catégorie">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ClauseCategory)}
                    className="w-full px-3 py-2 border border-line rounded-lg text-sm text-ink-secondary outline-none focus:border-brand/40 cursor-pointer"
                  >
                    {(Object.keys(CATEGORY_LABEL) as ClauseCategory[]).map((c) => (
                      <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Position de négociation">
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value as ClausePosition)}
                    className="w-full px-3 py-2 border border-line rounded-lg text-sm text-ink-secondary outline-none focus:border-brand/40 cursor-pointer"
                  >
                    {(Object.keys(POSITION_LABEL) as ClausePosition[]).map((p) => (
                      <option key={p} value={p}>{POSITION_LABEL[p]}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* Notes */}
              <Field label="Notes d'usage (optionnel)">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Conseils d'utilisation, contexte, références…"
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm text-ink outline-none focus:border-brand/40 transition-all resize-y placeholder:text-ink-placeholder"
                />
              </Field>

              {/* Tags */}
              <Field label="Tags (séparés par des virgules)">
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="ex. B2B, SaaS, standard"
                  className="w-full px-3 py-2 border border-line rounded-lg text-sm text-ink outline-none focus:border-brand/40 transition-all placeholder:text-ink-placeholder"
                />
              </Field>

              {/* Approbation juridique */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isApproved}
                  onChange={(e) => setIsApproved(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#354F99] cursor-pointer"
                />
                <span className="inline-flex items-center gap-1.5 text-sm text-ink-secondary">
                  <ShieldCheck className="w-4 h-4 text-success" />
                  Clause validée juridiquement (approuvée)
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-line sticky bottom-0 bg-white rounded-b-card">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-ink-secondary bg-white border border-line rounded-xl hover:bg-surface-subtle transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => void save()}
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-hover transition-all disabled:opacity-50"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {clause ? "Enregistrer" : "Créer la clause"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-ink-subtle uppercase tracking-widest mb-1.5">{label}</label>
      {children}
    </div>
  );
}
