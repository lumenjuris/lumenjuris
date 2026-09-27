// Nœud TipTap « variable » : champ surligné, éditable d'un seul clic, inséré
// dans le fil du contrat (le reste du texte étant librement éditable).
//
// Deux attributs complètent la valeur :
// - `origin` : d'où vient la valeur. "" = saisie ou validée par l'utilisateur,
//   "profil" = reprise de sa fiche (donnée connue du CLM), "suggestion" =
//   trouvée dans une source externe (SIRENE, IA…) et encore à valider. Une
//   suggestion reste visible comme telle tant que l'utilisateur ne l'a pas
//   validée : une donnée externe n'est jamais intégrée silencieusement.
// - `importance` : "obligatoire", "recommande" ou "optionnel" (contrats
//   rédigés par l'IA). Un champ optionnel vide est affiché plus discrètement.
//
// Aides à la saisie, sous le champ, selon ce qu'il contient :
// - nom ou numéro d'une société : les sociétés correspondantes s'affichent
//   pendant la frappe ; un clic remplit toute la partie (adresse, SIRET…) ;
// - adresse : les adresses officielles (Base Adresse Nationale) ;
// - champ vide : des pastilles (dates, lieu, tribunal, délais…), ou
//   « Proposer un texte » pour un champ à rédiger (description, livrables…).
import { useEffect, useMemo, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { Loader2, Sparkles } from "lucide-react";
import { useUserStore } from "../../../../store/userStore";
import {
  chercherCapital,
  reconnaitre,
  valeurPourChamp,
  valeursSirene,
  villeDeLaFiche,
  type GroupePartie,
} from "../../../common/prefill";
import { estChampRedige, suggestionsPourChamp, type Pastille } from "../../../common/suggestionsChamp";
import type { CompanyResult, CompanySearchResponse } from "../../../../types/companySearch";
import { buildSearchUrl, detectLookupMode, formatCompanyOption, normalizeDigits } from "../../../../utils/companyLookup";
import { callOpenAi52 } from "../../../../utils/aiClient";

interface AdresseBan { label: string; name: string; postcode: string; city: string }
interface ChampDoc { id: string; label: string; value: string; origin: string }

/** Tous les champs du document, dans l'ordre. */
function champsDuDocument(editor: Editor): ChampDoc[] {
  const out: ChampDoc[] = [];
  editor.state.doc.descendants((n) => {
    if (n.type.name !== "variable") return;
    out.push({
      id: n.attrs.name as string,
      label: (n.attrs.label as string) || (n.attrs.name as string),
      value: (n.attrs.value as string) || "",
      origin: (n.attrs.origin as string) || "",
    });
  });
  return out;
}

function valeursDuDocument(editor: Editor): Record<string, string> {
  return Object.fromEntries(champsDuDocument(editor).map((c) => [c.id, c.value]));
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

/** Champs du document qui appartiennent à la même partie que `prefixe`. */
function groupeDe(editor: Editor, prefixe: string): GroupePartie {
  const champs = champsDuDocument(editor)
    .map((c) => ({ c, r: reconnaitre(c.id, c.label) }))
    .filter(({ r }) => r && r.prefixe === prefixe)
    .map(({ c, r }) => ({ id: c.id, donnee: r!.donnee }));
  return { prefixe, libelle: "", champs };
}

function VariableView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  const name = node.attrs.name as string;
  const label = (node.attrs.label as string) || name;
  const value = (node.attrs.value as string) || "";
  const origin = (node.attrs.origin as string) || "";
  const importance = (node.attrs.importance as string) || "";
  const suggere = origin === "suggestion" && value.length > 0;
  const optionnel = importance === "optionnel";

  const adresseUtilisateur = useUserStore((s) => s.userData?.enterprise?.address?.address ?? null);
  const cpUtilisateur = useUserStore((s) => s.userData?.enterprise?.address?.codePostal ?? null);
  const [villeUtilisateur, setVilleUtilisateur] = useState<string | null>(null);
  const [focus, setFocus] = useState(false);
  // Les listes (sociétés, adresses) ne s'ouvrent que pendant la frappe, pas
  // sur une valeur préremplie.
  const [tape, setTape] = useState(false);
  const reco = useMemo(() => reconnaitre(name, label), [name, label]);
  const estAdresse = reco?.donnee === "adresse";
  const estIdentite = reco?.donnee === "denomination" || reco?.donnee === "siren" || reco?.donnee === "siret";
  const redige = useMemo(() => estChampRedige(name, label), [name, label]);

  // Pastilles : seulement dans un champ vide, calculées à l'ouverture.
  const pastilles: Pastille[] = useMemo(
    () =>
      focus && !value
        ? suggestionsPourChamp(name, label, {
            valeurs: valeursDuDocument(editor),
            villeUtilisateur,
          })
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [focus, value === "", name, label, villeUtilisateur],
  );

  // Ville de la société de l'utilisateur (lieu de signature, tribunal).
  useEffect(() => {
    if (!focus || villeUtilisateur) return;
    void villeDeLaFiche(adresseUtilisateur, cpUtilisateur).then(setVilleUtilisateur);
  }, [focus, villeUtilisateur, adresseUtilisateur, cpUtilisateur]);

  // ── Sociétés pendant la frappe (registre officiel) ─────────────────────────
  const [societes, setSocietes] = useState<CompanyResult[]>([]);
  useEffect(() => {
    const q = value.trim();
    // Un simple « nom » n'ouvre la recherche que si la partie est bien une
    // société (SIREN, forme, capital… dans le contrat) : pas pour « Nom du
    // futur conjoint ».
    const societe =
      reco?.donnee !== "denomination" ||
      /denomination|raison|societe|entreprise/i.test(`${name} ${label}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) ||
      groupeDe(editor, reco.prefixe).champs.some((c) =>
        ["siren", "siret", "forme_juridique", "capital", "rcs", "tva"].includes(c.donnee),
      );
    if (!estIdentite || !societe || !focus || !tape || q.length < 3) {
      setSocietes([]);
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      fetch(buildSearchUrl(q, detectLookupMode(q)), { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: CompanySearchResponse | null) => setSocietes((data?.results ?? []).slice(0, 5)))
        .catch(() => undefined);
    }, 300);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [estIdentite, focus, tape, value]);

  /** Société choisie : toute la partie se remplit (dénomination, adresse, SIRET, TVA…). */
  function choisirSociete(result: CompanyResult) {
    if (!reco) return;
    const chiffres = normalizeDigits(value);
    const siret = chiffres.length === 14 ? chiffres : undefined;
    const groupe = groupeDe(editor, reco.prefixe);
    const valeurs = valeursSirene(result, siret);
    const aEcrire: Record<string, string> = {};
    for (const c of groupe.champs) {
      const v = valeurPourChamp(groupe, c, valeurs);
      if (v) aEcrire[c.id] = v;
    }
    ecrire(editor, aEcrire);
    setSocietes([]);
    setTape(false);
    // Capital social (registre INPI) : arrive après coup, s'il est connu.
    const champCapital = groupe.champs.find((c) => c.donnee === "capital");
    if (champCapital) {
      void chercherCapital(result.siren).then((capital) => {
        if (capital) ecrire(editor, { [champCapital.id]: capital });
      });
    }
  }

  // ── Adresses officielles pendant la frappe (Base Adresse Nationale) ────────
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
    const voisins: Record<string, string> = {};
    let separes = false;
    if (reco) {
      for (const c of groupeDe(editor, reco.prefixe).champs) {
        if (c.donnee === "code_postal") { voisins[c.id] = a.postcode; separes = true; }
        if (c.donnee === "ville") { voisins[c.id] = a.city; separes = true; }
      }
    }
    ecrire(editor, { ...voisins, [name]: separes ? a.name : a.label });
    setAdresses([]);
    setTape(false);
  }

  // ── Texte proposé par l'IA (champs à rédiger) ─────────────────────────────
  const [redaction, setRedaction] = useState<"idle" | "loading" | "error">("idle");
  async function proposerTexte() {
    setRedaction("loading");
    try {
      const titre = editor.state.doc.firstChild?.textContent ?? "";
      const pos = typeof getPos === "function" ? getPos() : undefined;
      const phrase = typeof pos === "number" ? editor.state.doc.resolve(pos).parent.textContent : "";
      const remplis = champsDuDocument(editor)
        .filter((c) => c.value.trim() && c.id !== name)
        .slice(0, 30)
        .map((c) => `- ${c.label} : ${c.value}`)
        .join("\n");
      const prompt =
        `Contrat : « ${titre} ». Rédige le contenu du champ « ${label} », qui s'insère dans la phrase : « ${phrase} ». ` +
        `Informations déjà connues :\n${remplis || "(aucune)"}\n` +
        `Consignes : français juridique clair, concret, adapté à ce contrat ; 1 à 3 phrases, 60 mots maximum ; ` +
        `n'invente aucun nom, montant ni date absent des informations connues ; ` +
        `réponds UNIQUEMENT avec le texte du champ, sans guillemets ni introduction.`;
      const texte = (await callOpenAi52(prompt, "low", "low", "gpt-5.4-nano")).trim().replace(/^["«\s]+|["»\s]+$/g, "");
      if (!texte) throw new Error("vide");
      updateAttributes({ value: texte, origin: "suggestion" });
      setRedaction("idle");
    } catch {
      setRedaction("error");
    }
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
  const listeSocietes = societes.length > 0;
  const listeAdresses = !listeSocietes && adresses.length > 0;
  const proposerRedaction = redige && focus && !value;
  const menu = listeSocietes || listeAdresses || pastilles.length > 0 || proposerRedaction;

  const commun = {
    value,
    placeholder,
    title: suggere ? `${label} — suggestion à valider` : label,
    "data-var-name": name,
    "data-origin": origin,
    // Modifier une suggestion vaut validation : la valeur devient celle de
    // l'utilisateur.
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setTape(true);
      updateAttributes({ value: e.target.value, origin: "" });
    },
    onFocus: () => setFocus(true),
    onBlur: () => { setFocus(false); setTape(false); },
  };

  // Un texte rédigé long ne tient pas dans un champ d'une ligne : il passe
  // sur plusieurs lignes, à pleine largeur.
  const long = redige && value.length > 40;

  return (
    <NodeViewWrapper as="span" contentEditable={false} className={`relative align-baseline ${long ? "block py-0.5" : ""}`}>
      {long ? (
        <textarea
          {...commun}
          rows={Math.min(6, Math.ceil(value.length / 90) + 1)}
          className={`block w-full resize-none rounded-chip px-2 py-1 text-[13px] font-medium leading-relaxed outline-none transition focus:ring-2 focus:ring-brand/25 ${style}`}
        />
      ) : (
        <input
          {...commun}
          // Largeur calée sur le contenu, mais plafonnée : un libellé long ne doit
          // jamais faire déborder le champ du cadre du contrat (il est alors tronqué).
          size={Math.min(28, Math.max(6, (value || placeholder).length))}
          className={`mx-0.5 inline max-w-full text-ellipsis rounded-chip px-1.5 py-[1px] text-[13px] font-medium outline-none transition focus:ring-2 focus:ring-brand/25 ${style}`}
        />
      )}
      {suggere && (
        <span className="mr-0.5 select-none align-super text-[9px] font-semibold uppercase tracking-wide text-violet-600">
          Suggéré
        </span>
      )}
      {menu && (
        // onMouseDown + preventDefault : le champ garde le focus, le clic
        // n'est pas perdu dans le blur.
        <span className="absolute left-0 top-full z-30 mt-1 flex w-max min-w-[12rem] max-w-[24rem] flex-wrap gap-1 rounded-lg border border-line bg-white p-1.5 shadow-card">
          {listeSocietes ? (
            societes.map((s) => {
              const o = formatCompanyOption(s);
              return (
                <button
                  key={s.siren ?? o.title}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); choisirSociete(s); }}
                  className="block w-full rounded px-2 py-1 text-left hover:bg-brand-light"
                >
                  <span className="block truncate text-xs font-semibold text-ink">{o.title}</span>
                  <span className="block truncate text-[11px] text-ink-muted">{o.subtitle}</span>
                </button>
              );
            })
          ) : listeAdresses ? (
            adresses.map((a) => (
              <button
                key={a.label}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); choisirAdresse(a); }}
                className="block w-full truncate rounded px-2 py-1 text-left text-xs text-ink hover:bg-brand-light"
              >
                {a.label}
              </button>
            ))
          ) : (
            <>
              {pastilles.map((p) => (
                <button
                  key={p.libelle}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); updateAttributes({ value: p.valeur, origin: "" }); }}
                  className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-medium text-brand hover:bg-brand hover:text-white"
                >
                  {p.libelle}
                </button>
              ))}
              {proposerRedaction && (
                <button
                  type="button"
                  disabled={redaction === "loading"}
                  onMouseDown={(e) => { e.preventDefault(); void proposerTexte(); }}
                  className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-60"
                >
                  {redaction === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {redaction === "error" ? "Réessayer" : "Proposer un texte"}
                </button>
              )}
            </>
          )}
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
