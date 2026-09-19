import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered, Heading2, Loader2, Check } from "lucide-react";
import { contractApi } from "./api";

/*
 * Le texte du contrat reste stocké en texte brut (analyse, négociation, PDF s'en servent).
 * La mise en forme y est écrite de façon lisible : **gras**, *italique*, « - » pour les puces,
 * « 1. » pour les listes numérotées, « ## » pour les titres. Paragraphes séparés par une ligne vide.
 */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inline(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/\n/g, "<br>");
}

export function textToHtml(text: string): string {
  const blocks = (text ?? "").replace(/\r\n/g, "\n").split(/\n\s*\n/);
  return blocks
    .map((b) => {
      const lines = b.split("\n");
      if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li><p>${inline(l.replace(/^\s*[-•]\s+/, ""))}</p></li>`).join("")}</ul>`;
      }
      if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
        return `<ol>${lines.map((l) => `<li><p>${inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</p></li>`).join("")}</ol>`;
      }
      const h = /^#{1,3}\s+(.*)$/.exec(b);
      if (h && lines.length === 1) return `<h2>${inline(h[1]!)}</h2>`;
      return `<p>${inline(b)}</p>`;
    })
    .join("");
}

function inlineText(nodes: JSONContent[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === "hardBreak") return "\n";
      let t = n.text ?? "";
      const marks = (n.marks ?? []).map((m) => m.type);
      if (t.trim()) {
        if (marks.includes("italic")) t = `*${t}*`;
        if (marks.includes("bold")) t = `**${t}**`;
      }
      return t;
    })
    .join("");
}

export function docToText(doc: JSONContent): string {
  const out: string[] = [];
  for (const n of doc.content ?? []) {
    if (n.type === "heading") out.push(`## ${inlineText(n.content)}`);
    else if (n.type === "bulletList" || n.type === "orderedList") {
      const items = (n.content ?? []).map((li, i) => {
        const txt = (li.content ?? []).map((p) => inlineText(p.content)).join(" ");
        return n.type === "bulletList" ? `- ${txt}` : `${i + 1}. ${txt}`;
      });
      out.push(items.join("\n"));
    } else out.push(inlineText(n.content));
  }
  return out.join("\n\n").trim();
}

/** Texte du contrat modifiable directement, avec une barre de mise en forme simple. */
export function InlineContractEditor({ contractId, text, onSaved }: { contractId: string; text: string; onSaved: () => void }) {
  // Contenu initial figé : on ne recharge pas l'éditeur après chaque enregistrement (le curseur sauterait).
  const initialHtml = useMemo(() => textToHtml(text), []); // eslint-disable-line react-hooks/exhaustive-deps
  const lastSaved = useRef((text ?? "").trim());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const [, force] = useState(0); // rafraîchit l'état actif des boutons

  async function save(next: string) {
    if (next === lastSaved.current) { setStatus("saved"); return; }
    setStatus("saving");
    try {
      await contractApi.update(contractId, { ocrText: next });
      lastSaved.current = next;
      setStatus("saved");
      onSaved();
    } catch {
      setStatus("error");
    }
  }

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2] }, code: false, codeBlock: false, blockquote: false, horizontalRule: false, strike: false, link: false, underline: false })],
    content: initialHtml,
    editorProps: {
      attributes: {
        class: "contract-editor text-sm text-gray-700 leading-relaxed font-sans outline-none min-h-[40vh] px-1 py-1",
      },
    },
    // Enregistrement automatique 1 seconde après la dernière frappe.
    onUpdate: ({ editor: e }) => {
      setStatus("pending");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(docToText(e.getJSON())), 1000);
    },
    onSelectionUpdate: () => force((x) => x + 1),
  });

  // En quittant la page, on enregistre ce qui ne l'a pas encore été.
  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); try { if (editor) void save(docToText(editor.getJSON())); } catch { /* éditeur déjà détruit */ } }
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  const tool = (active: boolean) =>
    `p-1.5 rounded-md transition-colors ${active ? "bg-blue-primary text-white" : "text-gray-600 hover:bg-gray-100"}`;

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <style>{`
        .contract-editor p { margin: 0 0 1em; }
        .contract-editor h2 { font-size: 1rem; font-weight: 700; margin: 1.2em 0 .6em; color: #1f2937; }
        .contract-editor ul { list-style: disc; padding-left: 1.4em; margin: 0 0 1em; }
        .contract-editor ol { list-style: decimal; padding-left: 1.4em; margin: 0 0 1em; }
        .contract-editor li p { margin: 0; }
      `}</style>

      {/* Barre d'outils collante, en haut du document */}
      <div className="shrink-0 px-5 py-2 bg-white border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-0.5">
          <button type="button" title="Gras" onClick={() => editor?.chain().focus().toggleBold().run()} className={tool(!!editor?.isActive("bold"))}><Bold className="w-4 h-4" /></button>
          <button type="button" title="Italique" onClick={() => editor?.chain().focus().toggleItalic().run()} className={tool(!!editor?.isActive("italic"))}><Italic className="w-4 h-4" /></button>
          <span className="w-px h-5 bg-gray-200 mx-1" />
          <button type="button" title="Titre" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={tool(!!editor?.isActive("heading"))}><Heading2 className="w-4 h-4" /></button>
          <button type="button" title="Liste à puces" onClick={() => editor?.chain().focus().toggleBulletList().run()} className={tool(!!editor?.isActive("bulletList"))}><List className="w-4 h-4" /></button>
          <button type="button" title="Liste numérotée" onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={tool(!!editor?.isActive("orderedList"))}><ListOrdered className="w-4 h-4" /></button>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
          {status === "pending" || status === "saving" ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enregistrement…</>
            : status === "saved" ? <><Check className="w-3.5 h-3.5 text-green-600" /> Enregistré</>
            : status === "error" ? <span className="text-red-600">Échec de l'enregistrement, réessayez de modifier le texte</span>
            : "Enregistrement automatique"}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
