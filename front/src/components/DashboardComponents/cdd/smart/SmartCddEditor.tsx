// Éditeur de contrat « document d'abord » — générique (piloté par un ContractModel).
// Intégré dans la mise en page de l'app (menu latéral + header conservés). Le fil
// d'ariane est déposé dans le header partagé via un portail (#page-header-slot) ;
// un bandeau (barre d'outils + « Générer le contrat ») surplombe la zone de contenu,
// puis les deux blocs (« Champs à compléter » + document éditable) côte à côte.
// Utilisé pour tous les types de contrat (CDD, CDI, avenant, disciplinaire, rupture).
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { jsPDF } from "jspdf";
import {
  Download, FileText, FileSignature, Bold, Italic, List, Quote,
  Sparkles, X, Loader2, ShieldCheck, ShieldAlert, MessagesSquare, Check, ChevronDown, Share2,
} from "lucide-react";
import { cddAccroissementModel } from "../../../../contractEngine/models/cddAccroissement";
import type { ContractModel } from "../../../../contractEngine/types";
import { createInitialState } from "../../../../contractEngine/state";
import { splitSegments } from "../../../../contractEngine/segments";
import { Variable } from "./VariableNode";
import { CompanySearchField } from "../../../common/CompanySearchField";
import { PartyPrefill } from "../../../common/PartyPrefill";
import { mapCompanyToContractParty, formatConventionFromCompany } from "../../../../utils/companyLookup";
import type { CompanyResult } from "../../../../types/companySearch";
import ReactMarkdown from "react-markdown";
import { instructClause, instructContract, verifyConvention } from "./clauseAi";
import { contractApi } from "../../contratheque/api";
import { negotiationApi } from "../../negotiation/api";
import { ShareContractPanel, guessSide, SIDE_CYCLE, type ShareMode } from "../../negotiation/ShareContractPanel";
import { PipelineStepBar } from "../../negotiation/PipelineStepBar";
import type { FieldSide } from "../../negotiation/types";
import { fetchProxy } from "../../../../utils/fetchProxy";

const isEmptyClause = (c: string) => c.trim() === "Sans objet.";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Convertit un contenu modèle (avec {{var}}) en HTML (texte + spans variables).
 * `values` permet de restaurer les valeurs déjà saisies (ex. après réécriture IA).
 */
function segmentsToHtml(
  content: string,
  varLabel: Map<string, string>,
  values?: Record<string, string>,
): string {
  return splitSegments(content)
    .map((seg) =>
      seg.type === "text"
        ? escapeHtml(seg.text)
        : `<span data-variable="${seg.name}" data-label="${escapeHtml(varLabel.get(seg.name) ?? seg.name)}" data-value="${escapeHtml(values?.[seg.name] ?? "")}"></span>`,
    )
    .join("");
}

/** Résout le contenu effectif d'un bloc (contenu par défaut ou option d'alternative). */
function resolveBlockContent(model: ContractModel, block: ContractModel["blocks"][number]): string {
  if (!block.alternativeId) return block.content;
  const state = createInitialState(model);
  const alt = model.alternatives.find((a) => a.id === block.alternativeId);
  const opt = alt?.options.find((o) => o.id === state.alternatives[block.alternativeId!]);
  return opt?.content ?? block.content;
}

/** Document de départ : contrat complet par défaut, variables vides surlignées. */
function buildInitialHtml(model: ContractModel, varLabel: Map<string, string>): string {
  let html = "";
  for (const block of model.blocks) {
    const content = resolveBlockContent(model, block);
    if (isEmptyClause(content)) continue;
    if (block.kind === "title") {
      html += `<h2>${escapeHtml(content)}</h2>`;
      continue;
    }
    if (block.heading) html += `<h3>${escapeHtml(block.heading)}</h3>`;
    // Respecte la structure : double saut de ligne = nouveau paragraphe, simple = <br>.
    // (Sans cela, ProseMirror écrase tous les \n et affiche la section en un seul bloc.)
    for (const para of content.split(/\n{2,}/)) {
      if (!para.trim()) continue;
      html += `<p>${segmentsToHtml(para, varLabel).replace(/\n/g, "<br>")}</p>`;
    }
  }
  return html;
}

/** Retire un préfixe « Article N – / Article N. » d'un intitulé de section (numérotation superflue). */
function stripArticlePrefix(heading: string): string {
  const cleaned = heading.replace(/^article\s+\d+\s*(?:[–\-—.:)]\s*)?/i, "").trim();
  return cleaned || heading.trim();
}

/** Regroupe les variables par section (heading du bloc) pour le panneau « Champs à compléter ». */
interface FieldGroup { id: string; label: string; varIds: string[] }
function buildFieldGroups(model: ContractModel): FieldGroup[] {
  const seen = new Set<string>();
  const groups: FieldGroup[] = [];
  for (const block of model.blocks) {
    if (block.kind === "title") continue;
    const content = resolveBlockContent(model, block);
    if (isEmptyClause(content)) continue;
    const label = block.heading?.trim()
      ? stripArticlePrefix(block.heading)
      : (block.kind === "preamble" ? "Parties" : "Préambule");
    const fresh: string[] = [];
    for (const seg of splitSegments(content)) {
      if (seg.type === "var" && !seen.has(seg.name)) {
        seen.add(seg.name);
        fresh.push(seg.name);
      }
    }
    if (!fresh.length) continue;
    const existing = groups.find((g) => g.label === label);
    if (existing) existing.varIds.push(...fresh);
    else groups.push({ id: block.id, label, varIds: fresh });
  }
  return groups;
}

