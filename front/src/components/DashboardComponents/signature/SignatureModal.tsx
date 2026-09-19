import { useEffect, useRef, useState } from "react";
import { X, Pencil, Type as TypeIcon, RotateCcw } from "lucide-react";
import type { CapturedSignature, FieldType } from "./types";

const TYPED_FONTS = [
  { id: "caveat",       label: "Caveat",       css: "'Caveat', cursive" },
  { id: "dancing",      label: "Dancing",      css: "'Dancing Script', cursive" },
  { id: "great-vibes",  label: "Great Vibes",  css: "'Great Vibes', cursive" },
  { id: "satisfy",      label: "Satisfy",      css: "'Satisfy', cursive" },
];

/** Textes de la modale selon ce qui est saisi : signature complète ou paraphe. */
const MODAL_TEXTS: Record<FieldType, {
  title: string;
  drawPlaceholder: string;
  typePlaceholder: string;
  confirmLabel: string;
}> = {
  signature: {
    title: "Créez votre signature",
    drawPlaceholder: "Tracez votre signature ici…",
    typePlaceholder: "Votre nom complet",
    confirmLabel: "Valider la signature",
  },
  initial: {
    title: "Créez votre paraphe",
    drawPlaceholder: "Tracez vos initiales ici…",
    typePlaceholder: "Vos initiales",
    confirmLabel: "Valider le paraphe",
  },
};

interface Props {
  open: boolean;
  signerName: string;
  signerHex: string;
  /** Ce qui est saisi : la signature (par défaut) ou le paraphe (initiales). */
  kind?: FieldType;
  initialSignature?: CapturedSignature | null;
  onClose: () => void;
  onConfirm: (sig: CapturedSignature) => void;
}

/**
 * Modale de création de signature avec 2 onglets : Dessiner (canvas) et Saisir
 * (texte stylisé en police cursive).
 * Renvoie un dataUrl PNG réutilisable pour tous les champs du signataire.
 *
 * En mode paraphe (`kind="initial"`), le texte proposé par défaut est fait des
 * initiales du signataire (« Jean Dupont » → « J.D. »).
 */
