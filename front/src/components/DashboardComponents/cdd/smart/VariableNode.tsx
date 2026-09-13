// Nœud TipTap « variable » : champ surligné, éditable d'un seul clic, inséré
// dans le fil du contrat (le reste du texte étant librement éditable).
import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";

function VariableView({ node, updateAttributes }: NodeViewProps) {
  const label = (node.attrs.label as string) || (node.attrs.name as string);
  const value = (node.attrs.value as string) || "";
  return (
    <NodeViewWrapper as="span" contentEditable={false} className="align-baseline">
      <input
        value={value}
        placeholder={label}
        title={label}
        data-var-name={node.attrs.name as string}
        onChange={(e) => updateAttributes({ value: e.target.value })}
        // Largeur calée sur le contenu, mais plafonnée : un libellé long ne doit
        // jamais faire déborder le champ du cadre du contrat (il est alors tronqué).
        size={Math.min(28, Math.max(6, (value || label).length))}
        className={`mx-0.5 inline max-w-full text-ellipsis rounded-chip px-1.5 py-[1px] text-[13px] font-medium outline-none transition focus:ring-2 focus:ring-brand/25 ${
          value
            ? "bg-brand-light text-brand ring-1 ring-brand/15 hover:bg-brand-light/70"
            : "bg-amber-100 text-amber-800 ring-1 ring-amber-300/80 hover:bg-amber-200/80"
        }`}
      />
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
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableView);
  },
});
