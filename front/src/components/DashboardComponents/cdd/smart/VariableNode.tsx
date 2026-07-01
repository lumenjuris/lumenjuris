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
        onChange={(e) => updateAttributes({ value: e.target.value })}
        size={Math.max(6, (value || label).length)}
        className={`mx-0.5 inline rounded px-1 text-[13px] font-medium outline-none transition ${
          value
            ? "bg-[#354F99]/10 text-[#354F99] hover:bg-[#354F99]/15"
            : "bg-amber-200/70 text-amber-900 ring-1 ring-amber-300 hover:bg-amber-200"
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
