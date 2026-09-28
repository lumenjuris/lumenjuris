import { useEffect, useMemo, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Mark, mergeAttributes } from "@tiptap/core";
import { escapeHtml } from "../../../utils/documentViewerTools/escapeHtml";

/** Passage surligné : rattaché à une règle, avec sa couleur. */
export interface Surlignage {
  debut: number;
  fin: number;
  ruleId: string;
  couleur: "rouge" | "orange" | "vert" | "bleu";
}

// Mêmes couleurs que l'éditeur de l'analyse des risques (styles en ligne, comme là-bas).
const STYLE: Record<Surlignage["couleur"], string> = {
  rouge: "background-color:#fee2e2;border-bottom:2px solid #fecaca;",
  orange: "background-color:#ffedd5;border-bottom:2px solid #fed7aa;",
  vert: "background-color:#dcfce7;border-bottom:2px solid #bbf7d0;",
  bleu: "background-color:#dbeafe;border-bottom:2px solid #bfdbfe;",
};
const BASE = "cursor:pointer;padding:1px;line-height:30px;";
const ACTIF = "outline:2px solid #2C3A5E;outline-offset:1px;";

// Marque TipTap pour les passages rattachés à une règle du playbook.
const RegleMark = Mark.create({
  name: "regleMark",
  addAttributes() {
    return {
      ruleId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-pb-rule"),
        renderHTML: (attrs) => (attrs.ruleId ? { "data-pb-rule": attrs.ruleId, id: `pb-passage-${attrs.ruleId}` } : {}),
      },
      style: {
        default: null,
        parseHTML: (el) => el.getAttribute("style"),
        renderHTML: (attrs) => (attrs.style ? { style: attrs.style } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-pb-rule]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
});

/** Un titre d'article (« Article 2 — Durée », « ARTICLE 3 ») devient un intertitre. */
const estTitre = (ligne: string) =>
  /^\s*(article|titre|chapitre|annexe|préambule)\b/i.test(ligne) && ligne.trim().length < 90;

/**
 * Texte + passages → HTML : une ligne = un paragraphe ; un passage qui
 * s'étend sur plusieurs lignes est surligné sur chacune.
 */
export function texteVersHtml(texte: string, surlignages: Surlignage[], actif: string | null): string {
  const zones = [...surlignages].sort((a, b) => a.debut - b.debut);
  const blocs: string[] = [];
  let ligne = "";
  let brut = "";

  const fermerLigne = () => {
    if (!brut.trim()) blocs.push("<p></p>");
    else if (estTitre(brut)) blocs.push(`<h2>${ligne}</h2>`);
    else blocs.push(`<p>${ligne}</p>`);
    ligne = "";
    brut = "";
  };

  const ajouter = (morceau: string, zone?: Surlignage) => {
    const parts = morceau.split("\n");
    parts.forEach((p, i) => {
      if (i > 0) fermerLigne();
      if (!p) return;
      brut += p;
      const html = escapeHtml(p);
      ligne += zone
        ? `<span data-pb-rule="${zone.ruleId}" style="${STYLE[zone.couleur]}${BASE}${zone.ruleId === actif ? ACTIF : ""}">${html}</span>`
        : html;
    });
  };

  let curseur = 0;
  for (const z of zones) {
    if (z.debut < curseur) continue;
    ajouter(texte.slice(curseur, z.debut));
    ajouter(texte.slice(z.debut, z.fin), z);
    curseur = z.fin;
  }
  ajouter(texte.slice(curseur));
  fermerLigne();
  return blocs.join("");
}

interface Props {
  texte: string;
  surlignages: Surlignage[];
  actif: string | null;
  onClickRegle: (ruleId: string) => void;
  /** Le texte a été modifié à la main dans l'éditeur. */
  onChange: (texte: string) => void;
}

/**
 * Contrat affiché dans un éditeur TipTap, comme dans l'analyse des risques :
 * passages surlignés cliquables, texte modifiable directement.
 */
export function PlaybookEditor({ texte, surlignages, actif, onClickRegle, onChange }: Props) {
  const html = useMemo(() => texteVersHtml(texte, surlignages, actif), [texte, surlignages, actif]);
  // Une modification tapée dans l'éditeur ne doit pas le recharger (le curseur sauterait).
  const texteTape = useRef<string | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [StarterKit, RegleMark],
    content: html,
    editable: true,
    onUpdate: ({ editor }) => {
      const t = editor.getText({ blockSeparator: "\n" });
      texteTape.current = t;
      onChangeRef.current(t);
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (texteTape.current !== null && texteTape.current === texte) {
      // Mise à jour venue de la frappe : on ne recharge que la mise en valeur du passage actif.
      texteTape.current = null;
      return;
    }
    texteTape.current = null;
    editor.commands.setContent(html, { emitUpdate: false });
  }, [html, texte, editor]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const clic = (e: MouseEvent) => {
      const span = (e.target as HTMLElement).closest("[data-pb-rule]");
      const id = span?.getAttribute("data-pb-rule");
      if (id) onClickRegle(id);
    };
    el.addEventListener("click", clic);
    return () => el.removeEventListener("click", clic);
  }, [onClickRegle]);

  return (
    <div ref={wrapperRef}>
      <EditorContent editor={editor} />
    </div>
  );
}
