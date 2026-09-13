import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { FieldOverlay } from "./FieldOverlay";
import type { Field, FieldType, Signer, SignerRole } from "./types";
import { DEFAULT_FIELD_SIZE } from "./types";

// Configure le worker pdf.js via le CDN cloudflare (évite la config Vite custom).
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface Props {
  file: File | null;
  fields: Field[];
  signers: Signer[];
  /**
   * - `place`   : armé → clic sur la page = dépose un nouveau champ (puis désarmement).
   * - `sign`    : clic sur un champ = onFieldClick (ouvre la modale de signature).
   * - `preview` : lecture seule.
   */
  mode: "place" | "sign" | "preview";
  /** Type de champ à déposer au prochain clic (mode "place"). null = pas de placement actif. */
  activeFieldType?: FieldType | null;
  activeSignerRole?: SignerRole;
  /** Si vrai, le champ ajouté sera répliqué sur toutes les pages (paraphes / signatures). */
  replicateAllPages?: boolean;
  onFieldAdd?: (field: Omit<Field, "id">) => void;
  onFieldMove?: (id: string, xPct: number, yPct: number) => void;
  onFieldRemove?: (id: string) => void;
  onFieldClick?: (field: Field) => void;
  /** Notifie le parent du nombre de pages dès le chargement du PDF. */
  onLoaded?: (numPages: number) => void;
  /**
   * Page affichée à l'ouverture du document : un index (0-based) ou "last"
   * pour la dernière page. Par défaut la première page.
   *
   * Les signatures se trouvent quasi toujours en fin de contrat : ouvrir
   * directement sur la dernière page évite à l'utilisateur de scroller pour
   * trouver l'endroit où intervenir.
   */
  initialPage?: number | "last";
  /**
   * Zone de signature proposée à l'utilisateur (mode "place") : affichée en
   * pointillés, elle n'est posée que s'il clique dessus. Rien n'est imposé —
   * il peut toujours cliquer ailleurs dans le document.
   */
  suggestedField?: Omit<Field, "id"> | null;
}

// Dimensions par défaut des champs (en pourcentage de la page)
// (le paraphe « initial » a été retiré du produit — seul « signature » subsiste)
const DEFAULT_SIZES: Record<FieldType, { width: number; height: number }> = {
  signature: { width: DEFAULT_FIELD_SIZE.widthPct, height: DEFAULT_FIELD_SIZE.heightPct },
};

/**
 * Viewer PDF (basé sur react-pdf) avec overlay de champs interactifs.
 *
 * Comportements selon `mode` :
 *  - `place`   : un click-to-place dépose un champ aux coordonnées du clic
 *                (centré sur le pointeur). Le champ est ensuite draggable.
 *  - `sign`    : clic sur un champ → onFieldClick (le parent ouvre la modale).
 *  - `preview` : pas d'interaction, simple affichage.
 *
 * Les coordonnées sont stockées en pourcentage de la page (0..1) ce qui
 * permet de garder le placement correct quelle que soit la largeur de
 * rendu (responsive / zoom).
 */
