// Nœud TipTap « variable » : champ surligné, éditable d'un seul clic, inséré
// dans le fil du contrat (le reste du texte étant librement éditable).
//
// Deux attributs complètent la valeur :
// - `origin` : d'où vient la valeur. "" = saisie ou validée par l'utilisateur,
//   "profil" = reprise de sa fiche (donnée connue du CLM), "suggestion" =
//   trouvée dans une source externe (SIRENE…) et encore à valider. Une
//   suggestion reste visible comme telle tant que l'utilisateur ne l'a pas
//   validée : une donnée externe n'est jamais intégrée silencieusement.
// - `importance` : "obligatoire", "recommande" ou "optionnel" (contrats
//   rédigés par l'IA). Un champ optionnel vide est affiché plus discrètement.
import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";

function VariableView({ node, updateAttributes }: NodeViewProps) {
  const label = (node.attrs.label as string) || (node.attrs.name as string);
  const value = (node.attrs.value as string) || "";
  const origin = (node.attrs.origin as string) || "";
  const importance = (node.attrs.importance as string) || "";
  const suggere = origin === "suggestion" && value.length > 0;
  const optionnel = importance === "optionnel";

  const style = suggere
    ? "bg-violet-50 text-violet-900 ring-1 ring-violet-300 hover:bg-violet-100"
    : value
      ? "bg-brand-light text-brand ring-1 ring-brand/15 hover:bg-brand-light/70"
      : optionnel
        ? "border border-dashed border-line bg-transparent text-ink-subtle hover:bg-surface-subtle"
        : importance === "recommande"
          ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
          : "bg-amber-100 text-amber-800 ring-1 ring-amber-300/80 hover:bg-amber-200/80";

  const placeholder = optionnel ? `${label} (facultatif)` : label;

  return (
    <NodeViewWrapper as="span" contentEditable={false} className="align-baseline">
      <input
        value={value}
        placeholder={placeholder}
        title={suggere ? `${label} — suggestion à valider` : label}
        data-var-name={node.attrs.name as string}
        data-origin={origin}
        // Modifier une suggestion vaut validation : la valeur devient celle de
        // l'utilisateur.
        onChange={(e) => updateAttributes({ value: e.target.value, origin: "" })}
        // Largeur calée sur le contenu, mais plafonnée : un libellé long ne doit
        // jamais faire déborder le champ du cadre du contrat (il est alors tronqué).
        size={Math.min(28, Math.max(6, (value || placeholder).length))}
        className={`mx-0.5 inline max-w-full text-ellipsis rounded-chip px-1.5 py-[1px] text-[13px] font-medium outline-none transition focus:ring-2 focus:ring-brand/25 ${style}`}
      />
      {suggere && (
        <span className="mr-0.5 select-none align-super text-[9px] font-semibold uppercase tracking-wide text-violet-600">
          Suggéré
        </span>
      )}
    </NodeViewWrapper>
  );
}

export const Variable = Node.create({
  name: "variable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      name: { default: "" },
      label: { default: "" },
      value: { default: "" },
      origin: { default: "" },
      importance: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-variable]",
        getAttrs: (el) => ({
          name: (el as HTMLElement).getAttribute("data-variable") || "",
          label: (el as HTMLElement).getAttribute("data-label") || "",
          value: (el as HTMLElement).getAttribute("data-value") || "",
          origin: (el as HTMLElement).getAttribute("data-origin") || "",
          importance: (el as HTMLElement).getAttribute("data-importance") || "",
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes({
        "data-variable": HTMLAttributes.name,
        "data-label": HTMLAttributes.label,
        "data-value": HTMLAttributes.value,
        "data-origin": HTMLAttributes.origin,
        "data-importance": HTMLAttributes.importance,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableView);
  },
});