export function SignatureModal({
  open, signerName, signerHex, kind = "signature", initialSignature, onClose, onConfirm,
}: Props) {
  const texts = MODAL_TEXTS[kind];
  const defaultTypedText = kind === "initial" ? toInitials(signerName) : signerName;

  const [tab, setTab] = useState<"draw" | "type">("draw");
  const [typedText, setTypedText] = useState("");
  const [typedFont, setTypedFont] = useState(TYPED_FONTS[0].id);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // Init typed name si vide
  useEffect(() => {
    if (open) {
      if (initialSignature?.type === "typed") {
        setTab("type");
        setTypedText(initialSignature.text ?? defaultTypedText);
        setTypedFont(initialSignature.font ?? TYPED_FONTS[0].id);
      } else if (initialSignature?.type === "drawn") {
        setTab("draw");
      } else {
        setTab("draw");
        setTypedText(defaultTypedText);
      }
    }
  }, [open, initialSignature, defaultTypedText]);

  // Setup canvas
  useEffect(() => {
    if (!open || tab !== "draw") return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    // Reset
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = signerHex;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setHasInk(false);
  }, [open, tab, signerHex]);

  function getPoint(e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): { x: number; y: number } {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const sx = c.width / rect.width;
    const sy = c.height / rect.height;
    let clientX = 0;
    let clientY = 0;
    if ("touches" in e && e.touches.length) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ("clientX" in e) {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  }

  function startStroke(e: React.MouseEvent | React.TouchEvent) {
    if (!canvasRef.current) return;
    drawing.current = true;
    lastPoint.current = getPoint(e);
  }

  function moveStroke(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current || !canvasRef.current || !lastPoint.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    const p = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint.current = p;
    if (!hasInk) setHasInk(true);
  }

  function endStroke() {
    drawing.current = false;
    lastPoint.current = null;
  }

  function clearCanvas() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = signerHex;
    setHasInk(false);
  }

  /** Rendu d'une signature texte sur canvas → dataUrl PNG */
  function renderTypedToDataUrl(text: string, font: string): string {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 200;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = signerHex;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Trouver une taille qui rentre
    let size = 92;
    const cssFont = TYPED_FONTS.find((f) => f.id === font)?.css ?? TYPED_FONTS[0].css;
    do {
      ctx.font = `${size}px ${cssFont}`;
      const w = ctx.measureText(text).width;
      if (w < c.width - 60) break;
      size -= 4;
    } while (size > 24);
    ctx.fillText(text, c.width / 2, c.height / 2);
    return c.toDataURL("image/png");
  }

  function handleConfirm() {
    if (tab === "draw") {
      if (!canvasRef.current || !hasInk) return;
      const dataUrl = canvasRef.current.toDataURL("image/png");
      onConfirm({ type: "drawn", dataUrl });
    } else {
      const txt = typedText.trim();
      if (!txt) return;
      const dataUrl = renderTypedToDataUrl(txt, typedFont);
      onConfirm({ type: "typed", dataUrl, text: txt, font: typedFont });
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      style={{ animation: "fadeIn 0.15s ease-out" }}
    >
      {/* Polices web pour les signatures typées */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Dancing+Script:wght@500;700&family=Great+Vibes&family=Satisfy&display=swap" />

      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[92vh] overflow-y-auto"
        style={{ animation: "scaleIn 0.2s ease-out" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: signerHex + "20" }}>
              <Pencil className="w-4 h-4" style={{ color: signerHex }} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">{texts.title}</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">{signerName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-4">
          <button
            onClick={() => setTab("draw")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === "draw" ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <Pencil className="w-3.5 h-3.5" /> Dessiner
          </button>
          <button
            onClick={() => setTab("type")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === "type" ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <TypeIcon className="w-3.5 h-3.5" /> Saisir
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {tab === "draw" && (
            <div className="space-y-3">
              <div className="relative rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={900}
                  height={300}
                  className="w-full h-[160px] sm:h-[220px] cursor-crosshair touch-none"
                  onMouseDown={startStroke}
                  onMouseMove={moveStroke}
                  onMouseUp={endStroke}
                  onMouseLeave={endStroke}
                  onTouchStart={startStroke}
                  onTouchMove={moveStroke}
                  onTouchEnd={endStroke}
                />
                {!hasInk && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <p className="text-sm text-gray-300 italic">{texts.drawPlaceholder}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={clearCanvas}
                  disabled={!hasInk}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 disabled:opacity-40 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Effacer
                </button>
                <p className="hidden sm:block text-[11px] text-gray-400">Utilisez la souris ou un écran tactile.</p>
              </div>
            </div>
          )}

          {tab === "type" && (
            <div className="space-y-3">
              <input
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder={texts.typePlaceholder}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-gray-300 focus:bg-white transition"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {TYPED_FONTS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setTypedFont(f.id)}
                    className={`flex items-center justify-center px-4 py-5 rounded-xl border-2 transition-all ${
                      typedFont === f.id
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <span
                      className="text-3xl truncate"
                      style={{ fontFamily: f.css, color: signerHex }}
                    >
                      {typedText.trim() || defaultTypedText}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={tab === "draw" ? !hasInk : !typedText.trim()}
            className="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            style={{ backgroundColor: signerHex }}
          >
            {texts.confirmLabel}
          </button>
        </div>

        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.94); }
            to   { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
}

/**
 * Initiales d'un nom, pour pré-remplir le paraphe : « Jean Dupont » → « J.D. »,
 * « Marie-Claire Martin » → « M.C.M. ».
 */
function toInitials(fullName: string): string {
  const words = fullName.trim().split(/[\s-]+/).filter(Boolean);
  return words.map((word) => word.charAt(0).toUpperCase() + ".").join("");
}
