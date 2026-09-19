import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, Check, ExternalLink, Loader2, X } from "lucide-react";
import { contractApi } from "./api";
import type { ExtractedField } from "./types";
import { ConfirmationModal } from "../../ui/ConfirmationModal";
import { ContractTextPreview } from "./ContractTextPreview";
import { ImportReviewPanel } from "./ImportReviewPanel";
import type { FieldChanges } from "./FieldReviewList";
import {
  applyDeductions, buildReviewFields, buildSearchTerms, countFieldsToHandle,
  suggestTitle, titleFromFileName, toContractColumns, toMetadataPayload,
} from "./importReview";
import type { ReviewField } from "./importReview";

interface Props {
  /** Fichiers déjà choisis par l'utilisateur ; la lecture démarre dessus. */
  files: File[];
  /** Appelé après l'enregistrement, avec les identifiants des contrats créés. */
  onDone: (savedContractIds: string[]) => void;
  onCancel: () => void;
}

/**
 * Un fichier en cours d'import. L'import se fait en deux temps : le texte
 * arrive vite et s'affiche aussitôt, l'analyse IA arrive après et remplit les
 * champs.
 */
interface ImportItem {
  /**
   * Identifiant stable : l'utilisateur peut retirer un document du lot, donc la
   * position dans la liste ne permet pas de retrouver un document de façon sûre.
   */
  id: string;
  file: File;
  textStatus: "waiting" | "loading" | "ready" | "error";
  aiStatus: "waiting" | "running" | "ready" | "error";
  /** Message de l'étape qui a échoué. */
  error?: string;
  ocrText: string;
  title: string;
  /** L'utilisateur a modifié l'intitulé : on ne le remplace plus automatiquement. */
  titleEditedByUser: boolean;
  fields: ReviewField[];
  /** Contrat existant portant déjà ce nom (simple avertissement, non bloquant). */
  duplicate: { id: string; title: string } | null;
  /** Rempli dès l'enregistrement : évite de créer un doublon si on relance après une erreur. */
  savedContractId: string | null;
}

/**
 * Import d'un ou plusieurs contrats, en un seul écran :
 *   - à gauche le contrat, cœur de l'écran, affiché dès la lecture du texte ;
 *   - à droite les informations extraites, rangées par ce qu'il reste à faire.
 *
 * Règle produit : tout ce qui peut être déduit sans décision de l'utilisateur
 * est fait automatiquement (intitulé proposé, dates calculées, passage au
 * document suivant, retour à la contrathèque après l'enregistrement).
 * Rien n'est écrit en base avant le clic sur « Enregistrer ».
 */
