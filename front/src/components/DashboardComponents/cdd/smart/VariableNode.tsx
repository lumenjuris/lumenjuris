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
//
// Au clic dans un champ vide, des pastilles proposent des valeurs utiles
// (dates, lieu, tribunal, délais…) ; dans un champ adresse, des adresses
// officielles (Base Adresse Nationale) s'affichent pendant la frappe.
import { useEffect, useMemo, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { useUserStore } from "../../../../store/userStore";
import { reconnaitre, villeDeLAdresse } from "../../../common/prefill";
import { suggestionsPourChamp, type Pastille } from "../../../common/suggestionsChamp";

interface AdresseBan { label: string; name: string; postcode: string; city: string }

/** Valeurs de tous les champs du document. */
function valeursDuDocument(editor: Editor): Record<string, string> {
  const map: Record<string, string> = {};
  editor.state.doc.descendants((n) => {
    if (n.type.name === "variable") map[n.attrs.name as string] = (n.attrs.value as string) || "";
  });
  return map;
}

/** Écrit plusieurs champs en une seule opération (annulable d'un Ctrl+Z). */
function ecrire(editor: Editor, valeurs: Record<string, string>) {
  editor.commands.command(({ tr, state }) => {
    state.doc.descendants((n, pos) => {
      if (n.type.name !== "variable") return;
      const nom = n.attrs.name as string;
      if (nom in valeurs) tr.setNodeMarkup(pos, undefined, { ...n.attrs, value: valeurs[nom], origin: "" });
    });
    return true;
  });
}

function VariableView({ node, updateAttributes, editor }: NodeViewProps) {
  const name = node.attrs.name as string;
  const label = (node.attrs.label as string) || name;
  const value = (node.attrs.value as string) || "";
  const origin = (node.attrs.origin as string) || "";
  const importance = (node.attrs.importance as string) || "";
  const suggere = origin === "suggestion" && value.length > 0;
  const optionnel = importance === "optionnel";

  const adresseUtilisateur = useUserStore((s) => s.userData?.enterprise?.address?.address ?? null);
  const [focus, setFocus] = useState(false);
  // Les adresses ne sont proposées que pendant la frappe, pas sur une valeur préremplie.
  const [tape, setTape] = useState(false);
  const estAdresse = useMemo(() => reconnaitre(name)?.donnee === "adresse", [name]);

  // Pastilles : seulement dans un champ vide, calculées à l'ouverture.
  const pastilles: Pastille[] = useMemo(
    () =>
      focus && !value
        ? suggestionsPourChamp(name, label, {
            valeurs: valeursDuDocument(editor),
            villeUtilisateur: villeDeLAdresse(adresseUtilisateur),
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [focus, value === "", name, label, adresseUtilisateur],
  );

  // Adresses officielles pendant la frappe (Base Adresse Nationale).
  const [adresses, setAdresses] = useState<AdresseBan[]>([]);
  useEffect(() => {
    if (!estAdresse || !focus || !tape || value.trim().length < 4) {
      setAdresses([]);
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(value)}&limit=4&autocomplete=1&index=address`, {
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const liste = (data?.features ?? [])
            .map((f: { properties?: Partial<AdresseBan> }) => f.properties ?? {})
            .filter((p: Partial<AdresseBan>) => p.label && p.label !== value)
            .map((p: Partial<AdresseBan>) => ({ label: p.label!, name: p.name ?? p.label!, postcode: p.postcode ?? "", city: p.city ?? "" }));
          setAdresses(liste);
        })
        .catch(() => undefined);
    }, 300);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [estAdresse, focus, tape, value]);

  /** Adresse choisie : répartie dans les champs code postal et ville voisins s'ils existent. */
  function choisirAdresse(a: AdresseBan) {
    const moi = reconnaitre(name);
    const voisins: Record<string, string> = {};
    let separes = false;
    for (const id of Object.keys(valeursDuDocument(editor))) {
      const r = reconnaitre(id);
      if (!r || r.prefixe !== moi?.prefixe) continue;
      if (r.donnee === "code_postal") { voisins[id] = a.postcode; separes = true; }
      if (r.donnee === "ville") { voisins[id] = a.city; separes = true; }
    }
    ecrire(editor, { ...voisins, [name]: separes ? a.name : a.label });
    setAdresses([]);
    setTape(false);
  }

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
  const propositions = adresses.length > 0;

  return (
    <NodeViewWrapper as="span" contentEditable={false} className="relative align-baseline">
      <input
        value={value}
        placeholder={placeholder}
        title={suggere ? `${label} — suggestion à valider` : label}
        data-var-name={name}
        data-origin={origin}
        // Modifier une suggestion vaut validation : la valeur devient celle de
        // l'utilisateur.
        onChange={(e) => { setTape(true); updateAttributes({ value: e.target.value, origin: "" }); }}
        onFocus={() => setFocus(true)}
        onBlur={() => { setFocus(false); setTape(false); }}
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
      {(pastilles.length > 0 || propositions) && (
        // onMouseDown + preventDefault : le champ garde le focus, le clic
        // n'est pas perdu dans le blur.
        <span className="absolute left-0 top-full z-30 mt-1 flex w-max max-w-[22rem] flex-wrap gap-1 rounded-lg border border-line bg-white p-1.5 shadow-card">
          {propositions
            ? adresses.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); choisirAdresse(a); }}
                  className="block w-full truncate rounded px-2 py-1 text-left text-xs text-ink hover:bg-brand-light"
                >
                  {a.label}
                </button>
              ))
            : pastilles.map((p) => (
                <button
                  key={p.libelle}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); updateAttributes({ value: p.valeur, origin: "" }); }}
                  className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-medium text-brand hover:bg-brand hover:text-white"
                >
                  {p.libelle}
                </button>
              ))}
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
