import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { formatSignedDate } from "./types";
import type { Field, Signer } from "./types";

interface Props {
  field: Field;
  signer: Signer;
  /** "place" = drag + delete, "sign" = clic pour signer, "preview" = lecture seule. */
  mode: "place" | "sign" | "preview";
  onMove?: (xPct: number, yPct: number) => void;
  onRemove?: () => void;
  onClick?: () => void;
}

/**
 * Rendu d'un champ (signature, paraphe) en overlay absolu sur la page PDF.
 *
 * Modes :
 *  - place   : draggable + supprimable (bouton corbeille au survol)
 *  - sign    : cliquable pour ouvrir la modale de signature
 *  - preview : lecture seule (utilisé après envoi)
 *
 * Quand le champ est signé (value présente), on affiche l'image de signature.
 * Pour les `signature`, la date de signature (`signedAt`) apparaît en petit
 * sous la signature.
 */
export function FieldOverlay({ field, signer, mode, onMove, onRemove, onClick }: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const dragState = useDragHandlers(elRef, field, mode, onMove);

  const filled = !!field.value;
  const colorBg = signer.hex + "1A"; // alpha 10%
  const colorBorder = signer.hex;
  const label = field.type === "signature" ? "Signature" : "Paraphe";

  return (
    <div
      ref={elRef}
      onMouseDown={dragState.onMouseDown}
      onClick={(e) => {
        e.stopPropagation();
        if (mode === "place") return;
        console.log("FieldOverlay clicked", field.id); // ← ajouter

        onClick?.();
      }}
      className={`absolute group select-none transition-shadow ${mode === "place" ? "cursor-move" : mode === "sign" ? "cursor-pointer hover:shadow-lg" : ""
        } ${dragState.dragging ? "shadow-2xl ring-2" : ""}`}
      style={{
        left: `${field.xPct * 100}%`,
        top: `${field.yPct * 100}%`,
        width: `${field.widthPct * 100}%`,
        height: `${field.heightPct * 100}%`,
        backgroundColor: filled ? "#ffffff" : colorBg,
        border: `1.5px ${filled ? "solid" : "dashed"} ${colorBorder}`,
        borderRadius: 4,
      }}
    >
      {filled ? (
        <FilledContent
          field={field}
          showDate={field.type === "signature"}
        />
      ) : (
        <EmptyPlaceholder label={label} signerName={signer.name} colorBorder={colorBorder} />
      )}

      {mode === "place" && onRemove && (
        <DeleteButton onClick={() => onRemove()} />
      )}
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

/** Rendu d'un champ signé : image de signature + date au-dessous (signature uniquement). */
function FilledContent({ field, showDate }: { field: Field; showDate: boolean }) {
  if (!field.value) return null;
  if (!showDate) {
    return <img src={field.value} alt="signature" className="w-full h-full object-contain p-0.5" />;
  }
  return (
    <div className="w-full h-full flex flex-col">
      <img src={field.value} alt="signature" className="flex-1 min-h-0 w-full object-contain p-0.5" />
      <p className="text-[8px] text-gray-500 text-center leading-tight pb-0.5">
        Signé le {formatSignedDate(field.signedAt)}
      </p>
    </div>
  );
}

/** Placeholder visible tant qu'aucune signature n'a été apposée. */
function EmptyPlaceholder({
  label, signerName, colorBorder,
}: {
  label: string;
  signerName: string;
  colorBorder: string;
}) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 px-1 overflow-hidden">
      <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: colorBorder }}>
        {label}
      </span>
      <span className="text-[8px] text-gray-500 truncate max-w-full">{signerName}</span>
    </div>
  );
}

/** Bouton de suppression d'un champ (apparaît au survol en mode "place"). */
function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity"
      title="Supprimer ce champ"
    >
      <Trash2 className="w-2.5 h-2.5" />
    </button>
  );
}

// ─── Drag & drop ──────────────────────────────────────────────────────────────

interface DragState {
  dragging: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}

/**
 * Hook custom encapsulant la logique de drag du champ.
 * - On enregistre la position de départ (souris + champ) au mousedown.
 * - Pendant le drag (mousemove global), on calcule un déplacement en
 *   pourcentage de la page parente et on remonte au parent via onMove.
 * - Le drag est ignoré hors mode "place".
 */
function useDragHandlers(
  elRef: React.RefObject<HTMLDivElement | null>,
  field: Field,
  mode: "place" | "sign" | "preview",
  onMove?: (xPct: number, yPct: number) => void,
): DragState {
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ mouseX: number; mouseY: number; xPct: number; yPct: number } | null>(null);

  function onMouseDown(e: React.MouseEvent) {
    if (mode !== "place") return;
    if (!elRef.current) return;
    e.stopPropagation();
    setDragging(true);
    setDragging(true);
    startRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      xPct: field.xPct,
      yPct: field.yPct,
    };
  }

  useEffect(() => {
    if (!dragging) return;
    function onMouseMove(ev: MouseEvent) {
      if (!startRef.current || !elRef.current) return;
      const parent = elRef.current.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dxPct = (ev.clientX - startRef.current.mouseX) / rect.width;
      const dyPct = (ev.clientY - startRef.current.mouseY) / rect.height;
      const newX = clamp(startRef.current.xPct + dxPct, 0, 1 - field.widthPct);
      const newY = clamp(startRef.current.yPct + dyPct, 0, 1 - field.heightPct);
      onMove?.(newX, newY);
    }
    function onMouseUp() {
      setDragging(false);
      startRef.current = null;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging, field.widthPct, field.heightPct, onMove, elRef]);

  return { dragging, onMouseDown };
}

/** Bridge une valeur dans l'intervalle [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
