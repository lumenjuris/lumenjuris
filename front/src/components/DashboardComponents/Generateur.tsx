import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import {
  BookOpen, Sparkles, ChevronLeft, ChevronRight,
  Briefcase, ClipboardList, FileText, Shield,
  UploadCloud, Lock, CheckCircle2,
  Loader2, AlertCircle, Search,
} from "lucide-react";
import { fetchProxy } from "../../utils/fetchProxy";
import { useTemplateNotificationStore } from "../../store/templateNotificationStore";
import { useLayoutStore } from "../../store/layoutStore";
import { SmartCddEditor } from "./cdd/smart/SmartCddEditor";
import type { ContractModel, VariableDef, BlockDef } from "../../contractEngine/types";
import { cddAccroissementModel } from "../../contractEngine/models/cddAccroissement";
import { cdiModel } from "../../contractEngine/models/cdi";
import { avenantModel } from "../../contractEngine/models/avenant";
import { lettreDisciplinaireModel } from "../../contractEngine/models/lettreDisciplinaire";
import { ruptureConventionnelleModel } from "../../contractEngine/models/ruptureConventionnelle";
import { ScratchWizard } from "./generateur/ScratchFlow";
import { TemplateTable } from "./generateur/TemplateTable";
import { CreatedContractTable } from "./generateur/CreatedContractTable";
import { CreerDeZeroCard, GenerateurHub } from "./generateur/GenerateurHub";
import { PageBanner } from "../common/PageBanner";
import {
  loadCreatedContracts, addCreatedContract, removeCreatedContract,
  type CreatedContract,
} from "./generateur/createdContracts";
import { ConfirmationModal } from "../ui/ConfirmationModal";

// ─── Types modèles importés ───────────────────────────────────────────────────

interface ImportedClause {
  id: string;
  title: string;
  content: string;
  variables: string[];
}
interface ImportedSection {
  title: string;
  clauses: ImportedClause[];
}
interface TemplateStructure {
  sections: ImportedSection[];
  detectedVariables: string[];
  /** Libellé et type de chaque variable (renseignés par l'import IA). */
  variableDefs?: Array<{ name: string; label: string; type: string }>;
  rawText?: string;
}
interface ContractTemplateDTO {
  id: string;
  name: string;
  contractType: string | null;
  sourceFilename: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type Section = "library" | "import" | "form" | "useCustom" | "scratch" | "blank" | null;

// ─── Données ─────────────────────────────────────────────────────────────────

const DOC_TYPES = [
  { id: "cdi", Icon: Briefcase, short: "CDI", label: "Contrat à durée indéterminée" },
  { id: "cdd", Icon: ClipboardList, short: "CDD", label: "Contrat à durée déterminée" },
  { id: "avenant", Icon: FileText, short: "AVN", label: "Avenant au contrat de travail" },
  { id: "disciplinaire", Icon: BookOpen, short: "DISC", label: "Lettre disciplinaire" },
  { id: "rupture", Icon: Shield, short: "RC", label: "Rupture conventionnelle" },
] as const;
type DocId = typeof DOC_TYPES[number]["id"];

/** Modèle + nom de fichier d'export pour l'éditeur document-first, par type de contrat. */
const GENERIC_EDITORS: Record<DocId, { model: ContractModel; fileBase: string }> = {
  cdi: { model: cdiModel, fileBase: "CDI" },
  cdd: { model: cddAccroissementModel, fileBase: "CDD-accroissement" },
  avenant: { model: avenantModel, fileBase: "Avenant" },
  disciplinaire: { model: lettreDisciplinaireModel, fileBase: "Lettre-disciplinaire" },
  rupture: { model: ruptureConventionnelleModel, fileBase: "Rupture-conventionnelle" },
};

/** Normalise (minuscules + sans accents) pour une recherche tolérante. */
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}



// ─── Bibliothèque ─────────────────────────────────────────────────────────────