// — Sérialisation pour l'export PDF —
type JNode = { type: string; attrs?: Record<string, unknown>; text?: string; content?: JNode[] };
function inlineText(nodes?: JNode[]): string {
  if (!nodes) return "";
  return nodes
    .map((n) =>
      n.type === "text" ? n.text ?? ""
      : n.type === "variable" ? (String(n.attrs?.value || "") || "…")
      : inlineText(n.content),
    )
    .join("");
}

/** Sérialisation pour l'IA : les variables restent des marqueurs {{nom}}. */
function markerText(nodes?: JNode[]): string {
  if (!nodes) return "";
  return nodes
    .map((n) =>
      n.type === "text" ? n.text ?? ""
      : n.type === "variable" ? `{{${String(n.attrs?.name ?? "")}}}`
      : markerText(n.content),
    )
    .join("");
}

/**
 * Sérialisation mixte (complétion guidée) : marqueurs `{{nom}}` pour les champs
 * assignés aux autres parties, valeur en clair pour les champs du créateur.
 */
function mixedText(nodes: JNode[] | undefined, externalIds: Set<string>): string {
  if (!nodes) return "";
  return nodes
    .map((n) => {
      if (n.type === "text") return n.text ?? "";
      if (n.type === "variable") {
        const name = String(n.attrs?.name ?? "");
        return externalIds.has(name) ? `{{${name}}}` : String(n.attrs?.value || "");
      }
      return mixedText(n.content, externalIds);
    })
    .join("");
}

interface Props {
  onBack: () => void;
  /** Modèle de contrat à éditer. Par défaut : CDD accroissement (rétro-compat). */
  model?: ContractModel;
  /** Base du nom de fichier exporté (sans extension). */
  fileBase?: string;
}

