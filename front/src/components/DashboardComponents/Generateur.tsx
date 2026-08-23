import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import {
  BookOpen, Upload, Sparkles, ChevronLeft, ChevronRight,
  Briefcase, ClipboardList, FileText, Shield,
  UploadCloud, Lock, CheckCircle2,
  Loader2, AlertCircle, Trash2, Search,
} from "lucide-react";
import { fetchProxy } from "../../utils/fetchProxy";
import { useTemplateNotificationStore } from "../../store/templateNotificationStore";
import { SmartCddEditor } from "./cdd/smart/SmartCddEditor";
import type { ContractModel, VariableDef, BlockDef } from "../../contractEngine/types";
import { cddAccroissementModel } from "../../contractEngine/models/cddAccroissement";
import { cdiModel } from "../../contractEngine/models/cdi";
import { avenantModel } from "../../contractEngine/models/avenant";
import { lettreDisciplinaireModel } from "../../contractEngine/models/lettreDisciplinaire";
import { ruptureConventionnelleModel } from "../../contractEngine/models/ruptureConventionnelle";
import { ScratchWizard } from "./generateur/ScratchFlow";
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
  { id: "cdi",           Icon: Briefcase,     short: "CDI",  label: "Contrat à durée indéterminée" },
  { id: "cdd",           Icon: ClipboardList, short: "CDD",  label: "Contrat à durée déterminée" },
  { id: "avenant",       Icon: FileText,      short: "AVN",  label: "Avenant au contrat de travail" },
  { id: "disciplinaire", Icon: BookOpen,      short: "DISC", label: "Lettre disciplinaire" },
  { id: "rupture",       Icon: Shield,        short: "RC",   label: "Rupture conventionnelle" },
] as const;
type DocId = typeof DOC_TYPES[number]["id"];

/** Modèle + nom de fichier d'export pour l'éditeur document-first, par type de contrat. */
const GENERIC_EDITORS: Record<DocId, { model: ContractModel; fileBase: string }> = {
  cdi:           { model: cdiModel, fileBase: "CDI" },
  cdd:           { model: cddAccroissementModel, fileBase: "CDD-accroissement" },
  avenant:       { model: avenantModel, fileBase: "Avenant" },
  disciplinaire: { model: lettreDisciplinaireModel, fileBase: "Lettre-disciplinaire" },
  rupture:       { model: ruptureConventionnelleModel, fileBase: "Rupture-conventionnelle" },
};

