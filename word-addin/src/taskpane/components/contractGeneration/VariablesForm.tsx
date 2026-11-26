import * as React from "react";
import { ContractDraft, DraftVariable } from "../../core/types";

interface Props {
  draft: ContractDraft;
  inserting: boolean;
  onInsert: (values: Record<string, string>) => void;
}

const GROUPES: { key: "obligatoire" | "recommande" | "optionnel"; label: string }[] = [
  { key: "obligatoire", label: "À compléter" },
  { key: "recommande", label: "Recommandé" },
  { key: "optionnel", label: "Facultatif" },
];

/**
 * Champs du contrat ({{variables}}) à compléter avant insertion. Tout est
 * facultatif ici : un champ laissé vide est inséré « [Libellé] », surligné,
 * pour être complété directement dans Word.
 */
const VariablesForm: React.FC<Props> = ({ draft, inserting, onInsert }) => {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [showOptional, setShowOptional] = React.useState(false);

  const byGroup = (key: string): DraftVariable[] =>
    draft.variables.filter((v) => (v.importance ?? "obligatoire") === key);

  return (
    <div className="lj-auth-card">
      <p className="lj-gen-kicker">Contrat rédigé</p>
      <h3>{draft.title}</h3>
      <p className="lj-muted" style={{ margin: "0 0 6px" }}>
        {draft.sections.length} article{draft.sections.length > 1 ? "s" : ""}
        {draft.variables.length > 0 && ` · ${draft.variables.length} champ${draft.variables.length > 1 ? "s" : ""} à compléter`}
      </p>

      {draft.variables.length > 0 && (
        <p className="lj-muted" style={{ margin: "0 0 8px" }}>
          Remplissez ce que vous savez déjà. Les champs vides seront surlignés dans le document.
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onInsert(values);
        }}
      >
        {GROUPES.map((groupe) => {
          const vars = byGroup(groupe.key);
          if (vars.length === 0) return null;
          const collapsed = groupe.key === "optionnel" && !showOptional;
          return (
            <fieldset key={groupe.key} className="lj-gen-group">
              <legend>
                {groupe.label} ({vars.length})
              </legend>
              {collapsed ? (
                <button type="button" className="lj-logout" onClick={() => setShowOptional(true)}>
                  Afficher les champs facultatifs
                </button>
              ) : (
                vars.map((v) => (
                  <div key={v.id}>
                    <label className="lj-label" htmlFor={`lj-var-${v.id}`}>
                      {v.label}
                    </label>
                    <input
                      id={`lj-var-${v.id}`}
                      className="lj-input"
                      value={values[v.id] ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [v.id]: e.target.value }))}
                      disabled={inserting}
                    />
                  </div>
                ))
              )}
            </fieldset>
          );
        })}

        <button className="lj-btn-brand" type="submit" disabled={inserting}>
          {inserting ? "Insertion…" : "Insérer dans le document"}
        </button>
      </form>
    </div>
  );
};

export default VariablesForm;