export function ImportWizard({ files, onDone, onCancel }: Props) {
  const [items, setItems] = useState<ImportItem[]>(() => files.map(toImportItem));
  const [activeId, setActiveId] = useState<string>(() => items[0]?.id ?? "");
  const [highlightTerms, setHighlightTerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  // Copie toujours à jour des items, lisible depuis les fonctions asynchrones.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Évite de lancer l'import deux fois (React StrictMode monte le composant
  // deux fois en développement).
  const importStarted = useRef(false);
  useEffect(() => {
    if (importStarted.current) return;
    importStarted.current = true;
    void startImport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Modifie un seul document, retrouvé par son identifiant. Un document retiré
   * du lot pendant sa lecture ou son analyse n'est simplement plus modifié.
   */
  function patchItem(itemId: string, patch: Partial<ImportItem>) {
    setItems((previous) => previous.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  }

  // ── Lecture puis analyse ──────────────────────────────────────────────────
  async function startImport() {
    const readItems = await readAllTexts(itemsRef.current);
    for (const item of readItems) {
      if (item.textStatus === "ready") void checkDuplicate(item.id, item.title);
    }
    for (const item of readItems) {
      if (item.textStatus !== "ready") continue;
      // Document retiré du lot entre-temps : inutile de l'analyser.
      if (!itemsRef.current.some((current) => current.id === item.id)) continue;
      await analyseOne(item.id, item.ocrText);
    }
  }

  /** Étape 1 : texte de chaque document (rapide). */
  async function readAllTexts(list: ImportItem[]): Promise<ImportItem[]> {
    const result = [...list];
    for (let index = 0; index < result.length; index++) {
      const itemId = result[index].id;
      patchItem(itemId, { textStatus: "loading" });
      try {
        const response = await contractApi.extractText(result[index].file);
        result[index] = { ...result[index], textStatus: "ready", ocrText: response.ocr_text };
        patchItem(itemId, { textStatus: "ready", ocrText: response.ocr_text });
      } catch (err) {
        const message = errorMessage(err);
        result[index] = { ...result[index], textStatus: "error", aiStatus: "error", error: message };
        patchItem(itemId, { textStatus: "error", aiStatus: "error", error: message });
      }
    }
    return result;
  }

  /** Étape 2 : analyse IA d'un document (lente), avec un nouvel essai automatique. */
  async function analyseOne(itemId: string, ocrText: string) {
    patchItem(itemId, { aiStatus: "running", error: undefined });
    let extractedFields: ExtractedField[];
    try {
      extractedFields = await extractMetadataWithRetry(ocrText);
    } catch (err) {
      patchItem(itemId, { aiStatus: "error", error: errorMessage(err) });
      return;
    }

    const fields = buildReviewFields(extractedFields);
    const currentItem = itemsRef.current.find((item) => item.id === itemId);
    if (!currentItem) return;
    const newTitle = currentItem.titleEditedByUser ? currentItem.title : suggestTitle(fields) ?? currentItem.title;
    patchItem(itemId, { aiStatus: "ready", fields, title: newTitle });
    if (newTitle !== currentItem.title) void checkDuplicate(itemId, newTitle);
  }

  /** Cherche un contrat existant portant exactement le même nom. */
  async function checkDuplicate(itemId: string, title: string) {
    const normalizedTitle = title.trim().toLowerCase();
    if (!normalizedTitle) return;
    try {
      const result = await contractApi.list({ q: title.trim(), pageSize: 20 });
      const existing = result.items.find((contract) => contract.title.trim().toLowerCase() === normalizedTitle);
      patchItem(itemId, { duplicate: existing ? { id: existing.id, title: existing.title } : null });
    } catch (err) {
      // Mieux vaut un doublon possible qu'un import bloqué.
      console.error("Vérification des doublons impossible :", err);
    }
  }

  // ── Actions de l'utilisateur ──────────────────────────────────────────────
  function updateField(itemId: string, key: string, changes: FieldChanges) {
    setItems((previous) => previous.map((item) => {
      if (item.id !== itemId) return item;
      const updatedFields = item.fields.map((field) => (field.key === key ? { ...field, ...changes } : field));
      // Une nouvelle valeur peut permettre d'en déduire une autre (ex. durée → échéance).
      return { ...item, fields: applyDeductions(updatedFields) };
    }));
  }

  function selectItem(itemId: string) {
    setActiveId(itemId);
    setHighlightTerms([]);
  }

  /** Retire un document du lot (mauvais fichier glissé dans la sélection). */
  function removeItem(itemId: string) {
    const remainingItems = items.filter((item) => item.id !== itemId);
    if (remainingItems.length === 0) {
      onCancel();
      return;
    }
    setItems(remainingItems);
    if (itemId === activeId) selectItem(remainingItems[0].id);
  }

  /**
   * Document affiché. On retombe sur le premier document si l'identifiant actif
   * ne correspond à rien : c'est le cas au tout premier rendu en mode strict,
   * où React initialise l'état deux fois.
   */
  function currentItem(): ImportItem | undefined {
    const list = itemsRef.current;
    return list.find((item) => item.id === activeId) ?? list[0];
  }

  /**
   * Surligne dans le contrat la valeur du champ où l'utilisateur vient d'entrer.
   * Les termes sont figés à cet instant : les recalculer à chaque frappe ferait
   * défiler le contrat sans arrêt et redessinerait tout le document.
   */
  function showFieldInContract(key: string | null) {
    const field = key ? currentItem()?.fields.find((candidate) => candidate.key === key) : undefined;
    setHighlightTerms(field ? buildSearchTerms(field) : []);
  }

  /** Document terminé : on passe tout seul au suivant qui demande encore une action. */
  const goToNextItemNeedingAction = useCallback(() => {
    window.setTimeout(() => {
      const list = itemsRef.current;
      const currentIndex = Math.max(0, list.findIndex((item) => item.id === currentItem()?.id));
      for (let step = 1; step < list.length; step++) {
        const candidate = list[(currentIndex + step) % list.length];
        if (candidate.aiStatus === "ready" && countFieldsToHandle(candidate.fields) > 0) {
          setActiveId(candidate.id);
          setHighlightTerms([]);
          return;
        }
      }
    }, 600);
  }, [activeId]);

  function requestCancel() {
    const hasUserChanges = items.some((item) =>
      item.titleEditedByUser || item.fields.some((field) => field.confirmedByUser),
    );
    // Rien n'a été modifié : inutile de demander confirmation.
    if (hasUserChanges) setCancelModalOpen(true);
    else onCancel();
  }

  // ── Enregistrement ────────────────────────────────────────────────────────
  async function saveAll() {
    setSaving(true);
    setSaveError("");
    const savedContractIds: string[] = [];
    try {
      for (const item of items) {
        if (item.textStatus === "error") continue;
        if (item.savedContractId) {
          savedContractIds.push(item.savedContractId);
          continue;
        }
        const fileBase64 = await fileToBase64(item.file);
        const created = await contractApi.create({
          title: item.title.trim() || titleFromFileName(item.file.name),
          ocrText: item.ocrText,
          fileBase64,
          metadataFields: toMetadataPayload(item.fields),
          ...toContractColumns(item.fields),
        });
        savedContractIds.push(created.id);
        patchItem(item.id, { savedContractId: created.id });
      }
      onDone(savedContractIds);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Échec de l'enregistrement.");
      setSaving(false);
    }
  }

  // ── Valeurs dérivées pour l'affichage ─────────────────────────────────────
  const activeItem = items.find((item) => item.id === activeId) ?? items[0];
  const savableItems = items.filter((item) => item.textStatus !== "error");
  const analysisInProgress = savableItems.some((item) => item.aiStatus === "waiting" || item.aiStatus === "running");
  const fieldsToHandleCount = savableItems.reduce((total, item) => total + countFieldsToHandle(item.fields), 0);
  const notAnalysedItems = savableItems.filter((item) => item.aiStatus === "error");
  const hasSeveralFiles = items.length > 1;

  const saveLabel = savableItems.length > 1 ? `Enregistrer les ${savableItems.length} contrats` : "Enregistrer";

  const [showWarningDuplicate, setShowWarningDuplicate] = useState<boolean>(true)
  return (
    <div className="space-y-3 max-w-[1600px] mx-auto w-full">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 bg-blue-primary px-4 py-5 sm:px-8 sm:py-8 rounded-2xl mb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white leading-tight">
            Ajouter à la contrathèque
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Renseignez les données du contrat et enregistrer dans votre contrathèque
          </p>
        </div>
      </header>
      {/* En-tête : retour, intitulé modifiable, état, enregistrement */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={requestCancel}
          disabled={saving}
          className="shrink-0 p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors disabled:opacity-40"
          title="Retour à la contrathèque"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <input
          value={activeItem.title}
          onChange={(event) => patchItem(activeItem.id, { title: event.target.value, titleEditedByUser: true })}
          onBlur={() => void checkDuplicate(activeItem.id, activeItem.title)}
          aria-label="Intitulé du contrat"
          className="flex-1 min-w-[200px] text-xl font-bold text-ink tracking-tight bg-transparent border border-transparent hover:border-line focus:border-brand/40 rounded-lg px-2 py-1 outline-none transition-colors"
        />
        <div className="flex items-center gap-3 shrink-0">
          <SaveStatus analysisInProgress={analysisInProgress} fieldsToHandleCount={fieldsToHandleCount} />
          <button
            onClick={() => void saveAll()}
            disabled={saving || analysisInProgress || savableItems.length === 0}
            title={fieldsToHandleCount > 0 ? "Les champs restants pourront être complétés depuis la fiche du contrat." : undefined}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-hover disabled:opacity-50 transition-all shadow-card"
          >
            {saving || analysisInProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? "Enregistrement…" : saveLabel}
          </button>
        </div>
      </div>

      {hasSeveralFiles && (
        <div role="group" aria-label="Documents à importer" className="flex gap-1.5 overflow-x-auto pb-1">
          {items.map((item) => (
            <div
              key={item.id}
              className={`shrink-0 flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-lg border text-xs transition-colors ${item.id === activeItem.id ? "border-brand/40 bg-brand-light text-ink" : "border-line text-ink-secondary hover:bg-surface-subtle"
                }`}
            >
              <button
                onClick={() => selectItem(item.id)}
                aria-current={item.id === activeItem.id ? "true" : undefined}
                className="flex items-center gap-2 min-w-0 py-1"
              >
                <span className="max-w-[180px] truncate font-medium">{item.title}</span>
                <ItemStatusChip item={item} />
              </button>
              <button
                onClick={() => removeItem(item.id)}
                title="Retirer ce document de l'import"
                aria-label={`Retirer ${item.title} de l'import`}
                className="shrink-0 p-1 rounded text-ink-subtle hover:text-danger hover:bg-danger-light transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {notAnalysedItems.length > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-2 text-sm text-warning-dark bg-warning-light border border-warning/20 px-4 py-2.5 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            {notAnalysedItems.length > 1
              ? `${notAnalysedItems.length} documents n'ont pas pu être analysés : leur texte sera enregistré, sans aucune information extraite.`
              : `« ${notAnalysedItems[0].title} » n'a pas pu être analysé : son texte sera enregistré, sans aucune information extraite.`}
          </span>
        </div>
      )}

      {activeItem.duplicate && showWarningDuplicate && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-warning-dark bg-warning-light border border-warning/20 px-4 py-2.5 rounded-xl">
          <div role="status" className="flex gap-2 items-center">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Un contrat nommé « {activeItem.duplicate.title} » existe déjà dans votre contrathèque.</span>
            <a
              href={`/contratheque/${activeItem.duplicate.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
            >
              Voir le contrat existant <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <button
            onClick={() => setShowWarningDuplicate(false)}
          >
            <X />
          </button>
        </div>
      )}

      {saveError && (
        <div role="alert" className="flex items-center gap-2 text-sm text-danger-dark bg-danger-light border border-danger/20 px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
        </div>
      )}

      {/* Contrat (colonne large) + informations extraites. Chaque colonne défile seule. */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4 ${hasSeveralFiles ? "lg:h-[calc(100vh-15rem)]" : "lg:h-[calc(100vh-12rem)]"
          } lg:min-h-[520px]`}
      >
        <ContractTextPreview
          key={`preview-${activeItem.id}`}
          text={activeItem.ocrText}
          loading={activeItem.textStatus === "waiting" || activeItem.textStatus === "loading"}
          file={activeItem.file}
          highlightTerms={highlightTerms}
        />
        <div className="lg:overflow-y-auto lg:pr-1 pb-4">
          <ImportReviewPanel
            key={`review-${activeItem.id}`}
            fields={activeItem.fields}
            textStatus={activeItem.textStatus}
            aiStatus={activeItem.aiStatus}
            error={activeItem.error}
            onChangeField={(key, changes) => updateField(activeItem.id, key, changes)}
            onRetryAi={() => void analyseOne(activeItem.id, activeItem.ocrText)}
            onFocusField={showFieldInContract}
            onAllFieldsHandled={goToNextItemNeedingAction}
          />
        </div>
      </div>

      <ConfirmationModal
        open={cancelModalOpen}
        title="Abandonner l'import ?"
        description="Les corrections apportées seront perdues et aucun contrat ne sera enregistré."
        confirmLabel="Abandonner"
        confirmClassName="bg-danger text-white hover:bg-danger-dark"
        onConfirm={() => { setCancelModalOpen(false); onCancel(); }}
        onCancel={() => setCancelModalOpen(false)}
      />
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function SaveStatus({ analysisInProgress, fieldsToHandleCount }: { analysisInProgress: boolean; fieldsToHandleCount: number }) {
  if (analysisInProgress) {
    return <span className="text-xs text-ink-muted">Analyse en cours…</span>;
  }
  if (fieldsToHandleCount > 0) {
    return (
      <span className="text-xs font-medium text-warning">
        {fieldsToHandleCount} champ{fieldsToHandleCount > 1 ? "s" : ""} à traiter
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-success-dark">
      <Check className="w-3.5 h-3.5" /> Prêt
    </span>
  );
}

/** État d'un document dans la barre d'onglets (import de plusieurs fichiers). */
function ItemStatusChip({ item }: { item: ImportItem }) {
  if (item.textStatus === "error") return <span className="text-danger font-semibold">Illisible</span>;
  if (item.textStatus !== "ready") return <span className="text-ink-subtle">Lecture…</span>;
  if (item.aiStatus === "error") return <span className="text-danger font-semibold">Erreur</span>;
  if (item.aiStatus !== "ready") return <span className="text-ink-subtle">Analyse…</span>;

  const fieldsToHandle = countFieldsToHandle(item.fields);
  if (fieldsToHandle > 0) return <span className="text-warning font-semibold">{fieldsToHandle} à traiter</span>;
  return <span className="inline-flex items-center gap-0.5 text-success-dark font-semibold"><Check className="w-3 h-3" /> Prêt</span>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toImportItem(file: File): ImportItem {
  return {
    id: crypto.randomUUID(),
    file,
    textStatus: "waiting",
    aiStatus: "waiting",
    ocrText: "",
    title: titleFromFileName(file.name),
    titleEditedByUser: false,
    fields: [],
    duplicate: null,
    savedContractId: null,
  };
}

/** Un échec ponctuel de l'IA est fréquent : on retente une fois avant d'afficher l'erreur. */
async function extractMetadataWithRetry(ocrText: string): Promise<ExtractedField[]> {
  try {
    return await contractApi.extractMetadata(ocrText);
  } catch (firstError) {
    console.warn("Analyse IA échouée, nouvel essai :", firstError);
    return await contractApi.extractMetadata(ocrText);
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Échec";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(",")[1] ?? dataUrl);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