/** Normalise (minuscules + sans accents) pour une recherche tolérante. */
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Date lisible pour l'historique des contrats créés. */
function formatCreatedAt(ts: number): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "";
  }
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
    <div className="w-full max-w-4xl mx-auto space-y-6">
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

      {(loading || genericMatches.length > 0 || customMatches.length > 0) && (
      <div className="overflow-hidden rounded-card border border-line bg-white shadow-card divide-y divide-line-subtle">
        {loading && (
          <div className="flex items-center gap-2 px-4 py-3 text-[12px] text-ink-subtle">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement…
          </div>
        )}

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

        {customMatches.length > 0 && (
          <div className="py-1">
            <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
              Vos modèles enregistrés
            </p>
            {customMatches.map((t) => (
              <div
                key={t.id}
                className="group flex w-full items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-subtle"
              >
                <button onClick={() => onUseCustom(t.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-panel bg-surface-muted">
                    <FileText className="h-4 w-4 text-ink-subtle" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{t.name}</span>
                </button>
                <button
                  onClick={() => handleDelete(t)}
                  title="Supprimer ce modèle"
                  className="shrink-0 rounded-lg p-1.5 text-ink-subtle opacity-0 transition-all hover:bg-danger-light hover:text-danger group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <ConfirmationModal
          open={validateModalOpen}
          title="Supprimer le modèle"
          description={`Souhaitez-vous supprimer le modèle ?`}
          confirmLabel="Valider"
          onConfirm={validateConfirmed}
          onCancel={() => { setValidateModalOpen(false); setContractDelete(null); }}
        />
      </div>
      )}

      {/* Historique des contrats créés — volontairement discret (sous les modèles) */}
      {createdMatches.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-panel border border-line-subtle bg-surface-subtle/60 divide-y divide-line-subtle">
          <p className="px-3 pt-2 pb-0.5 text-[9px] font-semibold uppercase tracking-widest text-ink-subtle/80">
            Historique des contrats créés
          </p>
          {createdMatches.map((c) => (
            <div
              key={c.id}
              className="group flex w-full items-center gap-2.5 px-3 py-1.5 transition-colors hover:bg-surface-muted/60"
            >
              <button onClick={() => onOpenCreated(c)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                <FileText className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink-secondary">{c.title}</span>
                  <span className="block text-[10px] text-ink-subtle">{formatCreatedAt(c.createdAt)}</span>
                </span>
              </button>
              <button
                onClick={() => handleDeleteCreated(c.id)}
                title="Retirer de l'historique"
                className="shrink-0 rounded-lg p-1 text-ink-subtle opacity-0 transition-all hover:bg-danger-light hover:text-danger group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
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

function VariableSelector({
  structure,
  essentialVars,
  onToggleVar,
}: {
  structure: TemplateStructure;
  essentialVars: Set<string>;
  onToggleVar: (name: string) => void;
}) {
  return (
    <div className="bg-white border border-line rounded-card px-8 py-7 shadow-card">
      <div className="space-y-6">
        {(structure.sections ?? []).map((sec, si) => (
          <section key={si} className="space-y-3">
            <h4 className="text-[13px] font-bold text-ink tracking-tight">{sec.title}</h4>
            <div className="space-y-3">
              {(sec.clauses ?? []).map((cl) => {
                const tokens = tokenizeContent(cl.content);
                return (
                  <div key={cl.id} className="space-y-1.5">
                    {cl.title && (
                      <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">{cl.title}</p>
                    )}
                    <p className="text-[13px] text-ink-secondary leading-relaxed">
                      {tokens.map((t, i) => {
                        if (t.type === "text") return <span key={i}>{t.value}</span>;
                        const isEssential = essentialVars.has(t.name);
                        return (
                          <button
                            key={i}
                            onClick={() => onToggleVar(t.name)}
                            title={isEssential ? `Variable « ${humanizeVar(t.name)} » — cliquez pour la désélectionner` : `Variable « ${humanizeVar(t.name)} » désélectionnée — cliquez pour la sélectionner`}
                            className={`inline align-baseline mx-[1px] px-1 py-[1px] rounded-chip text-[13px] transition-all border-2 ${
                              isEssential
                                ? "bg-success-light text-success-dark border-success/50 border-dashed hover:bg-success-light/70 font-medium"
                                : "bg-transparent text-ink-subtle border-transparent line-through hover:text-ink-secondary"
                            }`}
                          >
                            {t.text}
                          </button>
                        );
                      })}
                    </p>
                  </div>
                );
              })}
            </div>
            {si < (structure.sections ?? []).length - 1 && (
              <div className="pt-2 border-b border-line-subtle" />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

// ─── Import ───────────────────────────────────────────────────────────────────

type ImportStep = "form" | "processing" | "review";

function ImportSection({ onSaved }: { onSaved?: (templateId: string, andContinue: boolean) => void } = {}) {
  const [file, setFile]         = useState<File | null>(null);
  const [name, setName]         = useState("");
  const [aiHints, setAiHints]   = useState("");
  const [step, setStep]         = useState<ImportStep>("form");
  const [error, setError]       = useState("");
  const [savedMeta, setSavedMeta]     = useState<ContractTemplateDTO | null>(null);
  const [structure, setStructure]     = useState<TemplateStructure | null>(null);
  const [essentialVars, setEssentialVars] = useState<Set<string>>(new Set());
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  function toggleEssentialVar(name: string) {
    setEssentialVars((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
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
          aiHints: aiHints.trim() || undefined,
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
      await fetchProxy(`/api/template/${savedMeta.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ structure: filteredStructure }),
      });
      setSaved(true);
      onSaved?.(savedMeta.id, andContinue);
    } catch { /* silent */ }
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
    const allVars = extractAllVariables(structure);
    const totalVars = allVars.length;
    const essentialCount = essentialVars.size;

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
              onClick={() => {
                setStep("form"); setFile(null); setName("");
                setSavedMeta(null); setStructure(null); setEssentialVars(new Set()); setSaved(false);
              }}
              className="px-5 py-2.5 text-sm font-semibold text-brand bg-white border border-line rounded-xl hover:bg-surface-subtle transition-colors shadow-card"
            >
              Importer un autre modèle
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5 max-w-4xl">
        {/* Compteur + aide */}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 text-sm">
            <span className="text-ink-muted">
              <span className="font-bold text-ink">{totalVars}</span> variables détectées
            </span>
            <span className="text-ink-placeholder">·</span>
            <span className="text-success-dark">
              <span className="font-bold">{essentialCount}</span> sélectionnée{essentialCount > 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-ink-subtle">
            Cliquez sur une variable pour la retirer du modèle.
          </p>
        </div>

        <VariableSelector
          structure={structure}
          essentialVars={essentialVars}
          onToggleVar={toggleEssentialVar}
        />

        {/* Actions en bas */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            onClick={() => {
              setStep("form"); setFile(null); setName(""); setAiHints("");
              setSavedMeta(null); setStructure(null); setEssentialVars(new Set());
            }}
            className="text-xs text-ink-subtle hover:text-ink-secondary transition-colors underline underline-offset-2"
          >
            Annuler
          </button>
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Secondaire : enregistrer seulement (autorisé même sans variable — modèle statique valide) */}
            <button
              onClick={() => void handleSaveStructure(false)}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-brand bg-white border border-line rounded-xl hover:bg-surface-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-card"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Enregistrer le modèle
            </button>
            {/* Primaire : enregistrer + poursuivre le tunnel de génération */}
            <button
              onClick={() => void handleSaveStructure(true)}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-card"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Enregistrer et générer un contrat
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
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
          className={`relative rounded-panel border-2 border-dashed px-6 py-8 text-center transition-all duration-200 cursor-pointer ${
            isDragActive ? "border-brand bg-brand-light"
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

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-ink-muted uppercase tracking-widest">
              Indications pour l'analyse <span className="text-ink-placeholder normal-case">(optionnel)</span>
            </label>
            <span className="text-[10px] text-ink-subtle">{aiHints.length}/500</span>
          </div>
          <textarea
            value={aiHints}
            onChange={(e) => setAiHints(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="ex. Ce contrat concerne une cession de droits de propriété intellectuelle. Identifie comme variables : les noms des parties, les dates, les montants, la description de l'invention…"
            className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink-secondary outline-none focus:border-brand/40 focus:shadow-ring-brand transition-all resize-none leading-relaxed placeholder:text-ink-placeholder"
          />
          <p className="text-[11px] text-ink-subtle leading-relaxed">
            Aide l'IA à mieux identifier les variables à détecter (contexte, types d'informations à personnaliser).
          </p>
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
  const variables: VariableDef[] = extractAllVariables(structure).map((name) => ({
    id: name,
    label: humanizeVar(name),
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
 * dessous, les étapes. La génération réutilise le questionnaire de la
 * bibliothèque de modèles (ScratchWizard : questions fermées une à une,
 * puis rédaction IA et ouverture dans l'éditeur).
 */
function ScratchEntry({ onStart, onBack }: { onStart: (title: string) => void; onBack: () => void }) {
  const [title, setTitle] = useState("");
  const canStart = title.trim().length >= 3;

  return (
    <div className="w-full max-w-4xl">
      <div className="bg-white rounded-card border border-line shadow-card p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink-secondary mb-2">
            Quel contrat souhaitez-vous créer ?
          </label>
          <div className="flex flex-col sm:flex-row gap-2 w-full min-w-0">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canStart && onStart(title.trim())}
              placeholder="ex : Contrat de prestation de services informatiques"
              className="w-full sm:flex-1 p-2.5 border border-line rounded-xl text-sm text-ink outline-none focus:border-brand/40 focus:shadow-ring-brand transition-all placeholder:text-ink-placeholder min-w-0"
            />
            <button
              onClick={() => onStart(title.trim())}
              disabled={!canStart}
              className="w-full sm:w-auto px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-card shrink-0"
            >
              Commencer
            </button>
          </div>
        </div>

        {/* Les étapes */}
        <ol className="space-y-2 text-sm text-ink-muted">
          <li className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-brand-light text-brand text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
            Nommez le contrat souhaité
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-brand-light text-brand text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
            Décrivez votre besoin — ou cadrez par questions
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-brand-light text-brand text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
            Le contrat s&apos;ouvre dans l&apos;éditeur, article RGPD inclus
          </li>
        </ol>
      </div>
    </div>
  );
}

export function Generateur() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [section, setSection]     = useState<Section>(null);
  const [formDocId, setFormDocId] = useState<DocId>("cdi");
  const [useTemplateId, setUseTemplateId] = useState<string | null>(null);
  const [blankEditor, setBlankEditor] = useState<{ model: ContractModel; fileBase: string } | null>(null);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
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

  // Retour depuis le questionnaire : vers la bibliothèque si on en vient,
  // sinon vers l'écran d'entrée « Créer de zéro ».
  function handleScratchBack() {
    const de = searchParams.get("de");
    if (de === "library") goLibrary();
    else if (de === "dashboard") {
      navigate("/dashboard")
    }
    else setSearchParams({ section: "scratch" });
  }

  // Contrat créé par le questionnaire : on l'archive, on le préenregistre en
  // bibliothèque de modèles (réutilisable), puis on ouvre l'éditeur.
  function handleScratchReady(r: { model: ContractModel; fileBase: string }) {
    const title = wizardTitle ?? r.model.label;
    addCreatedContract({ title, model: r.model, fileBase: r.fileBase });
    void saveModelAsTemplate(title, r.model);
    setBlankEditor(r);
    setSearchParams({ section: "blank" });
  }

  /** Préenregistre le contrat généré comme modèle réutilisable (best-effort :
   *  un échec ne bloque jamais l'ouverture de l'éditeur). Le tokeniseur des
   *  modèles lit nativement le format {{variable}} : aucune conversion du
   *  contenu n'est nécessaire. */
  async function saveModelAsTemplate(title: string, model: ContractModel) {
    try {
      const structure: TemplateStructure = {
        sections: model.blocks
          .filter((b) => b.kind !== "title" && b.content?.trim())
          .map((b, i) => {
            const heading = b.heading?.trim() || (b.kind === "signature" ? "Signatures" : `Section ${i + 1}`);
            const vars = model.variables
              .filter((v) => (b.content ?? "").includes(`{{${v.id}}}`))
              .map((v) => v.id);
            return {
              title: heading,
              clauses: [{ id: b.id, title: heading, content: b.content, variables: vars }],
            };
          }),
        detectedVariables: model.variables.map((v) => v.id),
      };
      const res = await fetchProxy("/api/template", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: title, contractType: title, structure }),
      });
      if (res.ok) notifyAdded();
    } catch {
      // silencieux : le contrat reste utilisable et ré-enregistrable plus tard
    }
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
    library:   "Bibliothèque de modèles",
    import:    "Importer un modèle",
    form:      "Remplir le contrat",
    useCustom: "Utiliser un modèle personnalisé",
    scratch:   "Créer de zéro",
    blank:     "Nouveau contrat",
  };

  const SUBS: Record<Exclude<Section, null>, string> = {
    library:   "",
    import:    "Importez un contrat existant pour le transformer en modèle réutilisable.",
    form:      "Renseignez les informations pour personnaliser votre contrat.",
    useCustom: "",
    scratch:   "Générez un contrat sur-mesure en répondant à quelques questions.",
    blank:     "",
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

  return (
    <div className="space-y-8 max-w-5xl mx-auto border border-gray rounded-2xl pb-4 pl-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 bg-blue-primary px-8 py-8 rounded-t-2xl -ml-4">

      {/* En-tête — masqué pour l'éditeur document-first (chaque éditeur a son propre retour) */}
      {section !== "form" && section !== "blank" && section !== "useCustom" && (
        <div>
          {section && (
            <button
              onClick={goHub}
              className="flex items-center gap-1.5 text-xs text-ink-subtle hover:text-brand transition-colors mb-2 font-medium"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Générateur de contrat
            </button>
          )}
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {section ? LABELS[section] : "Générateur de contrat"}
          </h1>
          {(section ? SUBS[section] : "Accédez à vos modèles ou importez-en un nouveau.") && (
            <p className="text-sm text-gray-primary mt-1">
              {section ? SUBS[section] : "Accédez à vos modèles ou importez-en un nouveau."}
            </p>
          )}
        </div>
      )}
      </div>

      {/* Hub — 3 cartes */}
      {!section && (
        <div className="flex flex-col gap-5 max-w-4xl">
          {/* Créer de zéro */}
          <button
            onClick={() => setSearchParams({ section: "scratch" })}
            className="group relative flex items-start gap-5 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-violet-300 transition-all duration-200 text-left active:scale-[0.99] overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-violet-500 rounded-t-2xl" />
            <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-violet-600 stroke-[1.5]" />
            </div>
            <div className="flex flex-col gap-3 flex-1">
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-gray-900">Créer de zéro</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Décrivez le contrat, répondez à quelques questions : il est rédigé pour vous.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-600">
                Créer <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>

          <button
            onClick={() => setSearchParams({ section: "library" })}
            className="group relative flex items-start gap-5 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-brand/30 transition-all duration-200 text-left active:scale-[0.99] overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-brand rounded-t-2xl" />
            <div className="w-12 h-12 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-brand stroke-[1.5]" />
            </div>

            <div className="flex flex-col gap-3 flex-1">
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-gray-900">Bibliothèque de modèles</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  CDI, CDD, avenants, lettres disciplinaires — et vos modèles personnalisés. Prêts à l'emploi.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-brand">
                Accéder <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>

          <button
            onClick={() => setSearchParams({ section: "import" })}
            className="group relative flex items-start gap-5 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-emerald-300 transition-all duration-200 text-left active:scale-[0.99] overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-emerald-500 rounded-t-2xl" />
            
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5 text-emerald-600 stroke-[1.5]" />
            </div>

            <div className="flex flex-col gap-3 flex-1">
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-gray-900">Importer un modèle</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Importez un document existant (PDF, Word) pour le modifier, personnaliser et réutiliser.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                Importer <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Sous-sections */}
      {section === "library"   && <LibrarySection onUse={handleUseModel} onUseCustom={handleUseCustomTemplate} onCreate={handleCreate} onOpenCreated={handleOpenCreated} refreshKey={libraryRefreshKey} />}
      {section === "import"    && (
        <div className="w-full flex justify-center py-4">
          <ImportSection onSaved={handleTemplateSaved} />
        </div>
        )}
      {section === "form"      && (
        <SmartCddEditor
          model={GENERIC_EDITORS[formDocId].model}
          fileBase={GENERIC_EDITORS[formDocId].fileBase}
          onBack={goLibrary}
        />
      )}
      {section === "blank"     && blankEditor && (
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

      {section === "scratch"   && !wizardTitle && (
        <div className="flex justify-center w-full py-4">
        <ScratchEntry
          onStart={(title) => setSearchParams({ section: "scratch", titre: title })}
          onBack={goHub}
        />
        </div>
      )}

      {section === "scratch"   && wizardTitle && (
          <ScratchWizard
            title={wizardTitle}
            initialBrief={initialBriefRef.current}
            onReady={handleScratchReady}
            onBack={handleScratchBack}
          />
      )}
    </div>
  );
}
