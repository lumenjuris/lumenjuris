import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import {
  BookOpen, Upload, Sparkles, ChevronLeft, ChevronRight,
  Briefcase, ClipboardList, FileText, Shield,
  UploadCloud, Lock, CheckCircle2,
  Loader2, AlertCircle, Trash2, X,
  ScrollText, Plus, ShieldCheck,
} from "lucide-react";
import { useUserStore } from "../../store/userStore";
import { fetchProxy } from "../../utils/fetchProxy";
import { useTemplateNotificationStore } from "../../store/templateNotificationStore";
import { clauseApi } from "./clauses/api";
import { CATEGORY_LABEL, POSITION_LABEL } from "./clauses/types";
import type { Clause } from "./clauses/types";

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

// ─── Mémorisation des valeurs de variables (localStorage) ────────────────────

const KNOWN_VARS_KEY = "lumenjuris-known-vars-v1";

function loadKnownVars(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KNOWN_VARS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch { return {}; }
}

function saveKnownVars(values: Record<string, string>): void {
  try {
    const current = loadKnownVars();
    const merged = { ...current };
    for (const [k, v] of Object.entries(values)) {
      if (v && v.trim()) merged[k] = v.trim();
    }
    localStorage.setItem(KNOWN_VARS_KEY, JSON.stringify(merged));
  } catch { /* silent */ }
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

type Section = "library" | "import" | "form" | "useCustom" | null;

// ─── Données ─────────────────────────────────────────────────────────────────

const DOC_TYPES = [
  { id: "cdi",           Icon: Briefcase,     short: "CDI",  label: "Contrat à durée indéterminée" },
  { id: "cdd",           Icon: ClipboardList, short: "CDD",  label: "Contrat à durée déterminée" },
  { id: "avenant",       Icon: FileText,      short: "AVN",  label: "Avenant au contrat de travail" },
  { id: "disciplinaire", Icon: BookOpen,      short: "DISC", label: "Lettre disciplinaire" },
  { id: "rupture",       Icon: Shield,        short: "RC",   label: "Rupture conventionnelle" },
] as const;
type DocId = typeof DOC_TYPES[number]["id"];

const PREVIEWS: Record<DocId, { title: string; articles: { heading: string; body: string }[] }> = {
  cdi: {
    title: "CONTRAT À DURÉE INDÉTERMINÉE",
    articles: [
      { heading: "Article 1 – Engagement",      body: "La société engage le salarié en qualité de [poste] à compter du [date]. Le présent contrat est soumis aux dispositions de la convention collective [convention]." },
      { heading: "Article 2 – Période d'essai", body: "Le présent contrat est conclu sous réserve d'une période d'essai de [durée] mois, renouvelable une fois selon les conditions légales en vigueur." },
      { heading: "Article 3 – Rémunération",    body: "La rémunération mensuelle brute est fixée à [montant] €, versée le dernier jour ouvré de chaque mois." },
    ],
  },
  cdd: {
    title: "CONTRAT À DURÉE DÉTERMINÉE",
    articles: [
      { heading: "Article 1 – Objet",  body: "Le présent contrat est conclu pour [motif de recours] conformément aux articles L1242-1 du Code du travail." },
      { heading: "Article 2 – Durée",  body: "Le contrat est conclu du [date début] au [date fin], soit une durée de [X] mois." },
    ],
  },
  avenant: {
    title: "AVENANT AU CONTRAT DE TRAVAIL",
    articles: [
      { heading: "Article 1 – Objet",        body: "Le présent avenant modifie le contrat de travail conclu le [date] entre [société] et [salarié]." },
      { heading: "Article 2 – Modification", body: "À compter du [date d'effet], les dispositions suivantes remplacent les clauses correspondantes du contrat initial." },
    ],
  },
  disciplinaire: {
    title: "LETTRE DISCIPLINAIRE",
    articles: [
      { heading: "Objet",           body: "Nous avons été amenés à constater des faits de nature à justifier une sanction disciplinaire à votre encontre." },
      { heading: "Faits reprochés", body: "[Description précise des faits reprochés, dates, circonstances…]" },
    ],
  },
  rupture: {
    title: "RUPTURE CONVENTIONNELLE",
    articles: [
      { heading: "Article 1 – Accord",    body: "L'employeur et le salarié conviennent d'un commun accord de mettre fin au contrat de travail conformément aux articles L1237-11 du Code du travail." },
      { heading: "Article 2 – Indemnité", body: "Le salarié percevra une indemnité spécifique de rupture conventionnelle d'un montant de [montant] €." },
    ],
  },
};

// ─── Formulaire multi-étapes ──────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Votre société" },
  { id: 2, label: "Partie adverse" },
  { id: 3, label: "Projet" },
  { id: 4, label: "Délais" },
  { id: 5, label: "Pénalité" },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
              current > s.id  ? "bg-[#354F99] border-[#354F99] text-white"
              : current === s.id ? "bg-white border-[#354F99] text-[#354F99]"
              : "bg-white border-gray-200 text-gray-400"
            }`}>
              {current > s.id
                ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                : s.id}
            </div>
            <span className={`mt-1 text-[10px] font-medium whitespace-nowrap ${current >= s.id ? "text-[#354F99]" : "text-gray-400"}`}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${current > s.id ? "bg-[#354F99]" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function FormField({ label, name, value, onChange, placeholder = "" }: {
  label: string; name: string; value: string;
  onChange?: (name: string, value: string) => void; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
        {label}
      </label>
      <input
        type="text" id={name} name={name} value={value ?? ""}
        onChange={onChange ? (e) => onChange(name, e.target.value) : undefined}
        placeholder={placeholder || "—"}
        readOnly={!onChange}
        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-[#354F99]/50 focus:bg-white focus:ring-2 focus:ring-[#354F99]/10"
      />
    </div>
  );
}

function FormSection({ docId, onBack }: { docId: DocId; onBack: () => void }) {
  const userStored = useUserStore();
  const enterprise = userStored.userData?.enterprise;
  const [step, setStep]   = useState(1);
  const [form, setForm]   = useState({
    partie_1_capital: "", partie_1_ville: "", partie_1_rcs_ville: "",
    partie_1_representant: "", partie_1_qualite: "",
    partie_2_nom: "", partie_2_forme_juridique: "", partie_2_capital: "",
    partie_2_code_postal: "", partie_2_ville: "", partie_2_rcs_ville: "",
    partie_2_siren: "", partie_2_representant: "", partie_2_qualite: "",
    description_projet: "",
    delai_confirmation_orale: "", delai_notification_confidentialite: "",
    delai_restitution: "", duree_accord: "", duree_obligations_post_accord: "",
    montant_penalite: "",
  });

  const set = (name: string, value: string) => setForm((p) => ({ ...p, [name]: value }));
  const docType = DOC_TYPES.find((d) => d.id === docId)!;

  return (
    <div className="max-w-2xl">
      {/* Badge type de contrat */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs font-bold uppercase tracking-widest text-[#354F99] bg-[#354F99]/10 px-3 py-1 rounded-full">
          {docType.short}
        </span>
        <span className="text-sm text-gray-500">{docType.label}</span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <StepIndicator current={step} />
        <h2 className="text-base font-bold text-gray-800 mb-6">{STEPS[step - 1].label}</h2>

        {/* Étape 1 — Votre société */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nom"              name="partie_1_nom"              value={enterprise?.name ?? ""}              placeholder="Raison sociale" />
            <FormField label="Forme juridique"  name="partie_1_forme_juridique"  value={enterprise?.statusJuridique ?? ""}  placeholder="SAS, SARL…" />
            <FormField label="Capital (€)"      name="partie_1_capital"          value={form.partie_1_capital}          onChange={set} placeholder="10 000" />
            <FormField label="Code postal"      name="partie_1_code_postal"      value={enterprise?.address?.codePostal ?? ""} placeholder="75001" />
            <FormField label="Ville"            name="partie_1_ville"            value={form.partie_1_ville}            onChange={set} placeholder="Paris" />
            <FormField label="Ville RCS"        name="partie_1_rcs_ville"        value={form.partie_1_rcs_ville}        onChange={set} placeholder="Paris" />
            <FormField label="SIREN"            name="partie_1_siren"            value={enterprise?.siren ?? ""}        placeholder="" />
            <FormField label="Représentant"     name="partie_1_representant"     value={form.partie_1_representant}     onChange={set} placeholder="Prénom Nom" />
            <FormField label="Qualité"          name="partie_1_qualite"          value={form.partie_1_qualite}          onChange={set} placeholder="Gérant, PDG…" />
            <FormField label="Désignation"      name="partie_1_designation"      value="Partie divulgatrice"            placeholder="" />
          </div>
        )}

        {/* Étape 2 — Partie adverse */}
        {step === 2 && (
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nom"             name="partie_2_nom"             value={form.partie_2_nom}             onChange={set} />
            <FormField label="Forme juridique" name="partie_2_forme_juridique" value={form.partie_2_forme_juridique} onChange={set} placeholder="SAS, SARL…" />
            <FormField label="Capital (€)"     name="partie_2_capital"         value={form.partie_2_capital}         onChange={set} />
            <FormField label="Code postal"     name="partie_2_code_postal"     value={form.partie_2_code_postal}     onChange={set} />
            <FormField label="Ville"           name="partie_2_ville"           value={form.partie_2_ville}           onChange={set} />
            <FormField label="Ville RCS"       name="partie_2_rcs_ville"       value={form.partie_2_rcs_ville}       onChange={set} />
            <FormField label="SIREN"           name="partie_2_siren"           value={form.partie_2_siren}           onChange={set} />
            <FormField label="Représentant"    name="partie_2_representant"    value={form.partie_2_representant}    onChange={set} />
            <FormField label="Qualité"         name="partie_2_qualite"         value={form.partie_2_qualite}         onChange={set} />
            <FormField label="Désignation"     name="partie_2_designation"     value="Partie réceptrice"             placeholder="" />
          </div>
        )}

        {/* Étape 3 — Projet */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                Description du projet
              </label>
              <textarea
                rows={6} value={form.description_projet}
                onChange={(e) => set("description_projet", e.target.value)}
                placeholder="Décrivez le projet ou la collaboration concernée par cet accord…"
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-[#354F99]/50 focus:bg-white focus:ring-2 focus:ring-[#354F99]/10 resize-none"
              />
            </div>
          </div>
        )}

        {/* Étape 4 — Délais */}
        {step === 4 && (
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Délai confirmation orale (j)"       name="delai_confirmation_orale"           value={form.delai_confirmation_orale}           onChange={set} placeholder="5" />
            <FormField label="Délai notification confidentialité" name="delai_notification_confidentialite" value={form.delai_notification_confidentialite} onChange={set} placeholder="15" />
            <FormField label="Délai restitution (j)"              name="delai_restitution"                  value={form.delai_restitution}                  onChange={set} placeholder="30" />
            <FormField label="Durée de l'accord"                  name="duree_accord"                       value={form.duree_accord}                       onChange={set} placeholder="2 ans" />
            <div className="col-span-2">
              <FormField label="Durée obligations post-accord" name="duree_obligations_post_accord" value={form.duree_obligations_post_accord} onChange={set} placeholder="1 an" />
            </div>
          </div>
        )}

        {/* Étape 5 — Pénalité */}
        {step === 5 && (
          <div className="flex flex-col gap-4">
            <FormField label="Montant de la pénalité (€)" name="montant_penalite" value={form.montant_penalite} onChange={set} placeholder="50 000" />
            <p className="text-xs text-gray-400">Ce montant sera appliqué en cas de violation de l'accord de confidentialité.</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
          <button
            onClick={() => step > 1 ? setStep((s) => s - 1) : onBack()}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition active:scale-95"
          >
            ← {step > 1 ? "Précédent" : "Retour aux modèles"}
          </button>

          {step < STEPS.length ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="rounded-xl bg-[#354F99] hover:bg-[#1a2d5a] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-95"
            >
              Suivant →
            </button>
          ) : (
            <button
              onClick={() => console.log("Générer le contrat", form)}
              className="rounded-xl bg-gradient-to-r from-[#354F99] to-[#1a2d5a] px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90 active:scale-95"
            >
              ✓ Valider et générer
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 mt-3">
        Étape {step} sur {STEPS.length}
      </p>
    </div>
  );
}

// ─── Bibliothèque ─────────────────────────────────────────────────────────────

type LibraryTab = "generic" | "custom";

function LibrarySection({
  onUse,
  onUseCustom,
  refreshKey,
}: {
  onUse: (id: DocId) => void;
  onUseCustom: (externalId: string) => void;
  refreshKey?: number;
}) {
  const [tab, setTab] = useState<LibraryTab>("generic");
  const [selected, setSelected] = useState<DocId>("cdi");
  const [customList, setCustomList] = useState<ContractTemplateDTO[]>([]);
  const [customSelected, setCustomSelected] = useState<string | null>(null);
  const [customDetail, setCustomDetail] = useState<TemplateStructure | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContractTemplateDTO | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [internalRefresh, setInternalRefresh] = useState(0);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetchProxy(`/api/template/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      // Si on supprimait le modèle sélectionné, on désélectionne
      if (customSelected === deleteTarget.id) {
        setCustomSelected(null);
        setCustomDetail(null);
      }
      setDeleteTarget(null);
      setInternalRefresh((k) => k + 1);
    } catch { /* silent */ }
    finally { setDeleting(false); }
  }

  // Charge la liste des modèles personnalisés
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      try {
        const res = await fetchProxy("/api/template", { credentials: "include" });
        const data = await res.json() as { success: boolean; data?: ContractTemplateDTO[] };
        if (!cancelled && data.success && data.data) {
          setCustomList(data.data);
          if (data.data.length > 0 && !customSelected) setCustomSelected(data.data[0].id);
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setLoadingList(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, internalRefresh]);

  // Charge le détail d'un modèle personnalisé
  useEffect(() => {
    if (!customSelected || tab !== "custom") return;
    let cancelled = false;
    (async () => {
      setLoadingDetail(true);
      try {
        const res = await fetchProxy(`/api/template/${customSelected}`, { credentials: "include" });
        const data = await res.json() as { success: boolean; data?: { structure: TemplateStructure } };
        if (!cancelled && data.success && data.data) setCustomDetail(data.data.structure);
      } catch { /* silent */ }
      finally { if (!cancelled) setLoadingDetail(false); }
    })();
    return () => { cancelled = true; };
  }, [customSelected, tab]);

  const preview = PREVIEWS[selected];
  const docType = DOC_TYPES.find((d) => d.id === selected)!;
  const customMeta = customList.find((t) => t.id === customSelected) ?? null;

  return (
    <div className="space-y-5">
      {/* Onglets */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab("generic")}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            tab === "generic"
              ? "bg-white text-[#354F99] shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Modèles génériques
          <span className="ml-1.5 text-[10px] text-gray-400">{DOC_TYPES.length}</span>
        </button>
        <button
          onClick={() => setTab("custom")}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
            tab === "custom"
              ? "bg-white text-[#354F99] shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Modèles personnalisés
          <span className="ml-1.5 text-[10px] text-gray-400">{customList.length}</span>
        </button>
      </div>

      {/* GÉNÉRIQUES */}
      {tab === "generic" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Liste */}
          <div className="lg:col-span-2 flex flex-col gap-2">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1 px-1">
              Modèles disponibles
            </p>
            {DOC_TYPES.map(({ id, Icon, short, label }) => (
              <button
                key={id}
                onClick={() => setSelected(id)}
                className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all duration-150 ${
                  selected === id
                    ? "border-[#354F99] bg-[#354F99]/5 shadow-sm"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60"
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  selected === id ? "bg-[#354F99] text-white" : "bg-gray-100 text-gray-400 group-hover:bg-gray-200"
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${selected === id ? "text-[#354F99]" : "text-gray-700"}`}>{short}</p>
                  <p className="text-xs text-gray-400 truncate">{label}</p>
                </div>
                {selected === id && <CheckCircle2 className="w-4 h-4 text-[#354F99] shrink-0" />}
              </button>
            ))}

            <button
              onClick={() => onUse(selected)}
              className="mt-2 w-full flex items-center justify-center gap-2 bg-[#354F99] hover:bg-[#1a2d5a] text-white text-sm font-semibold py-3 rounded-xl transition-colors shadow-sm"
            >
              Utiliser ce modèle
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Aperçu générique */}
          <div className="lg:col-span-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">
              Aperçu — {docType.label}
            </p>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4 flex items-center gap-3">
                <div className="w-8 h-10 bg-white/10 rounded flex items-center justify-center shrink-0">
                  <docType.Icon className="w-4 h-4 text-white/80" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">Contrat de travail</p>
                  <p className="text-sm font-bold text-white mt-0.5">{preview.title}</p>
                </div>
              </div>
              <div className="px-6 py-5 space-y-4 min-h-[220px]">
                {preview.articles.map((a, i) => (
                  <div key={i} className="space-y-1.5">
                    <p className="text-xs font-bold text-gray-700">{a.heading}</p>
                    <p className="text-[11.5px] text-gray-500 leading-relaxed">{a.body}</p>
                  </div>
                ))}
                <div className="space-y-2 pt-1 opacity-25">
                  <div className="h-2 bg-gray-200 rounded w-2/3" />
                  <div className="h-2 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[10px] text-gray-400">Variables détectées : champs à remplir</span>
                <span className="text-[10px] font-semibold text-[#354F99]">Conforme Code du travail 2024</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PERSONNALISÉS */}
      {tab === "custom" && (
        <>
          {loadingList ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-[#354F99] animate-spin" />
            </div>
          ) : customList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                <FileText className="w-7 h-7 text-gray-300 stroke-[1.5]" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-700">Aucun modèle personnalisé</p>
                <p className="text-xs text-gray-400 max-w-sm">
                  Importez un document depuis l'onglet "Importer un modèle" pour créer votre premier modèle personnalisé.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Liste */}
              <div className="lg:col-span-2 flex flex-col gap-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1 px-1">
                  Vos modèles ({customList.length})
                </p>
                {customList.map((t) => (
                  <div
                    key={t.id}
                    className={`group relative flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all duration-150 ${
                      customSelected === t.id
                        ? "border-[#354F99] bg-[#354F99]/5 shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60"
                    }`}
                  >
                    <button
                      onClick={() => setCustomSelected(t.id)}
                      className="absolute inset-0 rounded-xl"
                      aria-label={`Sélectionner ${t.name}`}
                    />
                    <div className={`relative w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors pointer-events-none ${
                      customSelected === t.id ? "bg-[#354F99] text-white" : "bg-gray-100 text-gray-400 group-hover:bg-gray-200"
                    }`}>
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="relative min-w-0 flex-1 pointer-events-none">
                      <p className={`text-sm font-semibold truncate ${customSelected === t.id ? "text-[#354F99]" : "text-gray-700"}`}>
                        {t.name}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {t.contractType ?? "Modèle personnalisé"} · v{t.version}
                      </p>
                    </div>
                    {customSelected === t.id && <CheckCircle2 className="relative w-4 h-4 text-[#354F99] shrink-0 pointer-events-none" />}
                    {/* Bouton suppression */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(t); }}
                      title="Supprimer ce modèle"
                      className="relative z-10 p-1.5 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Aperçu personnalisé */}
              <div className="lg:col-span-3">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">
                  Aperçu {customMeta ? `— ${customMeta.name}` : ""}
                </p>
                {loadingDetail ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-12 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-[#354F99] animate-spin" />
                  </div>
                ) : customDetail && customMeta ? (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center gap-3">
                      <div className="w-8 h-10 bg-white/10 rounded flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-white/80" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold text-white/60 uppercase tracking-widest">
                          {customMeta.contractType ?? "Personnalisé"}
                        </p>
                        <p className="text-sm font-bold text-white mt-0.5 truncate">{customMeta.name}</p>
                      </div>
                    </div>
                    <div className="px-6 py-5 space-y-3 max-h-[400px] overflow-y-auto">
                      {customDetail.sections.slice(0, 4).map((sec, i) => (
                        <div key={i} className="space-y-1">
                          <p className="text-xs font-bold text-gray-700">{sec.title}</p>
                          <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">
                            {sec.clauses[0]?.content ?? ""}
                          </p>
                        </div>
                      ))}
                      {customDetail.sections.length > 4 && (
                        <p className="text-[10px] text-gray-400 italic">… et {customDetail.sections.length - 4} autres sections</p>
                      )}
                    </div>
                    <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">
                        {customDetail.sections.length} sections · {customDetail.detectedVariables.length} variables
                      </span>
                      <span className="text-[10px] font-semibold text-indigo-600">Modèle personnalisé</span>
                    </div>
                  </div>
                ) : null}

                {customMeta && customDetail && (
                  <button
                    onClick={() => onUseCustom(customMeta.id)}
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-[#354F99] hover:bg-[#1a2d5a] text-white text-sm font-semibold py-3 rounded-xl transition-colors shadow-sm"
                  >
                    <Sparkles className="w-4 h-4" />
                    Utiliser ce modèle
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modale de confirmation suppression */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => !deleting && setDeleteTarget(null)}
          style={{ animation: "fadeIn 0.15s ease-out" }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "scaleIn 0.2s ease-out" }}
          >
            <div className="flex items-start gap-4 p-6">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-red-500 stroke-[1.5]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-900">Supprimer ce modèle ?</h3>
                <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                  Vous êtes sur le point de supprimer définitivement <span className="font-semibold text-gray-700">{deleteTarget.name}</span>. Cette action est irréversible.
                </p>
              </div>
              <button
                onClick={() => !deleting && setDeleteTarget(null)}
                className="text-gray-300 hover:text-gray-500 transition-colors"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </div>
          </div>

          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scaleIn {
              from { opacity: 0; transform: scale(0.92); }
              to   { opacity: 1; transform: scale(1); }
            }
          `}</style>
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
  // <<NAME|original>> — texte original conservé
  // <<NAME>>          — variante sans pipe (IA paresseuse) → fallback humanisé
  // {{NAME}}          — legacy → fallback humanisé
  const re = /<<([A-Z0-9_]+)\|([\s\S]*?)>>|<<([A-Z0-9_]+)>>|\{\{([A-Z0-9_]+)\}\}/g;
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
  for (const sec of structure.sections) {
    for (const cl of sec.clauses) {
      const tokens = tokenizeContent(cl.content);
      for (const t of tokens) if (t.type === "var") set.add(t.name);
    }
  }
  return Array.from(set);
}

/** Extrait pour chaque variable son texte original (premier vu). Utile pour pré-remplir. */
function extractVariableOriginals(structure: TemplateStructure): Record<string, string> {
  const map: Record<string, string> = {};
  for (const sec of structure.sections) {
    for (const cl of sec.clauses) {
      const tokens = tokenizeContent(cl.content);
      for (const t of tokens) {
        if (t.type === "var" && !map[t.name]) map[t.name] = t.text;
      }
    }
  }
  return map;
}

/**
 * Strippe les marqueurs des variables non-essentielles dans un contenu.
 * <<NAME|original>> où NAME n'est pas essentiel → original (texte brut conservé).
 */
function filterMarkersInContent(content: string, essential: Set<string>): string {
  return content.replace(/<<([A-Z0-9_]+)\|([\s\S]*?)>>/g, (_match, name: string, text: string) => {
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
    <div className="bg-white border border-gray-200 rounded-xl px-8 py-7 shadow-sm">
      <div className="space-y-6">
        {structure.sections.map((sec, si) => (
          <section key={si} className="space-y-3">
            <h4 className="text-[13px] font-bold text-gray-800 tracking-tight">{sec.title}</h4>
            <div className="space-y-3">
              {sec.clauses.map((cl) => {
                const tokens = tokenizeContent(cl.content);
                return (
                  <div key={cl.id} className="space-y-1.5">
                    {cl.title && (
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{cl.title}</p>
                    )}
                    <p className="text-[13px] text-gray-700 leading-relaxed">
                      {tokens.map((t, i) => {
                        if (t.type === "text") return <span key={i}>{t.value}</span>;
                        const isEssential = essentialVars.has(t.name);
                        return (
                          <button
                            key={i}
                            onClick={() => onToggleVar(t.name)}
                            title={isEssential ? `Variable « ${humanizeVar(t.name)} » — cliquez pour la désélectionner` : `Variable « ${humanizeVar(t.name)} » désélectionnée — cliquez pour la sélectionner`}
                            className={`inline align-baseline mx-[1px] px-1 py-[1px] rounded text-[13px] transition-all border-2 ${
                              isEssential
                                ? "bg-emerald-50 text-emerald-900 border-emerald-400 border-dashed hover:bg-emerald-100 font-medium"
                                : "bg-transparent text-gray-400 border-transparent line-through hover:text-gray-600"
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
            {si < structure.sections.length - 1 && (
              <div className="pt-2 border-b border-gray-100" />
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
  const [contractType, setContractType] = useState("");
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
          contractType: contractType.trim() || undefined,
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
      if (detail.success && detail.data) {
        setStructure(detail.data.structure);
        // Par défaut, TOUTES les variables présentes dans le contenu sont pré-sélectionnées.
        // On extrait depuis le contenu réel (et pas uniquement detectedVariables qui peut être incomplet).
        const allVars = extractAllVariables(detail.data.structure);
        setEssentialVars(new Set(allVars));
      }
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
        <div className="w-16 h-16 rounded-2xl bg-[#354F99]/10 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-[#354F99] animate-spin stroke-[1.5]" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-bold text-gray-800">Analyse en cours…</p>
          <p className="text-xs text-gray-400">Extraction du texte puis structuration par IA. Cela peut prendre 30 à 60 secondes.</p>
        </div>
        <div className="flex gap-1.5">
          {["Extraction du document", "Structuration AI", "Sauvegarde"].map((s, i) => (
            <span key={i} className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">{s}</span>
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
          <div className="w-20 h-20 rounded-2xl bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 stroke-[1.5]" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-gray-800">Modèle sauvegardé !</h3>
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-700">{savedMeta.name}</span> est maintenant disponible dans votre bibliothèque personnalisée.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setStep("form"); setFile(null); setName(""); setContractType("");
                setSavedMeta(null); setStructure(null); setEssentialVars(new Set()); setSaved(false);
              }}
              className="px-5 py-2.5 text-sm font-semibold text-[#354F99] bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
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
            <span className="text-gray-500">
              <span className="font-bold text-gray-800">{totalVars}</span> variables détectées
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-emerald-700">
              <span className="font-bold">{essentialCount}</span> sélectionnée{essentialCount > 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-gray-400">
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
              setStep("form"); setFile(null); setName(""); setContractType(""); setAiHints("");
              setSavedMeta(null); setStructure(null); setEssentialVars(new Set());
            }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
          >
            Annuler
          </button>
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Secondaire : enregistrer seulement */}
            <button
              onClick={() => void handleSaveStructure(false)}
              disabled={saving || essentialCount === 0}
              className="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-[#354F99] bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Enregistrer le modèle
            </button>
            {/* Primaire : enregistrer + poursuivre le tunnel de génération */}
            <button
              onClick={() => void handleSaveStructure(true)}
              disabled={saving || essentialCount === 0}
              className="flex items-center gap-2 px-6 py-3 bg-[#354F99] text-white text-sm font-semibold rounded-xl hover:bg-[#1a2d5a] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
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
    <div className="space-y-5 max-w-2xl">
      <div className="flex gap-2">
        {["PDF", "DOC", "DOCX"].map((ext) => (
          <span key={ext} className="text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-lg">.{ext}</span>
        ))}
      </div>

      {/* Zone de dépôt — react-dropzone (clic + drag) */}
      <div
        {...getRootProps()}
        className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-200 cursor-pointer ${
          isDragActive ? "border-emerald-400 bg-emerald-50 scale-[1.01]"
          : file ? "border-emerald-300 bg-emerald-50/40"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/40"
        }`}
      >
        <input {...getInputProps()} />
        {file ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 stroke-[1.5]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{file.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024).toFixed(0)} Ko · prêt à analyser</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors underline underline-offset-2"
            >
              Changer de fichier
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center ${isDragActive ? "bg-emerald-100 border-emerald-200" : "bg-gray-50 border-gray-100"}`}>
              <UploadCloud className={`w-7 h-7 stroke-[1.5] ${isDragActive ? "text-emerald-500" : "text-gray-400"}`} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-700">Glissez-déposez votre document ici</p>
              <p className="text-xs text-gray-400">ou cliquez pour parcourir vos fichiers</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-full">
              <Lock className="h-3 w-3" />
              Traitement confidentiel — données chiffrées
            </div>
          </div>
        )}
      </div>

      {/* Champs nom + type */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Nom du modèle *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. NDA Inserm Transfert"
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#354F99]/50 focus:bg-white focus:ring-2 focus:ring-[#354F99]/10 transition"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Type de contrat</label>
          <input
            value={contractType}
            onChange={(e) => setContractType(e.target.value)}
            placeholder="ex. NDA, CDI, Prestation…"
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#354F99]/50 focus:bg-white focus:ring-2 focus:ring-[#354F99]/10 transition"
          />
        </div>
      </div>

      {/* Indications pour l'IA */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
            Indications pour l'analyse <span className="text-gray-300 normal-case">(optionnel)</span>
          </label>
          <span className="text-[10px] text-gray-400">{aiHints.length}/500</span>
        </div>
        <textarea
          value={aiHints}
          onChange={(e) => setAiHints(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="ex. Ce contrat concerne une cession de droits de propriété intellectuelle. Identifie comme variables : les noms des parties, les dates, les montants, la description de l'invention…"
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-[#354F99]/50 focus:bg-white focus:ring-2 focus:ring-[#354F99]/10 transition resize-none leading-relaxed"
        />
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Aide l'IA à mieux identifier les variables à détecter (contexte, types d'informations à personnaliser).
        </p>
      </div>

      {/* Erreur */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* CTA */}
      <button
        disabled={!file || !name.trim()}
        onClick={handleImport}
        className="w-full flex items-center justify-center gap-2 bg-[#354F99] hover:bg-[#1a2d5a] text-white text-sm font-semibold py-3.5 rounded-xl transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Sparkles className="w-4 h-4" />
        Analyser et créer le modèle
      </button>
    </div>
  );
}

// ─── Flow d'utilisation d'un modèle personnalisé ─────────────────────────────

type UseStep = "vars" | "playbook" | "generating" | "result";

function UseCustomTemplateFlow({
  templateId,
  onBack,
}: {
  templateId: string;
  onBack: () => void;
}) {
  const [step, setStep] = useState<UseStep>("vars");
  const [meta, setMeta] = useState<ContractTemplateDTO | null>(null);
  const [structure, setStructure] = useState<TemplateStructure | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [varOriginals, setVarOriginals] = useState<Record<string, string>>({});
  const [prefilled, setPrefilled] = useState<Set<string>>(new Set());
  const [playbookText, setPlaybookText] = useState("");
  const [savingPlaybook, setSavingPlaybook] = useState(false);
  const [playbookSaved, setPlaybookSaved] = useState(false);
  // Sélecteur de clauses depuis la bibliothèque (chantier 1 → alimente la génération)
  const [showClausePicker, setShowClausePicker] = useState(false);
  const [libraryClauses, setLibraryClauses] = useState<Clause[]>([]);
  const [loadingClauses, setLoadingClauses] = useState(false);
  const [clauseSearch, setClauseSearch] = useState("");
  const [generated, setGenerated] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Chargement initial : structure + playbook
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const tplRes = await fetchProxy(`/api/template/${templateId}`, { credentials: "include" });
        const tplData = await tplRes.json() as {
          success: boolean;
          data?: { meta: ContractTemplateDTO; structure: TemplateStructure };
        };
        if (!cancelled && tplData.success && tplData.data) {
          setMeta(tplData.data.meta);
          setStructure(tplData.data.structure);
          // Initialise varValues avec les variables réellement présentes.
          // Pré-remplit avec les valeurs connues (localStorage) OU le texte original.
          const presentVars = extractAllVariables(tplData.data.structure);
          const originals = extractVariableOriginals(tplData.data.structure);
          const known = loadKnownVars();
          const initial: Record<string, string> = {};
          const filled = new Set<string>();
          presentVars.forEach((v) => {
            if (known[v]) {
              initial[v] = known[v];
              filled.add(v);
            } else {
              initial[v] = "";
            }
          });
          setVarValues(initial);
          setVarOriginals(originals);
          setPrefilled(filled);
        }

        const pbRes = await fetchProxy(`/api/template/${templateId}/playbook`, { credentials: "include" });
        const pbData = await pbRes.json() as { success: boolean; data?: { rulesText: string } | null };
        if (!cancelled && pbData.success && pbData.data) {
          setPlaybookText(pbData.data.rulesText);
        }
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [templateId]);

  async function openClausePicker() {
    setShowClausePicker(true);
    if (libraryClauses.length === 0) {
      setLoadingClauses(true);
      try {
        const list = await clauseApi.list({ onlyApproved: false });
        setLibraryClauses(list);
      } catch { /* silent */ }
      finally { setLoadingClauses(false); }
    }
  }

  /** Insère une clause de la bibliothèque dans les consignes. */
  function insertClause(c: Clause) {
    const header = `\n\n— Clause « ${c.title} » (${CATEGORY_LABEL[c.category]}, ${POSITION_LABEL[c.position]}) à intégrer :\n`;
    setPlaybookText((prev) => (prev.trimEnd() + header + c.body).trim());
    setShowClausePicker(false);
    setClauseSearch("");
  }

  async function handleSavePlaybook() {
    setSavingPlaybook(true);
    setPlaybookSaved(false);
    try {
      await fetchProxy(`/api/template/${templateId}/playbook`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rulesText: playbookText }),
      });
      setPlaybookSaved(true);
      setTimeout(() => setPlaybookSaved(false), 2000);
    } catch { /* silent */ }
    finally { setSavingPlaybook(false); }
  }

  async function handleGenerate() {
    setStep("generating");
    setError("");
    // Mémorise les valeurs saisies pour pré-remplir les prochaines générations
    saveKnownVars(varValues);
    // Auto-sauvegarde des consignes (persistance) — non bloquant si échec.
    try {
      await fetchProxy(`/api/template/${templateId}/playbook`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rulesText: playbookText }),
      });
    } catch { /* non bloquant : les consignes sont aussi envoyées dans le payload ci-dessous */ }
    try {
      const res = await fetchProxy(`/api/template/${templateId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // On envoie les consignes en direct → prise en compte immédiate, même non sauvegardées.
        body: JSON.stringify({ variables: varValues, playbook: playbookText }),
      });
      const data = await res.json() as { success: boolean; content?: string; message?: string };
      if (data.success && data.content) {
        setGenerated(data.content);
        setStep("result");
      } else {
        setError(data.message || "Erreur lors de la génération.");
        setStep("playbook");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
      setStep("playbook");
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(generated).catch(() => { /* silent */ });
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleDownloadTxt() {
    const blob = new Blob([generated], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${meta?.name ?? "contrat"}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#354F99] animate-spin" />
      </div>
    );
  }

  if (!structure || !meta) {
    return (
      <div className="text-sm text-gray-500">Modèle introuvable.</div>
    );
  }

  const varNames = Object.keys(varValues);
  const allVarsFilled = varNames.length > 0 && varNames.every((k) => varValues[k]?.trim());

  // Step indicator
  const STEPS = [
    { id: "vars", label: "Variables" },
    { id: "playbook", label: "Consignes" },
    { id: "result", label: "Contrat" },
  ];
  const currentStepIdx = step === "generating" ? 1 : STEPS.findIndex((s) => s.id === step);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header avec back */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#354F99] transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Bibliothèque
        </button>
        <span className="text-gray-300">·</span>
        <p className="text-sm font-semibold text-gray-800 truncate">{meta.name}</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const done = i < currentStepIdx;
          const active = i === currentStepIdx;
          return (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all ${
                  done ? "bg-emerald-500 border-emerald-500 text-white"
                  : active ? "bg-white border-[#354F99] text-[#354F99]"
                  : "bg-white border-gray-200 text-gray-300"
                }`}>
                  {done ? "✓" : i + 1}
                </div>
                <span className={`mt-1 text-[10px] font-medium ${done || active ? "text-gray-700" : "text-gray-400"}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${done ? "bg-emerald-500" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Erreur */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* STEP 1 — Variables */}
      {step === "vars" && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-gray-800 mb-1">Renseignez les valeurs</h3>
          <p className="text-xs text-gray-500 mb-5">
            Chaque variable du modèle sera remplacée par la valeur que vous saisissez.
          </p>

          {varNames.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Ce modèle ne contient aucune variable.</p>
          ) : (
            <>
              {prefilled.size > 0 && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <p className="text-[11px] text-amber-700">
                    <span className="font-semibold">{prefilled.size} champ{prefilled.size > 1 ? "s" : ""} pré-rempli{prefilled.size > 1 ? "s" : ""}</span> avec vos valeurs précédentes. Modifiez-les si besoin.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {varNames.map((name) => {
                  const isPrefilled = prefilled.has(name);
                  const original = varOriginals[name];
                  return (
                    <div key={name} className="flex flex-col gap-1">
                      <label className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                        {humanizeVar(name)}
                        {isPrefilled && (
                          <span title="Valeur pré-remplie depuis vos saisies précédentes" className="inline-flex items-center gap-0.5 text-amber-600 normal-case font-medium">
                            <Sparkles className="w-3 h-3" />
                          </span>
                        )}
                      </label>
                      <input
                        value={varValues[name] ?? ""}
                        onChange={(e) => {
                          setVarValues((p) => ({ ...p, [name]: e.target.value }));
                          if (isPrefilled) {
                            setPrefilled((p) => {
                              const next = new Set(p);
                              next.delete(name);
                              return next;
                            });
                          }
                        }}
                        placeholder={original || humanizeVar(name)}
                        className={`rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none focus:bg-white focus:ring-2 transition ${
                          isPrefilled
                            ? "border-amber-200 focus:border-amber-300 focus:ring-amber-50"
                            : "border-gray-200 focus:border-[#354F99]/50 focus:ring-[#354F99]/10"
                        }`}
                      />
                      {original && !isPrefilled && (
                        <p className="text-[10px] text-gray-400">
                          <span className="font-medium text-gray-500">Valeur d'origine :</span> {original}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex justify-end mt-6 pt-5 border-t border-gray-100">
            <button
              onClick={() => setStep("playbook")}
              disabled={varNames.length > 0 && !allVarsFilled}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#354F99] text-white text-sm font-semibold rounded-xl hover:bg-[#1a2d5a] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              Suivant — Consignes <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 — Consignes complémentaires */}
      {step === "playbook" && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-800">Consignes complémentaires</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-md">
                Règles, clauses spécifiques et précisions qui s'appliqueront à la génération.
                Ce texte est <strong>conservé</strong> et réutilisé à chaque nouvelle génération de ce modèle.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={openClausePicker}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#354F99] bg-[#354F99]/5 border border-[#354F99]/20 rounded-lg hover:bg-[#354F99]/10 transition-colors"
              >
                <ScrollText className="w-3.5 h-3.5" /> Insérer une clause
              </button>
              <button
                onClick={handleSavePlaybook}
                disabled={savingPlaybook}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#354F99] bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {savingPlaybook ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : playbookSaved ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : null}
                {playbookSaved ? "Enregistré" : "Enregistrer les consignes"}
              </button>
            </div>
          </div>

          {/* Sélecteur de clauses de la bibliothèque */}
          {showClausePicker && (
            <div className="mb-4 rounded-xl border border-[#354F99]/20 bg-[#354F99]/[0.03] p-3">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5">
                  <ScrollText className="w-3.5 h-3.5 text-[#354F99]" />
                  <span className="text-xs font-bold text-gray-700">Bibliothèque de clauses</span>
                </div>
                <button onClick={() => setShowClausePicker(false)} className="p-1 rounded-md text-gray-400 hover:bg-gray-100">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                value={clauseSearch}
                onChange={(e) => setClauseSearch(e.target.value)}
                placeholder="Filtrer par intitulé, catégorie, tag…"
                className="w-full mb-2.5 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-[#354F99]/40"
              />
              {loadingClauses ? (
                <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
              ) : libraryClauses.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-4 text-center">
                  Aucune clause dans la bibliothèque. Créez-en depuis le menu « Bibliothèque de clauses ».
                </p>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-1.5">
                  {libraryClauses
                    .filter((c) => {
                      const q = clauseSearch.trim().toLowerCase();
                      if (!q) return true;
                      return c.title.toLowerCase().includes(q)
                        || CATEGORY_LABEL[c.category].toLowerCase().includes(q)
                        || c.tags.some((t) => t.toLowerCase().includes(q));
                    })
                    .map((c) => (
                      <button
                        key={c.id}
                        onClick={() => insertClause(c)}
                        className="w-full text-left rounded-lg border border-gray-200 bg-white p-2.5 hover:border-[#354F99]/40 hover:bg-[#354F99]/[0.02] transition-all group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-800 group-hover:text-[#354F99]">{c.title}</span>
                          {c.isApproved && <ShieldCheck className="w-3 h-3 text-emerald-500" />}
                          <Plus className="w-3 h-3 text-gray-300 ml-auto group-hover:text-[#354F99]" />
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">{CATEGORY_LABEL[c.category]} · {POSITION_LABEL[c.position]}</p>
                        <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{c.body}</p>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          <textarea
            value={playbookText}
            onChange={(e) => setPlaybookText(e.target.value)}
            rows={12}
            placeholder={`ex.\n- Toujours mentionner la juridiction du Tribunal de commerce de Paris.\n- Adapter le ton selon le statut de la partie réceptrice.\n- Inclure systématiquement une clause de confidentialité de 5 ans après la fin de l'accord.`}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-[#354F99]/50 focus:bg-white focus:ring-2 focus:ring-[#354F99]/10 transition resize-none leading-relaxed font-mono"
          />
          <p className="text-[11px] text-gray-400 mt-1.5">
            Ces consignes et clauses spécifiques sont <strong>prioritaires</strong> : l'IA les intègre intégralement, même si elles ne figurent pas dans le modèle. Prises en compte immédiatement, même sans cliquer « Enregistrer ».
          </p>

          <div className="flex justify-between mt-6 pt-5 border-t border-gray-100">
            <button
              onClick={() => setStep("vars")}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Précédent
            </button>
            <button
              onClick={handleGenerate}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#354F99] text-white text-sm font-semibold rounded-xl hover:bg-[#1a2d5a] transition-all shadow-sm"
            >
              <Sparkles className="w-4 h-4" /> Générer le contrat
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — Génération en cours */}
      {step === "generating" && (
        <div className="bg-white border border-gray-200 rounded-xl p-12 shadow-sm">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#354F99]/10 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-[#354F99] animate-spin stroke-[1.5]" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-bold text-gray-800">Génération en cours…</p>
              <p className="text-xs text-gray-400 max-w-sm">
                L'IA assemble votre contrat en intégrant les variables et le playbook. Cela peut prendre 30 à 90 secondes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4 — Résultat */}
      {step === "result" && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/60">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <p className="text-sm font-semibold text-gray-700">Contrat généré</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : null}
                {copied ? "Copié" : "Copier"}
              </button>
              <button
                onClick={handleDownloadTxt}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#354F99] rounded-lg hover:bg-[#1a2d5a] transition-colors"
              >
                Télécharger
              </button>
            </div>
          </div>
          <pre className="px-6 py-5 text-[13px] text-gray-800 leading-relaxed whitespace-pre-wrap font-sans max-h-[600px] overflow-y-auto">
            {generated}
          </pre>
          <div className="flex justify-between items-center px-5 py-3 border-t border-gray-100 bg-gray-50/60">
            <button
              onClick={() => setStep("vars")}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
            >
              Modifier les variables
            </button>
            <button
              onClick={() => { setStep("playbook"); }}
              className="text-xs text-[#354F99] hover:underline font-medium"
            >
              Régénérer avec d'autres consignes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function Generateur() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [section, setSection]     = useState<Section>(null);
  const [formDocId, setFormDocId] = useState<DocId>("cdi");
  const [useTemplateId, setUseTemplateId] = useState<string | null>(null);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const notifyAdded = useTemplateNotificationStore((s) => s.notifyAdded);

  // Synchronise la section avec l'URL (?section=library|import)
  useEffect(() => {
    const s = searchParams.get("section");
    if (s === "library" || s === "import") setSection(s);
    else setSection(null);
  }, [searchParams]);

  function handleUseModel(id: DocId) {
    setFormDocId(id);
    setSection("form");
  }

  function handleUseCustomTemplate(externalId: string) {
    setUseTemplateId(externalId);
    setSection("useCustom");
  }

  function handleTemplateSaved(templateId: string, andContinue: boolean) {
    setLibraryRefreshKey((k) => k + 1);
    // Animation "+1" sur Bibliothèque de modèles dans les deux cas (le modèle est bien enregistré).
    notifyAdded();
    if (andContinue) {
      // Tunnel continu : on enchaîne directement sur la génération du contrat,
      // sans repasser par la bibliothèque.
      setUseTemplateId(templateId);
      setSection("useCustom");
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
  };

  const SUBS: Record<Exclude<Section, null>, string> = {
    library:   "Vos modèles génériques et personnalisés.",
    import:    "Importez un contrat existant pour le transformer en modèle réutilisable.",
    form:      "Renseignez les informations pour personnaliser votre contrat.",
    useCustom: "Renseignez les variables et le playbook pour générer le contrat.",
  };

  function goHub() {
    setSearchParams({});
    setSection(null);
  }

  return (
    <div className="space-y-8 max-w-5xl">

      {/* En-tête */}
      <div>
        {section && (
          <button
            onClick={() => {
              if (section === "form") setSection("library");
              else goHub();
            }}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-[#354F99] transition-colors mb-2 font-medium"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            {section === "form" ? "Bibliothèque de modèles" : "Générateur de modèles"}
          </button>
        )}
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          {section ? LABELS[section] : "Générateur de modèles"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {section ? SUBS[section] : "Accédez à vos modèles ou importez-en un nouveau."}
        </p>
      </div>

      {/* Hub — 2 cartes */}
      {!section && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
          {/* Bibliothèque de modèles */}
          <button
            onClick={() => setSearchParams({ section: "library" })}
            className="group relative flex flex-col gap-5 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-[#354F99]/30 transition-all duration-200 text-left active:scale-[0.99] overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-[#354F99] rounded-t-2xl" />
            <div className="w-12 h-12 rounded-xl bg-[#354F99]/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-[#354F99] stroke-[1.5]" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-bold text-gray-900">Bibliothèque de modèles</p>
              <p className="text-xs text-gray-500 leading-relaxed">CDI, CDD, avenants, lettres disciplinaires — et vos modèles personnalisés. Prêts à l'emploi.</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#354F99] mt-auto">
              Accéder <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Importer */}
          <button
            onClick={() => setSearchParams({ section: "import" })}
            className="group relative flex flex-col gap-5 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-emerald-300 transition-all duration-200 text-left active:scale-[0.99] overflow-hidden"
          >
            <div className="absolute inset-x-0 top-0 h-0.5 bg-emerald-500 rounded-t-2xl" />
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Upload className="w-5 h-5 text-emerald-600 stroke-[1.5]" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-bold text-gray-900">Importer un modèle</p>
              <p className="text-xs text-gray-500 leading-relaxed">Importez un document existant (PDF, Word) pour le modifier, personnaliser et réutiliser.</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 mt-auto">
              Importer <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
      )}

      {/* Sous-sections */}
      {section === "library"   && <LibrarySection onUse={handleUseModel} onUseCustom={handleUseCustomTemplate} refreshKey={libraryRefreshKey} />}
      {section === "import"    && <ImportSection onSaved={handleTemplateSaved} />}
      {section === "form"      && <FormSection docId={formDocId} onBack={() => setSection("library")} />}
      {section === "useCustom" && useTemplateId && (
        <UseCustomTemplateFlow
          templateId={useTemplateId}
          onBack={() => { setUseTemplateId(null); setSearchParams({ section: "library" }); }}
        />
      )}
    </div>
  );
}
