import { CheckCircle2, Eye, Pencil } from "lucide-react";

/**
 * Système d'états UNIQUE des champs d'un contrat : une couleur, une icône et
 * un libellé par état, partout où un champ est affiché.
 *   - À compléter : champ vide, l'utilisateur doit le remplir ;
 *   - À vérifier  : valeur incertaine (IA peu sûre ou valeur calculée) ;
 *   - Validé      : rien à faire.
 */
export type VisibleFieldStatus = "to_complete" | "to_verify" | "validated";

export const FIELD_STATUS_STYLE: Record<
  VisibleFieldStatus,
  { label: string; icon: React.ElementType; textClass: string; borderClass: string }
> = {
  to_complete: {
    label: "À compléter",
    icon: Pencil,
    textClass: "text-warning",
    borderClass: "border-warning/50",
  },
  to_verify: {
    label: "À vérifier",
    icon: Eye,
    textClass: "text-info",
    borderClass: "border-info/40",
  },
  validated: {
    label: "Validés",
    icon: CheckCircle2,
    textClass: "text-success",
    borderClass: "border-line",
  },
};

/** Titre d'un groupe de champs : icône + libellé + nombre de champs. */
export function FieldStatusHeading({ status, count }: { status: VisibleFieldStatus; count: number }) {
  const style = FIELD_STATUS_STYLE[status];
  const Icon = style.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${style.textClass}`}>
      <Icon className="w-3.5 h-3.5" />
      {style.label} · {count}
    </span>
  );
}