export function SmartCddEditor({ onBack, model = cddAccroissementModel, fileBase = "CDD-accroissement" }: Props) {
  const navigate = useNavigate();

  // Emplacement réservé dans le header de l'app (MainLayout) pour y déposer le fil d'ariane.
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHeaderSlot(document.getElementById("page-header-slot"));
  }, []);

  const varLabel = useMemo(() => new Map(model.variables.map((v) => [v.id, v.label])), [model]);
  const initialHtml = useMemo(() => buildInitialHtml(model, varLabel), [model, varLabel]);
  const fieldGroups = useMemo(() => buildFieldGroups(model), [model]);
  const hasConvention = useMemo(
    () => model.variables.some((v) => v.id === "convention_collective"),
    [model],
  );
  // Pré-remplissage employeur : pertinent seulement pour les modèles « employeur ».
  const hasEmployer = useMemo(
    () => model.variables.some((v) => v.id === "emp_denomination"),
    [model],
  );

  // Tick incrémenté à chaque modification du document : permet de recalculer
  // l'avancement (champs remplis) sans stocker une seconde source de vérité.
  const [tick, setTick] = useState(0);

  const editor = useEditor(
    {
      extensions: [StarterKit, Variable],
      content: initialHtml,
      onUpdate: () => setTick((t) => t + 1),
    },
    [initialHtml],
  );

  // Valeurs live des variables (dérivées du document ProseMirror à chaque tick).
  const values = useMemo(() => {
    const map: Record<string, string> = {};
    editor?.state.doc.descendants((node) => {
      if (node.type.name === "variable") map[node.attrs.name as string] = (node.attrs.value as string) || "";
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, tick]);

  const isFilled = (name: string) => (values[name] ?? "").trim().length > 0;

  /** Focus + défilement vers le premier champ non rempli d'une section (ou le premier). */
  const scrollToGroup = (group: FieldGroup) => {
    const root = editor?.view.dom;
    if (!root) return;
    const target = group.varIds.find((v) => !isFilled(v)) ?? group.varIds[0];
    const el = root.querySelector<HTMLInputElement>(`input[data-var-name="${target}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    }
  };

  const setVar = (name: string, value: string) => {
    editor?.commands.command(({ tr, state }) => {
      state.doc.descendants((node, pos) => {
        if (node.type.name === "variable" && node.attrs.name === name) {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, value });
        }
      });
      return true;
    });
  };

  const applyCompany = (result: CompanyResult, siret?: string) => {
    const p = mapCompanyToContractParty(result, siret);
    if (p.nom) setVar("emp_denomination", p.nom);
    if (p.siren) setVar("emp_siren", p.siren);
    const adresse = [p.code_postal, p.ville].filter(Boolean).join(" ");
    if (adresse) setVar("emp_adresse", adresse);
    if (p.representant) setVar("emp_representant", p.representant);
    if (p.qualite) setVar("emp_qualite", p.qualite);
  };

  // ── IA par clause (survol à droite) ──────────────────────────────────────
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ top: number; el: HTMLElement } | null>(null);
  const [ai, setAi] = useState<
    | { el: HTMLElement; top: number; original: string; instruction: string; loading: boolean; result: string | null; error: string | null }
    | null
  >(null);

  /** Bloc de premier niveau (enfant direct de la racine ProseMirror) survolé. */
  const topBlock = (target: HTMLElement): HTMLElement | null => {
    const root = editor?.view.dom;
    if (!root) return null;
    let node: HTMLElement | null = target;
    while (node && node.parentElement !== root) node = node.parentElement;
    return node;
  };

  const HEADINGS = new Set(["H1", "H2", "H3", "H4"]);

  const onMouseMove = (e: React.MouseEvent) => {
    const blk = topBlock(e.target as HTMLElement);
    if (!blk || !wrapRef.current) return;

    // Ancre le bouton au TITRE de la clause, cible le paragraphe (corps).
    let heading: Element | null = null;
    let paragraph: Element | null = null;
    if (HEADINGS.has(blk.tagName)) {
      heading = blk;
      let n = blk.nextElementSibling;
      while (n && n.tagName !== "P") n = n.nextElementSibling;
      paragraph = n;
    } else if (blk.tagName === "P") {
      paragraph = blk;
      let n = blk.previousElementSibling;
      while (n && !HEADINGS.has(n.tagName)) n = n.previousElementSibling;
      heading = n;
    }
    if (!paragraph) return;

    const anchor = (heading ?? paragraph) as HTMLElement;
    const top = anchor.getBoundingClientRect().top - wrapRef.current.getBoundingClientRect().top;
    const para = paragraph as HTMLElement;
    setHover((h) => (h?.el === para ? h : { el: para, top }));
  };

  const openAi = () => {
    if (!hover) return;
    // Sérialise la clause en conservant les variables sous forme {{NOM}}, afin que
    // l'IA les préserve et qu'on puisse les recréer ensuite (sinon elles sont perdues).
    let original = hover.el.textContent ?? "";
    if (editor) {
      try {
        const pos = editor.view.posAtDOM(hover.el, 0);
        const node = editor.state.doc.resolve(pos).parent;
        let out = "";
        node.forEach((child) => {
          out += child.type.name === "variable" ? `{{${child.attrs.name}}}` : child.textContent;
        });
        if (out.trim()) original = out;
      } catch { /* repli sur textContent */ }
    }
    setAi({ el: hover.el, top: hover.top, original, instruction: "", loading: false, result: null, error: null });
  };

  const runInstruction = async () => {
    if (!ai || !ai.instruction.trim()) return;
    setAi((a) => (a ? { ...a, loading: true, error: null } : a));
    try {
      const txt = await instructClause(ai.original, ai.instruction);
      setAi((a) => (a ? { ...a, loading: false, result: txt } : a));
    } catch {
      setAi((a) => (a ? { ...a, loading: false, error: "IA indisponible. Vérifiez que le service est lancé." } : a));
    }
  };

  const acceptAi = () => {
    if (!ai?.result || !editor) return;
    const pos = editor.view.posAtDOM(ai.el, 0);
    const $p = editor.state.doc.resolve(pos);
    const from = $p.before(1), to = $p.after(1);
    // Reconstruit le paragraphe en re-parsant les {{NOM}} en variables surlignées
    // (au lieu d'un texte brut qui supprimerait les variables de la clause).
    const html = `<p>${segmentsToHtml(ai.result, varLabel).replace(/\n/g, "<br>")}</p>`;
    editor.chain().focus().insertContentAt({ from, to }, html).run();
    setAi(null);
    setHover(null);
  };

  // ── Vérification convention collective ───────────────────────────────────
  const readVar = (name: string): string => {
    let v = "";
    editor?.state.doc.descendants((node) => {
      if (node.type.name === "variable" && node.attrs.name === name) v = (node.attrs.value as string) || "";
    });
    return v;
  };
  const [cc, setCc] = useState<{ open: boolean; loading: boolean; result: string | null; error: string | null }>(
    { open: false, loading: false, result: null, error: null },
  );
  const runCc = async () => {
    setCc({ open: true, loading: true, result: null, error: null });
    try {
      const result = await verifyConvention(readVar("convention_collective"), readVar("poste_intitule"), readVar("emp_code_naf"));
      setCc({ open: true, loading: false, result, error: null });
    } catch {
      setCc({ open: true, loading: false, result: null, error: "Vérification indisponible (service IA non joignable)." });
    }
  };

  const [genOpen, setGenOpen] = useState(false);
  const [ccPanel, setCcPanel] = useState(false);
  const [ccFinderMsg, setCcFinderMsg] = useState<string | null>(null);
  const [negoLoading, setNegoLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Partage à l'autre partie (négociation ou complétion guidée) — panneau
  // latéral intégré : on reste sur le contrat, pas de pop-up.
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMode, setShareMode] = useState<ShareMode>("choice");
  const [shareSides, setShareSides] = useState<Record<string, FieldSide>>({});
  const [sharedNego, setSharedNego] = useState<{ id: string; mode: "NEGOTIATION" | "COMPLETION" } | null>(null);


  /** Ouvre le panneau de partage en (ré)initialisant l'assignation heuristique
   *  d'après les valeurs actuellement saisies dans le document. */
  const openShare = () => {
    const map: Record<string, FieldSide> = {};
    for (const v of model.variables) {
      map[v.id] = shareSides[v.id] ?? guessSide({ id: v.id, label: v.label, value: values[v.id] ?? "" });
    }
    setShareSides(map);
    setShareMode("choice");
    setShareOpen(true);
  };
  const shareSideOf = (id: string): FieldSide => shareSides[id] ?? "COUNTERPARTY";

  // Mode « assignation » : les champs du document sont colorés par partie et un
  // clic change l'assignation (au lieu d'éditer la valeur).
  const assignMode = shareOpen && shareMode === "completion";

  // Dépose la couleur d'assignation sur chaque champ du document via un
  // attribut data-share-side (stylé par les variantes arbitraires ci-dessous).
  useEffect(() => {
    const root = editor?.view.dom;
    if (!root) return;
    const inputs = root.querySelectorAll<HTMLInputElement>("input[data-var-name]");
    inputs.forEach((el) => {
      if (assignMode) el.setAttribute("data-share-side", shareSideOf(el.dataset.varName ?? ""));
      else el.removeAttribute("data-share-side");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignMode, shareSides, editor, tick]);

  /** En mode assignation, un clic sur un champ du contrat fait tourner
   *  l'assignation (Moi → L'autre partie → Un tiers) sans ouvrir la saisie. */
  const onAssignMouseDown = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest?.("input[data-var-name]") as HTMLInputElement | null;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const id = el.dataset.varName ?? "";
    setShareSides((m) => {
      const cur = m[id] ?? "COUNTERPARTY";
      const next = SIDE_CYCLE[(SIDE_CYCLE.indexOf(cur) + 1) % SIDE_CYCLE.length];
      return { ...m, [id]: next };
    });
  };
  // Accès direct à la barre « Modifier avec l'IA » depuis la barre d'outils.
  const globalAiInputRef = useRef<HTMLInputElement>(null);
  const focusGlobalAi = () => {
    globalAiInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    globalAiInputRef.current?.focus({ preventScroll: true });
  };

  // ── Modification globale par l'IA (barre sticky sous le contrat) ─────────
  const [globalAi, setGlobalAi] = useState<{
    instruction: string;
    loading: boolean;
    error: string | null;
    applied: boolean;
  }>({ instruction: "", loading: false, error: null, applied: false });

  /** Sérialise le document complet pour l'IA (# titre, ### articles, {{variables}}). */
  const serializeDoc = (): string => {
    if (!editor) return "";
    const json = editor.getJSON() as JNode;
    const lines: string[] = [];
    for (const n of json.content ?? []) {
      const txt = markerText(n.content);
      if (!txt.trim()) continue;
      if (n.type === "heading") lines.push((n.attrs?.level === 2 ? "# " : "### ") + txt);
      else lines.push(txt);
    }
    return lines.join("\n\n");
  };

  /** Remplace tout le document par la version réécrite (annulable via Ctrl+Z). */
  const applyRewrite = (newText: string) => {
    if (!editor) return;
    // Conserve les valeurs déjà saisies dans les variables.
    const savedValues: Record<string, string> = {};
    editor.state.doc.descendants((node) => {
      if (node.type.name === "variable" && node.attrs.value) {
        savedValues[node.attrs.name as string] = node.attrs.value as string;
      }
    });
    let html = "";
    for (const block of newText.split(/\n{2,}/)) {
      const t = block.trim();
      if (!t) continue;
      if (t.startsWith("# ")) html += `<h2>${escapeHtml(t.slice(2))}</h2>`;
      else if (t.startsWith("### ")) html += `<h3>${segmentsToHtml(t.slice(4), varLabel, savedValues)}</h3>`;
      else html += `<p>${segmentsToHtml(t, varLabel, savedValues).replace(/\n/g, "<br>")}</p>`;
    }
    if (!html) return;
    // insertContentAt sur toute la plage = transaction annulable (contrairement à setContent).
    editor.chain().focus().insertContentAt({ from: 0, to: editor.state.doc.content.size }, html).run();
  };

  const runGlobalAi = async () => {
    if (!editor || !globalAi.instruction.trim() || globalAi.loading) return;
    setGlobalAi((g) => ({ ...g, loading: true, error: null, applied: false }));
    try {
      const rewritten = await instructContract(serializeDoc(), globalAi.instruction);
      applyRewrite(rewritten);
      setGlobalAi({ instruction: "", loading: false, error: null, applied: true });
    } catch {
      setGlobalAi((g) => ({
        ...g,
        loading: false,
        error: "IA indisponible. Vérifiez que le service est lancé.",
      }));
    }
  };

  /** Identifie la convention via l'entreprise (open data : IDCC). */
  const pickConvention = (result: CompanyResult, siret?: string) => {
    const conv = formatConventionFromCompany(result, siret);
    if (conv) {
      setVar("convention_collective", conv);
      setCcFinderMsg(`Convention appliquée : ${conv}`);
    } else {
      setCcFinderMsg("Aucune convention collective (IDCC) trouvée — saisissez-la manuellement dans le contrat.");
    }
  };

  /** Construit le PDF du contrat (réutilisé pour l'export et la signature). */
    const [isFreemium, setIsFreemium] = useState<boolean | null>(null);
    useEffect(() => {
      let isCurrent = true;

      fetchProxy("/api/billing/subscription", {credentials : "include"}).then((res) => res.ok ? res.json() : null).then((data) => {
        if (!isCurrent) return;

        const hasActivePaidPlan = data !== null && data?.status === "ACTIVE" && data?.planName !== "Freemium";
        if (hasActivePaidPlan) {
          setIsFreemium(false);
        } else {
          setIsFreemium(true);
        }
      }).catch(() => {
        if (isCurrent) setIsFreemium(true);
      });
      return () => {
        isCurrent = false;
      };
    }, []);

  const buildPdfDoc = () => {
    const json = editor!.getJSON() as JNode;
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 56, maxW = pdf.internal.pageSize.getWidth() - margin * 2, pageH = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    let y = margin;
    const block = (txt: string, bold: boolean, size: number, gap = 8) => {
      pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setFontSize(size);
      for (const line of pdf.splitTextToSize(txt || " ", maxW) as string[]) {
        if (y + size + 2 > pageH - margin) { pdf.addPage(); y = margin; }
        pdf.text(line, margin, y); y += size + 2;
      }
      y += gap;
    };
    for (const n of json.content ?? []) {
      const txt = inlineText(n.content);
      if (n.type === "heading") block(txt, true, n.attrs?.level === 2 ? 15 : 11.5, 4);
      else if (txt.trim()) block(txt, false, 10.5, 8);
    }
    if (isFreemium) {
      addFiligraneToPdf(pdf, pageWidth, margin, pageH);
    }
    return pdf;
  };

  const addFiligraneToPdf = (pdf: jsPDF, pageWidth: number, margin: number, pageH: number) => {
    const totalPages = pdf.getNumberOfPages();
    const rightX = pageWidth - margin;
    const center = pageWidth / 2;
    const paddingX = 8;
    const paddingY = 4;
    const fontSize = 10;
    const borderRadius = 4;
    const text = "Généré par Lumen Juris";

    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor("#213957");
      pdf.setDrawColor("#213957");
      pdf.setLineWidth(1);

      const textWidth = pdf.getTextWidth(text);
      const boxW = textWidth + paddingX * 2;
      const boxH = fontSize + 2 * paddingY;
      
      if (i === 1) {
        const centerY = 32;
        const boxX = rightX - boxW;
        const boxY = centerY - fontSize;
        pdf.roundedRect(boxX, boxY, boxW, boxH, borderRadius, borderRadius, "S")
        pdf.text(text, rightX - paddingX, centerY, {align: "right", baseline: "middle"});
      } else {
        const centerY = pageH - 32;
        const boxX = center - boxW / 2;
        const boxY = centerY - fontSize;
        pdf.roundedRect(boxX, boxY, boxW, boxH, borderRadius, borderRadius, "S");
        pdf.text(text, center, centerY, {align: "center", baseline:"middle"});
      }
    }
  }

  const exportPdf = () => {
    if (!editor) return;
    buildPdfDoc().save(`${fileBase}.pdf`);
  };

  /** Génère le PDF et l'envoie directement dans le module Signature. */
  const goSignature = () => {
    if (!editor) { navigate("/signature"); return; }
    const incomingPdf = buildPdfDoc().output("datauristring");
    navigate("/signature", { state: { incomingPdf, incomingName: `${fileBase}.pdf` } });
  };

  /** Texte brut du contrat (paragraphes séparés) pour la révision / négociation. */
  const getContractText = () => {
    if (!editor) return "";
    const json = editor.getJSON() as JNode;
    return (json.content ?? [])
      .map((n) => inlineText(n.content))
      .filter((t) => t.trim())
      .join("\n\n");
  };

  /** Réviser le contrat : ouvre l'analyse des risques (surlignage + modale) sur ce contrat. */
  const goReview = () => {
    if (!editor) { navigate("/analyzer"); return; }
    navigate("/analyzer", { state: { text: getContractText(), fileName: fileBase } });
  };

  /** Enregistre le contrat en contrathèque (PDF + texte) et renvoie son identifiant. */
  const saveToContratheque = async (): Promise<{ id: string }> => {
    const dataUri = buildPdfDoc().output("datauristring");
    const fileBase64 = dataUri.split(",")[1] ?? "";
    const created = await contractApi.create({
      title: fileBase,
      ocrText: getContractText(),
      fileBase64,
      metadataFields: [],
      contractType: model.label ?? null,
      counterpartyName: null,
      currency: "EUR",
      renewalType: "NONE",
      status: "ACTIVE",
    });
    return { id: created.id };
  };

  /** Négocier : enregistre le contrat en contrathèque puis ouvre l'espace de négociation. */
  const goNegotiation = async () => {
    if (!editor || negoLoading) return;
    setNegoLoading(true);
    setActionError(null);
    try {
      const created = await saveToContratheque();
      const nego = await negotiationApi.enter(created.id, `Négociation — ${fileBase}`);
      navigate(`/negociation/${nego.id}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Impossible d'ouvrir la négociation.");
      setNegoLoading(false);
    }
  };

  /** Sérialisation mixte pour la complétion guidée (marqueurs côté autres parties). */
  const getMarkedContractText = (externalIds: Set<string>) => {
    if (!editor) return "";
    const json = editor.getJSON() as JNode;
    return (json.content ?? [])
      .map((n) => mixedText(n.content, externalIds))
      .filter((t) => t.trim())
      .join("\n\n");
  };

  const exportDocx = async () => {
    if (!editor) return;
    const json = editor.getJSON() as JNode;
    const docx = await import("docx");
    const { saveAs } = await import("file-saver");
    const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Header, Footer } = docx;
    const children = (json.content ?? []).map((n) => {
      const txt = inlineText(n.content);
      if (n.type === "heading") {
        const isTitle = n.attrs?.level === 2;
        return new Paragraph({
          heading: isTitle ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
          alignment: isTitle ? AlignmentType.CENTER : undefined,
          children: [new TextRun({ text: txt, bold: true })],
        });
      }
      return new Paragraph({ children: [new TextRun(txt)] });
    });
    
    const waterMark = new TextRun({
      text: "Généré par Lumen Juris", bold: true, size: 18, color: "213957"
    })
    const firstPageHeader = new Header({
      children: [new Paragraph({alignment: AlignmentType.RIGHT, children: [waterMark]})],
    })
    const footer = new Footer({
      children: [new Paragraph({alignment: AlignmentType.RIGHT, children: [waterMark]})],
    })
    const wordDoc = new Document({
      styles: { default: { document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { line: 276 } } } } },
      sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1800, right: 1800 } }, titlePage: !!isFreemium, },headers: isFreemium ? {first: firstPageHeader} : undefined, footers: isFreemium ? {default: footer} : undefined, children }],
    });
    const blob = await docx.Packer.toBlob(wordDoc);
    saveAs(blob, `${fileBase}.docx`);
  };

  const tbtn = (active: boolean) =>
    `rounded-lg p-1.5 transition-colors ${active ? "bg-brand text-white" : "text-ink-muted hover:bg-surface-muted hover:text-ink-secondary"}`;

  /** Élément du menu « Générer le contrat ». */
  const MenuItem = ({ icon: Icon, label, onClick, tone = "default" }: {
    icon: React.ElementType; label: string; onClick: () => void; tone?: "default" | "brand";
  }) => (
    <button
      onClick={() => {  setGenOpen(false); onClick(); }}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-subtle ${
        tone === "brand" ? "font-medium text-brand" : "text-ink-secondary"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" /> {label}
    </button>
  );

  return (
    <div className={`mx-auto ${shareOpen ? "max-w-7xl" : "max-w-6xl"}`}>
      {/* Fil d'ariane cliquable (sans flèche) déposé dans le header de l'app. */}
      {headerSlot && createPortal(
        <nav className="flex min-w-0 items-center gap-1.5 text-sm">
          <button onClick={onBack} className="shrink-0 text-ink-muted transition-colors hover:text-brand hover:underline">
            Modèles
          </button>
          <span className="shrink-0 text-ink-placeholder">/</span>
          <span className="truncate font-medium text-ink-secondary">{model.label}</span>
        </nav>,
        headerSlot,
      )}

      {/* Fil de l'expérience : Rédiger → Compléter → Partager → Signer */}
      <div className="mb-4">
        <PipelineStepBar
          state={{
            filled: model.variables.filter((v) => isFilled(v.id)).length,
            total: model.variables.length,
            shared: Boolean(sharedNego),
            sharedMode: sharedNego?.mode,
          }}
          onShare={openShare}
          onSign={goSignature}
          onFollow={() => sharedNego && navigate(`/negociation/${sharedNego.id}`)}
        />
      </div>

      {/* Corps : panneau latéral + éditeur. En mode partage, la colonne
          s'élargit pour accueillir le panneau (on reste sur le contrat). */}
      <div className={`grid grid-cols-1 items-start gap-6 ${shareOpen ? "lg:grid-cols-[19rem_minmax(0,1fr)]" : "lg:grid-cols-[16rem_minmax(0,1fr)]"}`}>
        {/* Voile gris très léger sur le contenu pendant le partage : borné sous
            le header (top-16) et sous le menu latéral (z-30 > 25), au-dessus de
            la barre d'outils du document (z-20) pour un grisé uniforme, sans
            bande blanche. Le contenu reste cliquable (pointer-events-none). */}
        {shareOpen && <div aria-hidden className="fixed inset-x-0 top-16 bottom-0 z-[25] bg-ink/[0.03] pointer-events-none" />}
        {/* Colonne gauche — alignée en haut (self-start) et fixée au scroll (sticky).
            top-[4.5rem] : sous le header de l'app (h-14 = 56px) avec un petit écart
            de 16px, à la même hauteur que la barre de fonctions sticky de l'éditeur. */}
        {/* max-h + overflow interne : un panneau plus haut que l'écran ne peut
            pas « suivre » le défilement — on le borne pour que le sticky opère. */}
        <aside className={`space-y-4 self-start lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1 ${shareOpen ? "relative z-30" : ""}`}>
          {/* En mode partage, le panneau remplace la liste des champs : on
              assigne les champs directement dans le contrat, sans pop-up. */}
          {shareOpen && (
            <ShareContractPanel
              onClose={() => setShareOpen(false)}
              title={model.label || fileBase}
              variables={model.variables.map((v) => ({ id: v.id, label: v.label, value: values[v.id] ?? "" }))}
              mode={shareMode}
              onModeChange={setShareMode}
              sideOf={shareSideOf}
              onSideChange={(id, side) => setShareSides((m) => ({ ...m, [id]: side }))}
              getMarkedText={getMarkedContractText}
              getPlainText={getContractText}
              createContract={saveToContratheque}
              onShared={(r) => setSharedNego({ id: r.negotiationId, mode: r.mode })}
            />
          )}
          <div className={`rounded-2xl border border-line bg-white p-4 shadow-card ${shareOpen ? "hidden" : ""}`}>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-ink-subtle">
              Champs à compléter
            </p>
            <ul className="space-y-1">
              {fieldGroups.map((g) => {
                const complete = g.varIds.every(isFilled);
                return (
                  <li key={g.id}>
                    <button
                      onClick={() => scrollToGroup(g)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                        complete ? "bg-brand-light" : "hover:bg-surface-subtle"
                      }`}
                    >
                      <span className={`min-w-0 flex-1 truncate text-sm ${complete ? "font-medium text-ink" : "text-ink-secondary"}`}>
                        {g.label}
                      </span>
                      {complete && <Check className="h-4 w-4 shrink-0 text-brand" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Pré-remplissage des parties par recherche d'entreprise, ici, au moment
              où l'on remplit les champs du contrat. Générique : fonctionne aussi
              bien sur les modèles à champs fixes (emp_*) que sur les contrats
              générés de zéro, dont les noms de champs sont produits par l'IA. */}
          {!shareOpen && <PartyPrefill variables={model.variables} setVar={setVar} />}
        </aside>

        {/* Colonne éditeur */}
        <div className="min-w-0 space-y-3">
          {/* Le contrat — entièrement éditable, avec sa barre de fonctions en en-tête */}
          <div className="rounded-2xl border border-line bg-white shadow-card">
            {/* Barre de fonctions en haut du bloc éditeur — sticky : vient se
                coller directement sous le header de l'app (h-16) pendant le
                défilement, sans écart ni bande de raccord. */}
            <div className="sticky top-16 z-20 -mx-px -mt-px flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border border-line border-b-line-subtle bg-white px-4 py-2.5">
              {editor && (
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" className={tbtn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></button>
                  <button type="button" className={tbtn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></button>
                  <button type="button" className={tbtn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></button>
                  <button type="button" className={tbtn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></button>
                </div>
              )}

              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={focusGlobalAi}
                  title="Demander une modification du contrat en langage naturel"
                  className="hidden items-center gap-1.5 rounded-full border border-brand/30 bg-brand-light/50 px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand-light sm:inline-flex"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Modifier avec l&apos;IA
                </button>
                <div className="relative">
                  <button
                    onClick={() => setGenOpen((o) => !o)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-brand-hover"
                  >
                    Générer le contrat <ChevronDown className={`h-3.5 w-3.5 transition-transform ${genOpen ? "rotate-180" : ""}`} />
                  </button>
                  {genOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setGenOpen(false)} />
                      <div className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-card-md">
                        <MenuItem icon={Share2} label="Partager à l'autre partie" onClick={openShare} tone="brand" />
                        <MenuItem icon={FileSignature} label="Envoyer en signature" onClick={goSignature} />
                        <MenuItem icon={MessagesSquare} label="Ouvrir la négociation" onClick={() => void goNegotiation()} />
                        <MenuItem icon={ShieldAlert} label="Réviser (risques)" onClick={goReview} />
                        {hasConvention && (
                          <MenuItem icon={ShieldCheck} label="Convention collective" onClick={() => setCcPanel(true)} />
                        )}
                        <div className="my-1 border-t border-line-subtle" />
                        <MenuItem icon={Download} label="Télécharger en PDF" onClick={exportPdf} />
                        {!isFreemium &&(
                          <MenuItem icon={FileText} label="Télécharger en Word"  onClick={() => void exportDocx()} />
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Document */}
            <div
              ref={wrapRef}
              onMouseMove={onMouseMove}
              onMouseLeave={() => setHover(null)}
              onMouseDownCapture={assignMode ? onAssignMouseDown : undefined}
              className="relative min-h-[60vh] px-10 pb-10 pt-6
                [&_input[data-share-side]]:cursor-pointer
                [&_input[data-share-side=OWNER]]:!bg-sky-100 [&_input[data-share-side=OWNER]]:!text-sky-800 [&_input[data-share-side=OWNER]]:!ring-sky-300
                [&_input[data-share-side=COUNTERPARTY]]:!bg-emerald-100 [&_input[data-share-side=COUNTERPARTY]]:!text-emerald-800 [&_input[data-share-side=COUNTERPARTY]]:!ring-emerald-300
                [&_input[data-share-side=THIRD_PARTY]]:!bg-violet-100 [&_input[data-share-side=THIRD_PARTY]]:!text-violet-800 [&_input[data-share-side=THIRD_PARTY]]:!ring-violet-300"
            >
            <EditorContent
              editor={editor}
              className="prose prose-sm max-w-none leading-relaxed text-ink-secondary focus:outline-none [&_:focus]:outline-none
                [&_h2]:mb-4 [&_h2]:mt-0 [&_h2]:text-[26px] [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-ink
                [&_h3]:mb-2 [&_h3]:mt-7 [&_h3]:flex [&_h3]:items-center [&_h3]:gap-2.5 [&_h3]:text-[11px] [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-[0.18em] [&_h3]:text-brand
                [&_h3]:before:h-[2px] [&_h3]:before:w-6 [&_h3]:before:rounded-full [&_h3]:before:bg-brand [&_h3]:before:content-['']"
            />

            {/* Bouton IA au survol d'une clause */}
            {hover && !ai && (
              <button
                type="button"
                onClick={openAi}
                style={{ top: hover.top }}
                title="Préciser cette clause avec l'IA"
                className="absolute right-3 z-10 inline-flex items-center gap-1 rounded-lg border border-brand/30 bg-white px-2 py-1 text-[11px] font-medium text-brand shadow-sm transition hover:bg-brand-light"
              >
                <Sparkles className="h-3.5 w-3.5" /> IA
              </button>
            )}

            {/* Panneau IA de la clause */}
            {ai && (
              <div
                style={{ top: Math.max(0, ai.top) }}
                className="absolute right-3 z-20 w-80 rounded-card border border-line bg-white p-3 shadow-card-md"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink">
                    <Sparkles className="h-3.5 w-3.5 text-brand" /> Préciser la clause
                  </span>
                  <button onClick={() => setAi(null)} className="rounded p-0.5 text-ink-subtle hover:bg-surface-muted"><X className="h-3.5 w-3.5" /></button>
                </div>

                <textarea
                  value={ai.instruction}
                  onChange={(e) => setAi((a) => (a ? { ...a, instruction: e.target.value } : a))}
                  rows={2}
                  placeholder="Que souhaitez-vous préciser ? (ex. « ajoute un préavis de 8 jours »)"
                  className="mt-2 w-full resize-none rounded-lg border border-line px-2 py-1.5 text-[12px] outline-none focus:border-brand/40 focus:shadow-ring-brand"
                />
                <button
                  disabled={ai.loading || !ai.instruction.trim()}
                  onClick={runInstruction}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Valider
                </button>

                {ai.loading && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-ink-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Génération…</p>
                )}
                {ai.error && <p className="mt-2 text-[11px] text-danger">{ai.error}</p>}
                {ai.result && (
                  <div className="mt-2">
                    <p className="max-h-40 overflow-auto whitespace-pre-line rounded-lg bg-surface-subtle p-2 text-[12px] leading-snug text-ink-secondary">{ai.result}</p>
                    <div className="mt-2 flex gap-1.5">
                      <button onClick={acceptAi} className="rounded-lg bg-brand px-2.5 py-1 text-[11px] font-medium text-white hover:bg-brand-hover">Remplacer la clause</button>
                      <button onClick={() => setAi((a) => (a ? { ...a, result: null } : a))} className="rounded-lg px-2.5 py-1 text-[11px] text-ink-muted hover:bg-surface-muted">Réessayer</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>

          {/* Barre sticky « Modifier avec l'IA » — liseré de marque pour être
              repérée dès l'arrivée sur la page. */}
          <div className="sticky bottom-3 z-20">
            <div className="rounded-2xl border border-brand/30 bg-white/95 p-2 shadow-card-md backdrop-blur">
              <div className="flex items-center gap-2">
                <Sparkles className="ml-2 h-4 w-4 shrink-0 text-brand" />
                <input
                  ref={globalAiInputRef}
                  value={globalAi.instruction}
                  onChange={(e) => setGlobalAi((g) => ({ ...g, instruction: e.target.value, applied: false }))}
                  onKeyDown={(e) => { if (e.key === "Enter") void runGlobalAi(); }}
                  disabled={globalAi.loading}
                  placeholder="Modifier avec l'IA — ex. « passe le préavis à 2 mois », « ajoute une clause de confidentialité »…"
                  className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-ink outline-none placeholder:text-ink-subtle disabled:opacity-60"
                />
                <button
                  onClick={() => void runGlobalAi()}
                  disabled={globalAi.loading || !globalAi.instruction.trim()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:opacity-40"
                >
                  {globalAi.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {globalAi.loading ? "Modification…" : "Modifier"}
                </button>
              </div>
              {globalAi.error && (
                <p className="px-2 pb-1 pt-1.5 text-xs text-danger">{globalAi.error}</p>
              )}
              {globalAi.applied && (
                <p className="flex items-center gap-2 px-2 pb-1 pt-1.5 text-xs text-success-dark">
                  Contrat modifié.
                  <button
                    onClick={() => { editor?.chain().focus().undo().run(); setGlobalAi((g) => ({ ...g, applied: false })); }}
                    className="font-semibold underline underline-offset-2 hover:text-success"
                  >
                    Annuler
                  </button>
                </p>
              )}
            </div>
          </div>

          {actionError && <p className="text-right text-xs text-danger">{actionError}</p>}
        </div>
      </div>

      {/* ── Modale Convention collective ────────────────────────────────── */}
      {hasConvention && ccPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4" onClick={() => setCcPanel(false)}>
          <div
            className="w-full max-w-lg space-y-3 rounded-card border border-line bg-white p-5 shadow-card-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                <ShieldCheck className="h-4 w-4 text-brand" /> Convention collective
              </span>
              <button onClick={() => setCcPanel(false)} className="rounded p-0.5 text-ink-subtle hover:bg-surface-muted"><X className="h-4 w-4" /></button>
            </div>

            <p className="text-xs text-ink-muted">
              Convention actuelle : <strong className="text-ink">{readVar("convention_collective") || "—"}</strong>
            </p>

            <CompanySearchField
              onSelect={pickConvention}
              label="Identifier via une entreprise (open data)"
              hint="Recherchez l'entreprise par nom ou SIRET pour récupérer sa convention (code IDCC)."
              placeholder="Ex. « Lumen Juris » ou « 55203253400703 »"
            />
            {ccFinderMsg && <p className="text-xs text-brand">{ccFinderMsg}</p>}

            <div className="border-t border-line-subtle pt-3">
              <button
                onClick={runCc}
                disabled={cc.loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              >
                {cc.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Vérifier la conformité (IA)
              </button>
              {cc.error && <p className="mt-2 text-sm text-danger">{cc.error}</p>}
              {cc.result && (
                <div className="prose prose-sm mt-2 max-h-64 max-w-none overflow-auto text-[13px] leading-relaxed text-ink-secondary prose-p:my-1 prose-ul:my-1.5 prose-li:my-0.5">
                  <ReactMarkdown>{cc.result}</ReactMarkdown>
                </div>
              )}
              <p className="mt-2 text-2xs text-ink-subtle">Open data : recherche-entreprises (IDCC). Avis IA indicatif — ne remplace pas un conseil juridique.</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
