import { useEffect, useRef, useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import type { Field, Signer, FieldType } from "./types";

// Configure le worker pdf.js (CDN, évite la config Vite custom)
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface Props {
  file: File | null;
  fields: Field[];
  signers: Signer[];
  // mode "place" : on peut déposer des champs / les déplacer / les supprimer
  // mode "sign"  : on affiche les champs et on clique pour signer (les champs filled montrent le rendu)
  // mode "preview": lecture seule
  mode: "place" | "sign" | "preview";
  // Type de champ actuellement sélectionné dans la toolbar (pour mode "place")
  activeFieldType?: FieldType;
  activeSignerRole?: "self" | "counterparty";
  replicateAllPages?: boolean;
  // callbacks
  onFieldAdd?: (field: Omit<Field, "id">) => void;
  onFieldMove?: (id: string, xPct: number, yPct: number) => void;
  onFieldRemove?: (id: string) => void;
  onFieldClick?: (field: Field) => void;
  // Nombre de pages renvoyé une fois chargé
  onLoaded?: (numPages: number) => void;
}

const FIELD_W = 0.22;        // 22% de largeur page par défaut
const FIELD_H_SIG = 0.06;    // signature/initial
const FIELD_H_DATE = 0.035;  // date plus fine

function fieldDefaults(type: FieldType): { width: number; height: number } {
  if (type === "date") return { width: 0.14, height: FIELD_H_DATE };
  if (type === "initial") return { width: 0.08, height: FIELD_H_SIG };
  return { width: FIELD_W, height: FIELD_H_SIG };
}

export function PdfViewer({
  file, fields, signers, mode,
  activeFieldType, activeSignerRole, replicateAllPages,
  onFieldAdd, onFieldMove, onFieldRemove, onFieldClick, onLoaded,
}: Props) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Convertit un File en URL stable
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setFileUrl(null); return; }
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Calcule la largeur de page (responsive)
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      setPageWidth(Math.min(w - 32, 820));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  function handleDocumentLoad({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setCurrentPage(0);
    onLoaded?.(numPages);
  }

  function getSignerByRole(role: "self" | "counterparty"): Signer {
    return signers.find((s) => s.role === role) ?? signers[0];
  }

  // Click sur la page (mode place) → ajoute un champ
  const handlePageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (mode !== "place" || !activeFieldType || !activeSignerRole || !onFieldAdd) return;
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const yPct = (e.clientY - rect.top) / rect.height;
    const { width, height } = fieldDefaults(activeFieldType);
    // Centre le champ sur le clic
    onFieldAdd({
      type: activeFieldType,
      signer: activeSignerRole,
      page: currentPage,
      xPct: Math.max(0, Math.min(1 - width, xPct - width / 2)),
      yPct: Math.max(0, Math.min(1 - height, yPct - height / 2)),
      widthPct: width,
      heightPct: height,
      replicateAllPages: activeFieldType === "initial" && !!replicateAllPages,
    });
  }, [mode, activeFieldType, activeSignerRole, currentPage, onFieldAdd, replicateAllPages]);

  if (!fileUrl) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
        Aucun document chargé
      </div>
    );
  }

  // Champs visibles sur la page courante
  const fieldsOnPage = fields.filter((f) =>
    f.page === currentPage || (f.replicateAllPages && f.type === "initial"),
  );

  return (
    <div className="flex flex-col items-center" ref={containerRef}>
      {/* Navigation pages */}
      {numPages > 1 && (
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-gray-600">
            Page {currentPage + 1} / {numPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(numPages - 1, p + 1))}
            disabled={currentPage >= numPages - 1}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page + overlay */}
      <div
        className={`relative shadow-lg ring-1 ring-gray-200 rounded-md overflow-hidden bg-white ${
          mode === "place" && activeFieldType ? "cursor-crosshair" : ""
        }`}
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

        {/* Overlay des champs */}
        {fieldsOnPage.map((f) => {
          const signer = getSignerByRole(f.signer);
          const isActive = mode !== "preview";
          return (
            <FieldOverlay
              key={`${f.id}-${currentPage}`}
              field={f}
              signer={signer}
              interactive={isActive}
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

// ─── Champ individuel rendu sur la page ──────────────────────────────────────

interface OverlayProps {
  field: Field;
  signer: Signer;
  interactive: boolean;
  mode: "place" | "sign" | "preview";
  onMove?: (xPct: number, yPct: number) => void;
  onRemove?: () => void;
  onClick?: () => void;
}

function FieldOverlay({ field, signer, interactive, mode, onMove, onRemove, onClick }: OverlayProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; xPct: number; yPct: number } | null>(null);

  function handleMouseDown(e: React.MouseEvent) {
    if (mode !== "place") return;
    if (!elRef.current) return;
    e.stopPropagation();
    const parent = elRef.current.parentElement;
    if (!parent) return;
    setDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      xPct: field.xPct,
      yPct: field.yPct,
    };
  }

  useEffect(() => {
    if (!dragging) return;
    const onMove2 = (ev: MouseEvent) => {
      if (!dragStart.current || !elRef.current) return;
      const parent = elRef.current.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dxPct = (ev.clientX - dragStart.current.x) / rect.width;
      const dyPct = (ev.clientY - dragStart.current.y) / rect.height;
      const newX = Math.max(0, Math.min(1 - field.widthPct, dragStart.current.xPct + dxPct));
      const newY = Math.max(0, Math.min(1 - field.heightPct, dragStart.current.yPct + dyPct));
      onMove?.(newX, newY);
    };
    const onUp = () => { setDragging(false); dragStart.current = null; };
    window.addEventListener("mousemove", onMove2);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove2);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, field.widthPct, field.heightPct, onMove]);

  const filled = !!field.value;
  const colorBg = signer.hex + "1A"; // 10% alpha
  const colorBorder = signer.hex;

  const label = field.type === "signature" ? "Signature" : field.type === "initial" ? "Paraphe" : "Date";

  return (
    <div
      ref={elRef}
      onMouseDown={handleMouseDown}
      onClick={(e) => {
        if (mode === "place") return;
        e.stopPropagation();
        if (interactive) onClick?.();
      }}
      className={`absolute group select-none transition-shadow ${
        mode === "place" ? "cursor-move" : mode === "sign" ? "cursor-pointer hover:shadow-lg" : ""
      } ${dragging ? "shadow-2xl ring-2" : ""}`}
      style={{
        left:   `${field.xPct * 100}%`,
        top:    `${field.yPct * 100}%`,
        width:  `${field.widthPct * 100}%`,
        height: `${field.heightPct * 100}%`,
        backgroundColor: filled ? "#ffffff" : colorBg,
        border: `1.5px ${filled ? "solid" : "dashed"} ${colorBorder}`,
        borderRadius: 4,
      }}
    >
      {filled && field.type !== "date" ? (
        <img src={field.value} alt="signature" className="w-full h-full object-contain p-0.5" />
      ) : filled && field.type === "date" ? (
        <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-700 font-semibold px-1">
          {field.value}
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 px-1 overflow-hidden">
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: colorBorder }}>
            {label}
          </span>
          <span className="text-[8px] text-gray-500 truncate max-w-full">{signer.name}</span>
        </div>
      )}

      {/* Bouton supprimer (mode place uniquement) */}
      {mode === "place" && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity"
          title="Supprimer ce champ"
        >
          <Trash2 className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
}
