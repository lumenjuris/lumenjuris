import { AlertCircle, Loader2, RotateCw } from "lucide-react";
import { IMPORT_FIELDS } from "./importReview";
import type { ReviewField } from "./importReview";
import { FieldReviewList } from "./FieldReviewList";
import type { FieldChanges } from "./FieldReviewList";

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
 * Panneau de revue de l'import : lecture, analyse, puis la liste des champs.
 * Rien n'est enregistré ici — tout part au clic sur « Enregistrer ».
 */
export function ImportReviewPanel({
  fields, textStatus, aiStatus, error, onChangeField, onRetryAi, onFocusField, onAllFieldsHandled,
}: Props) {
  if (textStatus === "error") {
    return (
      <div role="alert" className="flex items-start gap-2 text-sm text-danger-dark bg-danger-light border border-danger/20 px-4 py-3 rounded-panel">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{error ?? "Ce document n'a pas pu être lu."} Il ne sera pas enregistré.</span>
      </div>
    );
  }

  if (aiStatus === "error") {
    return (
      <div role="alert" className="bg-white rounded-panel border border-danger/30 shadow-card p-4 space-y-3">
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
    return <PendingFields reading={textStatus !== "ready"} />;
  }

  return (
    <FieldReviewList
      fields={fields}
      onChangeField={onChangeField}
      onFocusField={onFocusField}
      onAllFieldsHandled={onAllFieldsHandled}
      autoFocusFirstField
    />
  );
}

/** Squelette affiché pendant la lecture puis l'analyse : les vrais libellés, sans valeur. */
function PendingFields({ reading }: { reading: boolean }) {
  const essentialFields = IMPORT_FIELDS.filter((field) => !field.optional);
  return (
    <div className="space-y-2">
      <p role="status" className="flex items-center gap-2 text-xs font-semibold text-brand">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        {reading ? "Lecture du document…" : "Analyse du contrat…"}
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