export function PdfViewer(props: Props) {
  const { file, fields, signers, mode, activeFieldType, activeSignerRole, replicateAllPages,
          onFieldAdd, onFieldMove, onFieldRemove, onFieldClick, onLoaded,
          initialPage, suggestedField } = props;

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Un glisser-déposer de l'emplacement suggéré se termine par un `click` sur
  // la page (mousedown sur le fantôme, mouseup ailleurs) : sans ce garde-fou,
  // une seconde zone serait posée au point de relâchement.
  const ignoreNextPageClick = useRef(false);
  const fileUrl = useObjectUrl(file);
  usePageWidthObserver(containerRef, setPageWidth);

  const isArmed = mode === "place" && !!activeFieldType && !!activeSignerRole;

  /**
   * Click sur une page : si la toolbar est armée, dépose un champ aux
   * coordonnées du clic (centré sur le pointeur), puis remonte l'event au
   * parent qui se charge de désarmer la toolbar.
   */
  const handlePageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (ignoreNextPageClick.current) {
      ignoreNextPageClick.current = false;
      return;
    }
    if (!isArmed || !activeFieldType || !activeSignerRole || !onFieldAdd) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const yPct = (e.clientY - rect.top) / rect.height;
    const { width, height } = DEFAULT_SIZES[activeFieldType];
    onFieldAdd({
      type: activeFieldType,
      signer: activeSignerRole,
      page: currentPage,
      xPct: clamp(xPct - width / 2, 0, 1 - width),
      yPct: clamp(yPct - height / 2, 0, 1 - height),
      widthPct: width,
      heightPct: height,
      replicateAllPages: !!replicateAllPages,
    });
  }, [isArmed, activeFieldType, activeSignerRole, currentPage, onFieldAdd, replicateAllPages]);

  function handleDocumentLoad({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setCurrentPage(resolveInitialPage(initialPage, numPages));
    onLoaded?.(numPages);
  }

  if (!fileUrl) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
        Aucun document chargé
      </div>
    );
  }

  const visibleFields = filterFieldsForPage(fields, currentPage);
  // La suggestion n'est affichée que sur sa page et seulement en placement.
  const visibleSuggestion =
    isArmed && suggestedField && suggestedField.page === currentPage ? suggestedField : null;

  return (
    <div className="flex flex-col items-center" ref={containerRef}>
      {numPages > 1 && (
        <PageNavigator
          current={currentPage}
          total={numPages}
          onChange={setCurrentPage}
        />
      )}

      <div
        className={`relative shadow-lg ring-1 ring-gray-200 rounded-md overflow-hidden bg-white ${isArmed ? "cursor-crosshair" : ""}`}
        onClick={handlePageClick}
      >
        <Document
          file={fileUrl}
          onLoadSuccess={handleDocumentLoad}
          loading={<div className="flex items-center justify-center h-96"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>}
        >
          <Page
            pageNumber={currentPage + 1}
            width={pageWidth || 680}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        </Document>

        {visibleSuggestion && (
          <SuggestedZone
            field={visibleSuggestion}
            hex={(signers.find((s) => s.role === visibleSuggestion.signer) ?? signers[0])?.hex ?? "#4f46e5"}
            onPlace={(xPct, yPct) => onFieldAdd?.({ ...visibleSuggestion, xPct, yPct })}
            onDragEnd={() => {
              // Le `click` qui suit le relâchement part dans la foulée : on
              // désarme au tour de boucle suivant, pour ne jamais avaler le
              // clic d'après si le relâchement a eu lieu hors du document.
              ignoreNextPageClick.current = true;
              window.setTimeout(() => { ignoreNextPageClick.current = false; }, 0);
            }}
          />
        )}

        {visibleFields.map((f) => {
          const signer = signers.find((s) => s.role === f.signer) ?? signers[0];
          return (
            <FieldOverlay
              key={`${f.id}-${currentPage}`}
              field={f}
              signer={signer}
              mode={mode}
              onMove={(xPct, yPct) => onFieldMove?.(f.id, xPct, yPct)}
              onRemove={() => onFieldRemove?.(f.id)}
              onClick={() => onFieldClick?.(f)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

/** Bouton suivant/précédent + indicateur "Page X / Y". */
function PageNavigator({
  current, total, onChange,
}: {
  current: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <button
        onClick={() => onChange(Math.max(0, current - 1))}
        disabled={current === 0}
        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-xs font-semibold text-gray-600">
        Page {current + 1} / {total}
      </span>
      <button
        onClick={() => onChange(Math.min(total - 1, current + 1))}
        disabled={current >= total - 1}
        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Emplacement suggéré pour une zone de signature. Purement indicatif : la zone
 * n'est posée que si l'utilisateur agit dessus, et cliquer ailleurs dans la
 * page fonctionne toujours.
 *
 * Deux gestes équivalents :
 *  - un clic → la zone est posée à l'emplacement proposé ;
 *  - un glisser-déposer → le fantôme suit le curseur (l'utilisateur voit où il
 *    l'emmène) et la zone est posée là où il le lâche.
 *
 * Le fantôme se déplace donc exactement comme une zone déjà posée : sans ce
 * retour visuel, tirer dessus ne produisait rien et donnait l'impression d'une
 * image figée.
 */
function SuggestedZone({
  field, hex, onPlace, onDragEnd,
}: {
  field: Omit<Field, "id">;
  hex: string;
  /** Pose la zone aux coordonnées finales (en % de la page). */
  onPlace: (xPct: number, yPct: number) => void;
  /** Signale un déplacement réel, pour ignorer le clic qui suit le relâchement. */
  onDragEnd: () => void;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ xPct: field.xPct, yPct: field.yPct });
  const [dragging, setDragging] = useState(false);
  // Position « vivante » : lue au relâchement, où l'état React serait en retard.
  const positionRef = useRef(position);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; xPct: number; yPct: number } | null>(null);
  const hasMovedRef = useRef(false);

  // La suggestion change de place quand on change de signataire ou de page.
  useEffect(() => {
    const next = { xPct: field.xPct, yPct: field.yPct };
    positionRef.current = next;
    setPosition(next);
  }, [field.xPct, field.yPct, field.page, field.signer]);

  function startDrag(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault(); // pas de sélection de texte pendant le glisser
    hasMovedRef.current = false;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      xPct: positionRef.current.xPct,
      yPct: positionRef.current.yPct,
    };
    setDragging(true);
  }

  useEffect(() => {
    if (!dragging) return;

    function handleMouseMove(ev: MouseEvent) {
      const start = dragStartRef.current;
      const parent = elRef.current?.parentElement;
      if (!start || !parent) return;
      const rect = parent.getBoundingClientRect();
      // Quelques pixels de tolérance : un clic un peu tremblant reste un clic.
      if (Math.abs(ev.clientX - start.mouseX) > 3 || Math.abs(ev.clientY - start.mouseY) > 3) {
        hasMovedRef.current = true;
      }
      const next = {
        xPct: clamp(start.xPct + (ev.clientX - start.mouseX) / rect.width, 0, 1 - field.widthPct),
        yPct: clamp(start.yPct + (ev.clientY - start.mouseY) / rect.height, 0, 1 - field.heightPct),
      };
      positionRef.current = next;
      setPosition(next);
    }

    function handleMouseUp() {
      setDragging(false);
      dragStartRef.current = null;
      if (hasMovedRef.current) onDragEnd();
      onPlace(positionRef.current.xPct, positionRef.current.yPct);
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, field.widthPct, field.heightPct, onPlace, onDragEnd]);

  return (
    <div
      ref={elRef}
      role="button"
      tabIndex={0}
      onMouseDown={startDrag}
      // Le clic lui-même ne pose rien (c'est le relâchement qui s'en charge) :
      // on l'arrête seulement pour que la page n'ajoute pas une zone de plus.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onPlace(position.xPct, position.yPct);
      }}
      className={`absolute flex flex-col items-center justify-center gap-0.5 rounded select-none ${
        dragging ? "cursor-grabbing shadow-lg" : "cursor-grab animate-pulse hover:animate-none"
      }`}
      style={{
        left: `${position.xPct * 100}%`,
        top: `${position.yPct * 100}%`,
        width: `${field.widthPct * 100}%`,
        height: `${field.heightPct * 100}%`,
        border: `1.5px ${dragging ? "solid" : "dashed"} ${hex}`,
        backgroundColor: hex + (dragging ? "26" : "0D"),
      }}
      title="Cliquez pour placer ici, ou faites glisser pour choisir l'emplacement"
    >
      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: hex }}>
        Emplacement suggéré
      </span>
      <span className="text-[8px] text-gray-500">
        {dragging ? "Relâchez pour placer" : "Cliquez ou faites glisser"}
      </span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Crée une URL object pour un fichier et la nettoie au démontage.
 * Retourne null tant qu'aucun fichier n'est chargé.
 */
function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

/**
 * Observe la largeur du container et adapte la largeur de rendu du PDF
 * pour rester responsive (cap à 820px pour ne pas avoir une page géante).
 */
function usePageWidthObserver(
  containerRef: React.RefObject<HTMLDivElement | null>,
  setWidth: (w: number) => void,
) {
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      setWidth(Math.min(w - 32, 820));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [containerRef, setWidth]);
}

/**
 * Champs visibles sur la page courante : les champs de cette page +
 * les champs marqués `replicateAllPages` (paraphes/signatures sur toutes
 * les pages).
 */
function filterFieldsForPage(fields: Field[], pageIndex: number): Field[] {
  return fields.filter((f) => f.page === pageIndex || !!f.replicateAllPages);
}

/**
 * Page à afficher à l'ouverture du document. "last" = dernière page (là où se
 * trouve la signature dans la très grande majorité des contrats).
 */
function resolveInitialPage(initialPage: number | "last" | undefined, numPages: number): number {
  if (initialPage === "last") return Math.max(0, numPages - 1);
  if (typeof initialPage === "number") return clamp(initialPage, 0, Math.max(0, numPages - 1));
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