function LibrarySection({
  onUse,
  onUseCustom,
  onCreate,
  onOpenCreated,
  refreshKey,
}: {
  onUse: (id: DocId) => void;
  onUseCustom: (externalId: string) => void;
  onCreate: (title: string) => void;
  onOpenCreated: (c: CreatedContract) => void;
  refreshKey?: number;
}) {
  const [customList, setCustomList] = useState<ContractTemplateDTO[]>([]);
  const [created, setCreated] = useState<CreatedContract[]>(() => loadCreatedContracts());
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [internalRefresh, setInternalRefresh] = useState(0);
  const [validateModalOpen, setValidateModalOpen] = useState(false);
  const [contractDelete, setContractDelete] = useState<ContractTemplateDTO | null>(null);

  // Charge la liste des modèles personnalisés (générés/importés) + l'historique local.
  useEffect(() => {
    setCreated(loadCreatedContracts());
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchProxy("/api/template", { credentials: "include" });
        const data = (await res.json()) as { success: boolean; data?: ContractTemplateDTO[] };
        if (!cancelled && data.success && data.data) setCustomList(data.data);
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, internalRefresh]);

  const typed = query.trim();
  const nq = norm(typed);
  const genericMatches = DOC_TYPES.filter(
    (d) => !nq || norm(d.short).includes(nq) || norm(d.label).includes(nq),
  );
  const customMatches = customList.filter(
    (t) => !nq || norm(t.name).includes(nq) || norm(t.contractType ?? "").includes(nq),
  );
  const createdMatches = created.filter((c) => !nq || norm(c.title).includes(nq));

  async function handleDelete(t: ContractTemplateDTO) {
    setContractDelete(t);
    setValidateModalOpen(true);

  }

  async function validateConfirmed() {
    if (!contractDelete) return;
    try {
      await fetchProxy("/api/template/" + contractDelete.id, { method: "DELETE", credentials: "include" });
      setInternalRefresh((k) => k + 1);
    } catch { /* silent */ }
    finally {
      setContractDelete(null);
      setValidateModalOpen(false);
    }
  }

  function handleDeleteCreated(id: string) {
    removeCreatedContract(id);
    setCreated(loadCreatedContracts());
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 ">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && typed) onCreate(typed); }}
          placeholder="Rechercher ou créer un contrat…"
          className="w-full pl-10 pr-12 py-3 bg-white border border-line rounded-xl text-sm text-ink outline-none focus:border-brand/40 focus:shadow-ring-brand transition-all placeholder:text-ink-placeholder shadow-card"
        />
        {typed && (
          <button
            onClick={() => onCreate(typed)}
            title="Générer ce contrat"
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white transition-colors hover:bg-brand-hover"
          >
            <Sparkles className="h-4 w-4" />
          </button>
        )}
      </div>

      {genericMatches.length > 0 && (
        <div className="overflow-hidden rounded-card border border-line bg-white shadow-card divide-y divide-line-subtle">
          {genericMatches.length > 0 && (
            <div className="py-1">
              <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
                Modèles prêts à l'emploi
              </p>
              {genericMatches.map((d) => (
                <button
                  key={d.id}
                  onClick={() => onUse(d.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-subtle"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-panel bg-brand-light">
                    <d.Icon className="h-4 w-4 text-brand" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{d.label}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-subtle" />
                </button>
              ))}
            </div>
          )}

        </div>
      )}

      {/* Modèles enregistrés : tableau comme dans la contrathèque (colonnes au choix, tri) */}
      {(loading || customMatches.length > 0) && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
            Vos modèles enregistrés
          </p>
          <TemplateTable
            items={customMatches}
            loading={loading}
            onOpen={onUseCustom}
            onDelete={handleDelete}
          />
        </div>
      )}

      <ConfirmationModal
        open={validateModalOpen}
        title="Supprimer le modèle"
        description={`Souhaitez-vous supprimer le modèle « ${contractDelete?.name ?? ""} » ?`}
        confirmLabel="Valider"
        onConfirm={validateConfirmed}
        onCancel={() => { setValidateModalOpen(false); setContractDelete(null); }}
      />

      {/* Historique des contrats créés : même tableau que les modèles enregistrés */}
      {createdMatches.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
            Historique des contrats créés
          </p>
          <CreatedContractTable
            items={createdMatches}
            onOpen={onOpenCreated}
            onDelete={(contract) => handleDeleteCreated(contract.id)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Sélecteur de variables (vue contenu avec variables cliquables) ──────────

type ContentToken =
  | { type: "text"; value: string }
  | { type: "var"; name: string; text: string };

/**
 * Découpe le contenu en tokens.
 * Supporte deux formats :
 *  - Nouveau : <<NOM_VARIABLE|texte original conservé>>
 *  - Legacy  : {{NOM_VARIABLE}} (texte original perdu, on retombe sur le nom humanisé)
 */
function tokenizeContent(content: string): ContentToken[] {
  content = content ?? ""; // robustesse : contenu potentiellement absent d'une structure importée
  // <<NAME|original>> — texte original conservé
  // <<NAME>>          — variante sans pipe (IA paresseuse) → fallback humanisé
  // {{NAME}}          — legacy → fallback humanisé
  // Casse mixte tolérée (alignée sur splitSegments/convertTemplateMarkers) pour
  // qu'un marqueur non-majuscule soit aussi détecté, listé et surligné correctement.
  const re = /<<([A-Za-z0-9_]+)\|([\s\S]*?)>>|<<([A-Za-z0-9_]+)>>|\{\{([A-Za-z0-9_]+)\}\}/g;
  const tokens: ContentToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) tokens.push({ type: "text", value: content.slice(last, m.index) });
    if (m[1] !== undefined && m[2] !== undefined) {
      // Si le texte d'origine est vide ou whitespace, fallback sur le nom humanisé
      const text = m[2].trim() ? m[2] : humanizeVar(m[1]);
      tokens.push({ type: "var", name: m[1], text });
    } else if (m[3] !== undefined) {
      tokens.push({ type: "var", name: m[3], text: humanizeVar(m[3]) });
    } else if (m[4] !== undefined) {
      tokens.push({ type: "var", name: m[4], text: humanizeVar(m[4]) });
    }
    last = m.index + m[0].length;
  }
  if (last < content.length) tokens.push({ type: "text", value: content.slice(last) });
  return tokens;
}

/** Transforme NOM_DE_LA_SOCIETE en "Nom de la société" pour un affichage lisible. */
function humanizeVar(name: string): string {
  const lower = name.toLowerCase().replace(/_/g, " ").trim();
  if (!lower) return name;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Libellé d'une variable : celui proposé par l'IA à l'import, sinon le nom humanisé. */
function getVariableLabel(structure: TemplateStructure, name: string): string {
  const definition = structure.variableDefs?.find((def) => def.name === name);
  return definition?.label || humanizeVar(name);
}

/** Vrai si le texte d'origine est un emplacement vide d'un modèle vierge ("....", "…", "____", "[à compléter]"). */
function isBlankPlaceholder(text: string): boolean {
  return /…|\.\s?\.\s?\.|_{3,}|^\[.*\]$/.test(text.trim());
}

/** Extrait toutes les variables présentes (deduped). */
function extractAllVariables(structure: TemplateStructure): string[] {
  const set = new Set<string>();
  for (const sec of structure.sections ?? []) {
    for (const cl of sec.clauses ?? []) {
      const tokens = tokenizeContent(cl.content);
      for (const t of tokens) if (t.type === "var") set.add(t.name);
    }
  }
  return Array.from(set);
}

/**
 * Strippe les marqueurs des variables non-essentielles dans un contenu.
 * <<NAME|original>> où NAME n'est pas essentiel → original (texte brut conservé).
 */
function filterMarkersInContent(content: string, essential: Set<string>): string {
  return content.replace(/<<([A-Za-z0-9_]+)\|([\s\S]*?)>>/g, (_match, name: string, text: string) => {
    return essential.has(name) ? `<<${name}|${text}>>` : text;
  });
}

// ─── Relecture des variables : contrat à gauche, liste des champs à droite ────

/** Résumé d'une variable, affiché dans la liste de droite. */
interface VariableSummary {
  name: string;
  label: string;
  /** Premier texte d'origine rencontré dans le contrat (ex : "Alpha Conseil SAS"). */
  originalText: string;
  /** Vrai si le texte d'origine est un emplacement vide ("....", "____"). */
  isBlank: boolean;
  /** Nombre d'apparitions dans le contrat. */
  occurrences: number;
}

/** Liste les variables dans leur ordre d'apparition, avec leur nombre d'occurrences. */
function listVariableSummaries(structure: TemplateStructure): VariableSummary[] {
  const summariesByName = new Map<string, VariableSummary>();
  for (const section of structure.sections ?? []) {
    for (const clause of section.clauses ?? []) {
      for (const token of tokenizeContent(clause.content)) {
        if (token.type !== "var") continue;
        const existing = summariesByName.get(token.name);
        if (existing) {
          existing.occurrences += 1;
        } else {
          summariesByName.set(token.name, {
            name: token.name,
            label: getVariableLabel(structure, token.name),
            originalText: token.text,
            isBlank: isBlankPlaceholder(token.text),
            occurrences: 1,
          });
        }
      }
    }
  }
  return Array.from(summariesByName.values());
}

/**
 * Fait défiler un conteneur pour centrer l'un de ses éléments.
 * On évite scrollIntoView, qui fait aussi défiler la page entière.
 */
function scrollElementToCenter(container: HTMLElement, element: HTMLElement) {
  const elementPosition = container.scrollTop + (element.getBoundingClientRect().top - container.getBoundingClientRect().top);
  container.scrollTo({ top: Math.max(0, elementPosition - container.clientHeight / 2), behavior: "smooth" });
}

/** Vrai si l'élément est entièrement visible dans la zone affichée du conteneur. */
function isElementVisibleIn(container: HTMLElement, element: HTMLElement): boolean {
  const containerBox = container.getBoundingClientRect();
  const elementBox = element.getBoundingClientRect();
  return elementBox.top >= containerBox.top && elementBox.bottom <= containerBox.bottom;
}

/** Texte du contrat avec les variables surlignées et cliquables. */
function VariableSelector({
  structure,
  essentialVars,
  highlightedVar,
  onVariableClick,
  onVariableHover,
}: {
  structure: TemplateStructure;
  essentialVars: Set<string>;
  highlightedVar: string | null;
  onVariableClick: (name: string) => void;
  onVariableHover: (name: string | null) => void;
}) {
  // Le découpage du texte ne dépend que de la structure : on ne le refait pas
  // à chaque survol (important pour les contrats longs).
  const tokenizedSections = useMemo(
    () =>
      (structure.sections ?? []).map((section) => ({
        title: section.title,
        clauses: (section.clauses ?? []).map((clause) => ({
          id: clause.id,
          title: clause.title,
          tokens: tokenizeContent(clause.content),
        })),
      })),
    [structure],
  );

  return (
    <div className="space-y-6">
      {tokenizedSections.map((sec, si) => (
        <section key={si} className="space-y-3">
          <h4 className="text-[13px] font-bold text-ink tracking-tight">{sec.title}</h4>
          <div className="space-y-3">
            {sec.clauses.map((cl) => (
              <div key={cl.id} className="space-y-1.5">
                {cl.title && (
                  <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">{cl.title}</p>
                )}
                <p className="whitespace-pre-line text-[13px] text-ink-secondary leading-relaxed">
                  {cl.tokens.map((t, i) => {
                    if (t.type === "text") return <span key={i}>{t.value}</span>;
                    const isEssential = essentialVars.has(t.name);
                    const isHighlighted = highlightedVar === t.name;
                    const variableLabel = getVariableLabel(structure, t.name);
                    return (
                      <button
                        key={i}
                        type="button"
                        data-variable={t.name}
                        onClick={() => onVariableClick(t.name)}
                        onMouseEnter={() => onVariableHover(t.name)}
                        onMouseLeave={() => onVariableHover(null)}
                        title={isEssential ? `« ${variableLabel} » — cliquez pour le retirer du modèle` : `« ${variableLabel} » retiré — cliquez pour le conserver`}
                        className={`inline align-baseline mx-[1px] px-1 py-[1px] rounded-chip text-[13px] transition-all border-2 ${isEssential
                          ? "bg-success-light text-success-dark border-success/50 border-dashed hover:bg-success-light/70 font-medium"
                          : "bg-transparent text-ink-subtle border-transparent line-through hover:text-ink-secondary"
                          } ${isHighlighted ? "ring-2 ring-brand/60 ring-offset-1" : ""}`}
                      >
                        {/* Emplacement vide ("....", "____") : on affiche le libellé, plus parlant */}
                        {isBlankPlaceholder(t.text) ? variableLabel : t.text}
                      </button>
                    );
                  })}
                </p>
              </div>
            ))}
          </div>
          {si < tokenizedSections.length - 1 && (
            <div className="pt-2 border-b border-line-subtle" />
          )}
        </section>
      ))}
    </div>
  );
}

/** Liste des champs détectés (colonne de droite) : conserver / retirer, retrouver dans le contrat. */
function VariableListPanel({
  variables,
  essentialVars,
  highlightedVar,
  variableToReveal,
  onToggleVar,
  onShowVar,
  onHoverVar,
}: {
  variables: VariableSummary[];
  essentialVars: Set<string>;
  highlightedVar: string | null;
  /** Champ cliqué dans le contrat, à faire apparaître dans la liste s'il est caché. */
  variableToReveal: { name: string } | null;
  onToggleVar: (name: string) => void;
  onShowVar: (name: string) => void;
  onHoverVar: (name: string | null) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const keptCount = variables.filter((variable) => essentialVars.has(variable.name)).length;

  // Uniquement sur un clic dans le contrat : si l'effet suivait le surlignage,
  // la liste sauterait dès que la souris la quitte (le surlignage revient alors
  // sur le dernier champ cliqué, parfois hors de vue).
  useEffect(() => {
    const list = listRef.current;
    if (!list || !variableToReveal) return;
    const row = list.querySelector<HTMLElement>(`[data-variable-row="${variableToReveal.name}"]`);
    if (row && !isElementVisibleIn(list, row)) scrollElementToCenter(list, row);
  }, [variableToReveal]);

  return (
    <div className="flex flex-col min-h-0 lg:h-full bg-white rounded-card border border-line shadow-card overflow-hidden">
      <div className="shrink-0 space-y-2.5 border-b border-line-subtle px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">Champs détectés</h3>
          <span className="text-xs text-ink-subtle">
            <span className="font-semibold text-success-dark">{keptCount}</span> / {variables.length} conservé{keptCount > 1 ? "s" : ""}
          </span>
        </div>

      </div>

      <ul ref={listRef} className="flex-1 space-y-0.5 overflow-y-auto p-2 max-h-[55vh] lg:max-h-none">
        {variables.map((variable) => {
          const isKept = essentialVars.has(variable.name);
          const isHighlighted = highlightedVar === variable.name;
          return (
            <li
              key={variable.name}
              data-variable-row={variable.name}
              onMouseEnter={() => onHoverVar(variable.name)}
              onMouseLeave={() => onHoverVar(null)}
              className={`flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors ${isHighlighted ? "bg-brand-light" : "hover:bg-surface-subtle"
                }`}
            >
              <input
                type="checkbox"
                checked={isKept}
                onChange={() => onToggleVar(variable.name)}
                aria-label={`Conserver le champ « ${variable.label} »`}
                className="h-4 w-4 shrink-0 cursor-pointer accent-brand"
              />
              <button
                type="button"
                onClick={() => onShowVar(variable.name)}
                title={variable.occurrences > 1 ? "Voir dans le contrat (cliquez à nouveau pour l'occurrence suivante)" : "Voir dans le contrat"}
                className="min-w-0 flex-1 text-left"
              >
                <span className={`block truncate text-[13px] font-medium ${isKept ? "text-ink" : "text-ink-subtle line-through"}`}>
                  {variable.label}
                </span>

              </button>
              {variable.occurrences > 1 && (
                <span
                  title={`${variable.occurrences} occurrences dans le contrat`}
                  className="shrink-0 rounded-chip bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted"
                >
                  {variable.occurrences}×
                </span>
              )}
            </li>
          );
        })}

        {variables.length === 0 && (
          <li className="px-3 py-8 text-center text-xs text-ink-subtle">
            Aucun champ détecté dans ce contrat.
          </li>
        )}
      </ul>
    </div>
  );
}

// ─── Import ───────────────────────────────────────────────────────────────────

type ImportStep = "form" | "processing" | "review";

/** Style des boutons d'action de la relecture (Annuler, Enregistrer, Enregistrer et générer). */
const REVIEW_ACTION_BUTTON =
  "inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-primary rounded-xl shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-primary/85 disabled:opacity-50";

function ImportSection({
  onSaved,
  onReviewDisplayed,
}: {
  onSaved?: (templateId: string, andContinue: boolean) => void;
  /** Prévient la page quand l'écran de relecture s'affiche (elle s'élargit alors). */
  onReviewDisplayed?: (isDisplayed: boolean) => void;
} = {}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [step, setStep] = useState<ImportStep>("form");
  const [error, setError] = useState("");
  const [savedMeta, setSavedMeta] = useState<ContractTemplateDTO | null>(null);
  const [structure, setStructure] = useState<TemplateStructure | null>(null);
  const [essentialVars, setEssentialVars] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Relecture : champ choisi (clic) et champ survolé, surlignés dans les deux colonnes.
  const [activeVar, setActiveVar] = useState<string | null>(null);
  const [hoveredVar, setHoveredVar] = useState<string | null>(null);
  const highlightedVar = hoveredVar ?? activeVar;
  const documentScrollRef = useRef<HTMLDivElement>(null);
  // Dernière occurrence montrée, pour passer à la suivante à chaque clic sur le même champ.
  const lastShownOccurrenceRef = useRef<{ name: string; index: number }>({ name: "", index: -1 });

  const variableSummaries = useMemo(
    () => (structure ? listVariableSummaries(structure) : []),
    [structure],
  );

  function toggleEssentialVar(name: string) {
    setEssentialVars((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  // Champ cliqué dans le contrat, à faire apparaître dans la liste de droite.
  // Un nouvel objet à chaque clic, pour que la liste réagisse même si c'est le même champ.
  const [variableToReveal, setVariableToReveal] = useState<{ name: string } | null>(null);

  // La page s'élargit pendant la relecture (même largeur que la contrathèque).
  const isReviewDisplayed = step === "review" && !saved;
  useEffect(() => {
    onReviewDisplayed?.(isReviewDisplayed);
  }, [isReviewDisplayed]);
  // En quittant la section, la page reprend sa largeur normale.
  useEffect(() => () => onReviewDisplayed?.(false), []);

  /** Clic sur un champ dans le contrat : on le conserve / retire et on le désigne dans la liste. */
  function handleDocumentVariableClick(name: string) {
    toggleEssentialVar(name);
    setActiveVar(name);
    setVariableToReveal({ name });
  }

  /** Clic sur un champ dans la liste : on fait défiler le contrat jusqu'à lui (occurrence suivante si on reclique). */
  function showVariableInDocument(name: string) {
    setActiveVar(name);
    const container = documentScrollRef.current;
    if (!container) return;
    const occurrences = container.querySelectorAll<HTMLElement>(`[data-variable="${name}"]`);
    if (occurrences.length === 0) return;

    const lastShown = lastShownOccurrenceRef.current;
    const nextIndex = lastShown.name === name ? (lastShown.index + 1) % occurrences.length : 0;
    lastShownOccurrenceRef.current = { name, index: nextIndex };
    scrollElementToCenter(container, occurrences[nextIndex]);
  }

  function resetImport() {
    setStep("form"); setFile(null); setName("");
    setSavedMeta(null); setStructure(null); setEssentialVars(new Set()); setSaved(false);
    setSaveError(""); setActiveVar(null); setHoveredVar(null);
  }

  const onDropAccepted = useCallback((files: File[]) => { if (files[0]) setFile(files[0]); }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropAccepted,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    multiple: false,
  });

  async function handleImport() {
    if (!file || !name.trim()) return;
    setStep("processing");
    setError("");
    try {
      const base64 = await fileToBase64(file);
      const res = await fetchProxy("/api/template/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fileBase64: base64,
          mimeType: file.type,
          filename: file.name,
          name: name.trim(),
        }),
      });
      const data = await res.json() as { success: boolean; message?: string; data?: ContractTemplateDTO };
      if (!res.ok || !data.success || !data.data) {
        throw new Error(data.message || "Import échoué");
      }
      setSavedMeta(data.data);

      // Charger la structure
      const detailRes = await fetchProxy(`/api/template/${data.data.id}`, { credentials: "include" });
      const detail = await detailRes.json() as { success: boolean; data?: { meta: ContractTemplateDTO; structure: TemplateStructure } };
      if (!detail.success || !detail.data) {
        throw new Error("Modèle importé, mais son aperçu n'a pas pu être chargé. Retrouvez-le dans votre bibliothèque.");
      }
      setStructure(detail.data.structure);
      // Par défaut, TOUTES les variables présentes dans le contenu sont pré-sélectionnées.
      // On extrait depuis le contenu réel (et pas uniquement detectedVariables qui peut être incomplet).
      setEssentialVars(new Set(extractAllVariables(detail.data.structure)));
      setStep("review");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'import");
      setStep("form");
    }
  }

  async function handleSaveStructure(andContinue: boolean) {
    if (!savedMeta || !structure) return;
    setSaving(true);
    setSaveError("");
    try {
      // Filtre les variables non-essentielles avant sauvegarde.
      // Les marqueurs <<NAME|original>> des variables non-essentielles sont strippés
      // (le texte original est conservé tel quel dans le contenu final).
      const essentialList = Array.from(essentialVars);
      const filteredStructure: TemplateStructure = {
        ...structure,
        detectedVariables: essentialList,
        sections: structure.sections.map((sec) => ({
          ...sec,
          clauses: sec.clauses.map((cl) => ({
            ...cl,
            content: filterMarkersInContent(cl.content, essentialVars),
            variables: cl.variables.filter((v) => essentialVars.has(v)),
          })),
        })),
      };
      const res = await fetchProxy(`/api/template/${savedMeta.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ structure: filteredStructure }),
      });
      if (!res.ok) throw new Error("save failed");
      setSaved(true);
      onSaved?.(savedMeta.id, andContinue);
    } catch {
      setSaveError("L'enregistrement du modèle a échoué. Réessayez.");
    }
    finally { setSaving(false); }
  }

  if (step === "processing") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-5 text-center max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-card bg-brand-light flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-brand animate-spin stroke-[1.5]" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-bold text-ink">Analyse en cours…</p>
          <p className="text-xs text-ink-subtle">Extraction du texte puis structuration par IA. Cela peut prendre 30 à 60 secondes.</p>
        </div>
        <div className="flex gap-1.5">
          {["Extraction du document", "Structuration IA", "Sauvegarde"].map((s, i) => (
            <span key={i} className="text-[10px] font-medium text-ink-subtle bg-surface-muted px-2.5 py-1 rounded-chip">{s}</span>
          ))}
        </div>
      </div>
    );
  }

  if (step === "review" && structure && savedMeta) {

    if (saved) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-5 text-center max-w-lg mx-auto">
          <div className="w-20 h-20 rounded-card bg-success-light flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-success-dark stroke-[1.5]" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-ink">Modèle sauvegardé !</h3>
            <p className="text-sm text-ink-muted">
              <span className="font-semibold text-ink-secondary">{savedMeta.name}</span> est maintenant disponible dans votre bibliothèque personnalisée.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={resetImport}
              className="px-5 py-2.5 text-sm font-semibold text-brand bg-white border border-line rounded-xl hover:bg-surface-subtle transition-colors shadow-card"
            >
              Importer un autre modèle
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full space-y-4 pr-4">
        {/* Barre d'actions en haut : toujours visible, les colonnes défilent en dessous */}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={resetImport} disabled={saving} className={REVIEW_ACTION_BUTTON}>
            Annuler
          </button>
          {/* Enregistrer seulement (autorisé même sans variable — modèle statique valide) */}
          <button type="button" onClick={() => void handleSaveStructure(false)} disabled={saving} className={REVIEW_ACTION_BUTTON}>
            Enregistrer
          </button>
          {/* Enregistrer + poursuivre le tunnel de génération */}
          <button type="button" onClick={() => void handleSaveStructure(true)} disabled={saving} className={REVIEW_ACTION_BUTTON}>
            {saving ? "Enregistrement…" : "Enregistrer et générer"}
          </button>
        </div>

        {saveError && (
          <div role="alert" className="flex items-center gap-2 text-sm text-danger-dark bg-danger-light border border-danger/20 px-4 py-3 rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
          </div>
        )}

        {/* Contrat (toute la largeur restante) + champs détectés (largeur fixe). Chaque colonne défile seule. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:h-[calc(100vh-17rem)] lg:min-h-[520px]">
          <div
            ref={documentScrollRef}
            className="h-[55vh] lg:h-full overflow-y-auto rounded-card border border-line bg-white px-6 py-6 shadow-card sm:px-8"
          >
            <VariableSelector
              structure={structure}
              essentialVars={essentialVars}
              highlightedVar={highlightedVar}
              onVariableClick={handleDocumentVariableClick}
              onVariableHover={setHoveredVar}
            />
          </div>
          <VariableListPanel
            variables={variableSummaries}
            essentialVars={essentialVars}
            highlightedVar={highlightedVar}
            variableToReveal={variableToReveal}
            onToggleVar={toggleEssentialVar}
            onShowVar={showVariableInDocument}
            onHoverVar={setHoveredVar}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full max-w-4xl mx-auto">
      {/* Carte unique : dépôt + détails (homogène avec les autres écrans) */}
      <div className="rounded-card border border-line bg-white shadow-card p-6 space-y-5">
        {/* Zone de dépôt — react-dropzone (clic + drag), compacte */}
        <div
          {...getRootProps()}
          className={`relative rounded-panel border-2 border-dashed px-6 py-8 text-center transition-all duration-200 cursor-pointer ${isDragActive ? "border-brand bg-brand-light"
            : file ? "border-success/50 bg-success-light/40"
              : "border-line bg-surface-subtle/40 hover:border-brand/40 hover:bg-surface-subtle"
            }`}
        >
          <input {...getInputProps()} />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-panel bg-success-light">
                <CheckCircle2 className="w-6 h-6 text-success-dark stroke-[1.5]" />
              </div>
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold text-ink">{file.name}</p>
                <p className="text-xs text-ink-subtle">{(file.size / 1024).toFixed(0)} Ko · prêt à analyser</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="ml-1 shrink-0 text-xs text-ink-subtle underline underline-offset-2 transition-colors hover:text-danger"
              >
                Changer
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2.5">
              <div className={`flex h-12 w-12 items-center justify-center rounded-panel border ${isDragActive ? "bg-brand-light border-brand/30" : "bg-white border-line"}`}>
                <UploadCloud className={`w-6 h-6 stroke-[1.5] ${isDragActive ? "text-brand" : "text-ink-subtle"}`} />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-ink-secondary">Glissez-déposez votre document</p>
                <p className="text-xs text-ink-subtle">ou cliquez pour parcourir — PDF ou Word</p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-line-subtle" />

        {/* Nom du modèle — le type de contrat est déduit automatiquement par l'IA */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-ink-muted uppercase tracking-widest">Nom du modèle *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. NDA Inserm Transfert"
            className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand/40 focus:shadow-ring-brand transition-all placeholder:text-ink-placeholder"
          />
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-danger-dark bg-danger-light border border-danger/20 px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* CTA */}
      <button
        disabled={!file || !name.trim()}
        onClick={handleImport}
        className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-hover text-white text-sm font-semibold py-3 rounded-xl transition-colors shadow-card disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Sparkles className="w-4 h-4" />
        Analyser et créer le modèle
      </button>

      {/* Confidentialité — pied discret */}
      <p className="flex items-center justify-center gap-1.5 text-[11px] text-ink-subtle">
        <Lock className="h-3 w-3" /> Traitement confidentiel — données chiffrées
      </p>
    </div>
  );
}

// ─── Flow d'utilisation d'un modèle personnalisé ─────────────────────────────

// ─── Génération depuis un modèle importé : éditeur document-first ─────────────

/** Slug ASCII simple pour le nom de fichier exporté. */
function slugifyName(s: string): string {
  const o = norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return o || "contrat";
}

/** Convertit les marqueurs de variable du modèle importé (<<NAME|…>>, <<NAME>>) en {{NAME}}. */
function convertTemplateMarkers(content: string): string {
  return (content ?? "")
    .replace(/<<([A-Za-z0-9_]+)\|[\s\S]*?>>/g, (_m, name: string) => `{{${name}}}`)
    .replace(/<<([A-Za-z0-9_]+)>>/g, (_m, name: string) => `{{${name}}}`);
}

/**
 * Transforme un modèle importé (TemplateStructure) en ContractModel éditable :
 * un bloc titre + un bloc par section (heading = intitulé, corps = clauses),
 * les variables restantes devenant des {{variables}} surlignées dans l'éditeur.
 */
function templateToModel(meta: ContractTemplateDTO, structure: TemplateStructure): ContractModel {
  // Type "text" volontairement : les valeurs d'origine ("15 000 euros", "3 mois")
  // ne passeraient pas la validation numérique des types money/number/duration.
  const variables: VariableDef[] = extractAllVariables(structure).map((name) => ({
    id: name,
    label: getVariableLabel(structure, name),
    type: "text",
  }));
  const blocks: BlockDef[] = [
    { id: "title", kind: "title", content: (meta.name || "Contrat").toUpperCase() },
  ];
  (structure.sections ?? []).forEach((sec, si) => {
    const body = (sec.clauses ?? [])
      .map((cl) => (cl.title?.trim() ? cl.title.trim() + "\n" : "") + convertTemplateMarkers(cl.content))
      .join("\n\n")
      .trim();
    if (!body) return;
    blocks.push({ id: `sec_${si}`, kind: "clause", heading: sec.title || undefined, content: body });
  });
  // Garde-fou : un modèle sans aucun bloc de corps casserait l'éditeur — on met un placeholder.
  if (blocks.length === 1) {
    blocks.push({ id: "sec_0", kind: "clause", heading: undefined, content: "[Contenu du contrat]" });
  }
  return {
    key: "custom",
    version: meta.version || 1,
    label: meta.name,
    variables,
    blocks,
    alternatives: [],
    decisions: [],
    rules: [],
    mandatoryMentions: [],
  };
}

/**
 * Ouvre un modèle importé dans l'éditeur document-first : le contrat entier est
 * visible et éditable, les variables sont surlignées et remplies d'un seul clic
 * (au lieu d'un formulaire de champs sans aperçu du contrat).
 */
function CustomTemplateEditor({ templateId, onBack }: { templateId: string; onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [model, setModel] = useState<ContractModel | null>(null);
  const [fileBase, setFileBase] = useState("contrat");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetchProxy(`/api/template/${templateId}`, { credentials: "include" });
        const data = (await res.json()) as {
          success: boolean;
          data?: { meta: ContractTemplateDTO; structure: TemplateStructure };
        };
        if (cancelled) return;
        if (data.success && data.data) {
          setModel(templateToModel(data.data.meta, data.data.structure));
          setFileBase(slugifyName(data.data.meta.name));
        } else {
          setError("Modèle introuvable.");
        }
      } catch {
        if (!cancelled) setError("Erreur de chargement du modèle.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [templateId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-brand animate-spin" />
      </div>
    );
  }
  if (error || !model) {
    return (
      <div className="mx-auto max-w-lg">
        <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-brand">
          <ChevronLeft className="h-4 w-4" /> Retour 
        </button>
        <div className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger-light px-4 py-3 text-sm text-danger-dark">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error || "Modèle introuvable."}
        </div>
      </div>
    );
  }
  return <SmartCddEditor model={model} fileBase={fileBase} onBack={onBack} />;
}

// ─── Page principale ──────────────────────────────────────────────────────────

/**
 * Écran d'entrée « Créer de zéro » : un champ (le contrat souhaité) et, en
 * dessous, les étapes. Vient ensuite ScratchWizard : générer tout de suite, ou
 * personnaliser par quelques questions simples, puis rédaction IA et
 * ouverture dans l'éditeur.
 */
function ScratchEntry({ onStart }: { onStart: (title: string) => void; onBack: () => void }) {
  // Même carte animée que sur l'accueil du générateur. Titre trop court :
  // on ne fait rien, le champ reste ouvert.
  return (
    <div className="w-full">
      <CreerDeZeroCard onCreate={(title) => title && onStart(title)} sansTitre />
    </div>
  );
}

export function Generateur() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>(null);
  const [formDocId, setFormDocId] = useState<DocId>("cdi");
  const [useTemplateId, setUseTemplateId] = useState<string | null>(null);
  const [blankEditor, setBlankEditor] = useState<{ model: ContractModel; fileBase: string } | null>(null);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  // Relecture d'un import affichée : la page prend la largeur de la contrathèque.
  const [isImportReviewDisplayed, setIsImportReviewDisplayed] = useState(false);
  const notifyAdded = useTemplateNotificationStore((s) => s.notifyAdded);

  // Titre du questionnaire « de zéro » — porté par l'URL pour survivre au
  // bouton Précédent du navigateur.
  const wizardTitle = searchParams.get("titre");

  const initialBriefRef = useRef<string | undefined>(
    (location.state as { brief?: string } | null)?.brief
  );

  useEffect(() => {
    if (location.state?.brief) {
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [location, navigate]);


  // Synchronise la section avec l'URL. TOUTES les sous-étapes (modèle ouvert,
  // éditeur, questionnaire) vivent dans l'historique : le bouton Précédent du
  // navigateur revient à l'étape précédente au lieu de tout réinitialiser.
  // 1. On extrait le brief du state React Router
  useEffect(() => {
    const s = searchParams.get("section");
    if (s === "library" || s === "import" || s === "scratch") { setSection(s); return; }
    if (s === "form") {
      const d = searchParams.get("doc") as DocId | null;
      if (d && DOC_TYPES.some((t) => t.id === d)) { setFormDocId(d); setSection("form"); return; }
    }
    if (s === "useCustom") {
      const t = searchParams.get("tpl");
      if (t) { setUseTemplateId(t); setSection("useCustom"); return; }
    }
    if (s === "blank") {
      // Le modèle vit en mémoire : au retour (back) il est là ; après un
      // rechargement il ne l'est plus — on retombe alors sur la bibliothèque.
      if (blankEditor) { setSection("blank"); return; }
      setSearchParams({ section: "library" }, { replace: true });
      return;
    }
    setSection(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, blankEditor]);

  function handleUseModel(id: DocId) {
    setSearchParams({ section: "form", doc: id });
  }

  function handleUseCustomTemplate(externalId: string) {
    setSearchParams({ section: "useCustom", tpl: externalId });
  }

  // Rien trouvé : on lance le questionnaire (en ligne) pour créer le contrat de zéro.
  function handleCreate(title: string) {
    setSearchParams({ section: "scratch", titre: title, de: "library" });
  }

  // Depuis l'accueil : avec un titre on lance directement le questionnaire,
  // sans titre on ouvre l'écran d'entrée « Créer de zéro ».
  function handleCreateFromHub(title: string) {
    if (title) setSearchParams({ section: "scratch", titre: title, de: "hub" });
    else setSearchParams({ section: "scratch" });
  }

  // Retour depuis le questionnaire : vers la bibliothèque si on en vient,
  // sinon vers l'écran d'entrée « Créer de zéro ».
  function handleScratchBack() {
    const de = searchParams.get("de");
    if (de === "library") goLibrary();
    else if (de === "hub") goHub();
    else if (de === "dashboard") {
      navigate("/dashboard")
    }
    else setSearchParams({ section: "scratch" });
  }

  // Contrat créé par le questionnaire : on l'archive, puis on ouvre l'éditeur.
  // Il n'est plus enregistré d'office comme modèle : l'éditeur le propose à
  // la fin du remplissage (et dans sa barre d'actions), avec le contenu tel
  // que l'utilisateur l'a finalisé.
  function handleScratchReady(r: { model: ContractModel; fileBase: string }) {
    const title = wizardTitle ?? r.model.label;
    addCreatedContract({ title, model: r.model, fileBase: r.fileBase });
    setBlankEditor(r);
    setSearchParams({ section: "blank" });
  }

  // Rouvre un contrat déjà créé depuis l'historique.
  function handleOpenCreated(c: CreatedContract) {
    setBlankEditor({ model: c.model, fileBase: c.fileBase });
    setSearchParams({ section: "blank" });
  }

  function handleTemplateSaved(templateId: string, andContinue: boolean) {
    setLibraryRefreshKey((k) => k + 1);
    // Animation "+1" sur Bibliothèque de modèles dans les deux cas (le modèle est bien enregistré).
    notifyAdded();
    if (andContinue) {
      // Tunnel continu : on enchaîne directement sur la génération du contrat,
      // sans repasser par la bibliothèque.
      setSearchParams({ section: "useCustom", tpl: templateId });
    } else {
      // Enregistrer seulement : on montre le modèle ajouté dans la bibliothèque.
      setSearchParams({ section: "library" });
    }
  }

  const LABELS: Record<Exclude<Section, null>, string> = {
    library: "Bibliothèque de modèles",
    import: "Importer un modèle",
    form: "Remplir le contrat",
    useCustom: "Utiliser un modèle personnalisé",
    scratch: "Créer de zéro",
    blank: "Nouveau contrat",
  };

  const SUBS: Record<Exclude<Section, null>, string> = {
    library: "",
    import: "Importez un contrat existant pour le transformer en modèle réutilisable.",
    form: "Renseignez les informations pour personnaliser votre contrat.",
    useCustom: "",
    scratch: "Générez un contrat sur-mesure en répondant à quelques questions.",
    blank: "",
  };

  function goHub() {
    setSearchParams({});
    setSection(null);
  }

  // Retour à la bibliothèque depuis un éditeur / flux : on remet l'état ET l'URL.
  // (setSection direct couvre le cas où l'URL vaut déjà ?section=library — un
  // setSearchParams identique serait un no-op et ne redéclencherait pas la synchro.)
  function goLibrary() {
    setUseTemplateId(null);
    setBlankEditor(null);
    setSection("library");
    setSearchParams({ section: "library" });
  }

  // Les éditeurs document-first (form, blank, useCustom) ont leur propre retour : pas de bannière.
  const hasSectionBanner = section !== null && section !== "form" && section !== "blank" && section !== "useCustom";

  // Contrat ouvert dans l'éditeur : le menu latéral se replie pour laisser
  // toute la largeur au document, et revient en quittant l'éditeur.
  const estEditeur = section === "form" || section === "blank" || section === "useCustom";
  const setEditeurPleinEcran = useLayoutStore((s) => s.setEditeurPleinEcran);
  useEffect(() => {
    setEditeurPleinEcran(estEditeur);
    return () => setEditeurPleinEcran(false);
  }, [estEditeur, setEditeurPleinEcran]);

  return (
    <div className={section ? "space-y-6 mx-auto w-full max-w-7xl" : ""}>
      {section && hasSectionBanner && (
        <PageBanner
          backLink={{ label: "Générateur de contrat", onClick: goHub }}
          title={LABELS[section]}
          subtitle={SUBS[section]}
        />
      )}

    {/* Pas de cadre autour des sous-sections : chacune a déjà le sien, un
        cadre de plus faisait double emploi et réduisait la place utile. */}
    <div className={section ? "space-y-8" : ""}>
      {/* Hub — les 3 façons de créer un contrat */}
      {!section && (
        <GenerateurHub
          onCreate={handleCreateFromHub}
          onImport={() => setSearchParams({ section: "import" })}
          onLibrary={() => setSearchParams({ section: "library" })}
        />
      )}

      {/* Sous-sections */}
      {section === "library" && <LibrarySection onUse={handleUseModel} onUseCustom={handleUseCustomTemplate} onCreate={handleCreate} onOpenCreated={handleOpenCreated} refreshKey={libraryRefreshKey} />}
      {section === "import" && (
        <div className="w-full flex justify-center">
          <ImportSection onSaved={handleTemplateSaved} onReviewDisplayed={setIsImportReviewDisplayed} />
        </div>
      )}
      {section === "form" && (
        <SmartCddEditor
          model={GENERIC_EDITORS[formDocId].model}
          fileBase={GENERIC_EDITORS[formDocId].fileBase}
          onBack={goLibrary}
        />
      )}
      {section === "blank" && blankEditor && (
        <SmartCddEditor
          model={blankEditor.model}
          fileBase={blankEditor.fileBase}
          onBack={goLibrary}
        />
      )}
      {section === "useCustom" && useTemplateId && (
        <CustomTemplateEditor
          templateId={useTemplateId}
          onBack={goLibrary}
        />
      )}

      {section === "scratch" && !wizardTitle && (
        <div className="flex justify-center w-full py-4">
          <ScratchEntry
            onStart={(title) => setSearchParams({ section: "scratch", titre: title })}
            onBack={goHub}
          />
        </div>
      )}

      {section === "scratch" && wizardTitle && (
        <ScratchWizard
          title={wizardTitle}
          initialBrief={initialBriefRef.current}
          onReady={handleScratchReady}
          onBack={handleScratchBack}
        />
      )}
    </div>
    </div>
  );
}
