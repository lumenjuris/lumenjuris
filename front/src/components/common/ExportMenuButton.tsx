import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Download, FileText, FileType } from "lucide-react";
import { BANNER_ACTION_CLASS } from "./PageBanner";
import type { ExportFormat } from "../../utils/exportContract";

/**
 * Bouton d'en-tête « Exporter » avec le choix du format :
 * Word pour continuer à modifier, PDF pour partager ou archiver.
 */
export function ExportMenuButton({
  onExport,
  disabled,
  title = "Exporter le contrat",
}: {
  onExport: (format: ExportFormat) => void;
  disabled?: boolean;
  title?: string;
}) {
  // Position du menu (en coordonnées de la fenêtre) : il est rendu à la racine de la
  // page, car le bandeau qui contient le bouton coupe ce qui dépasse de son cadre.
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const open = menuPosition !== null;
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const setOpen = (isOpen: boolean) => {
    const rect = containerRef.current?.getBoundingClientRect();
    setMenuPosition(isOpen && rect ? { top: rect.bottom + 8, right: window.innerWidth - rect.right } : null);
  };

  // Un clic en dehors du menu, un défilement ou un redimensionnement le referme.
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) setMenuPosition(null);
    };
    const close = () => setMenuPosition(null);
    document.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const choose = (format: ExportFormat) => {
    setOpen(false);
    onExport(format);
  };

  return (
    <div ref={containerRef} className="relative w-full lg:w-auto">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className={BANNER_ACTION_CLASS}
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Download />
        <span>Exporter</span>
        <ChevronDown className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {menuPosition && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ top: menuPosition.top, right: menuPosition.right }}
          className="fixed z-[60] w-64 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-card"
        >
          <button type="button" role="menuitem" onClick={() => choose("docx")} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-surface-subtle">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-blue-primary" />
            <span>
              <span className="block text-sm font-semibold text-ink">Word (.docx)</span>
              <span className="block text-xs text-ink-muted">Pour continuer les modifications</span>
            </span>
          </button>
          <button type="button" role="menuitem" onClick={() => choose("pdf")} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-surface-subtle">
            <FileType className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <span>
              <span className="block text-sm font-semibold text-ink">PDF</span>
              <span className="block text-xs text-ink-muted">Pour partager ou archiver une version finale</span>
            </span>
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
