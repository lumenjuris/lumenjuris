import { useEffect, useRef, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Un clic en dehors du menu le referme.
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  const choose = (format: ExportFormat) => {
    setOpen(false);
    onExport(format);
  };

  return (
    <div ref={containerRef} className="relative w-full lg:w-auto">
      <button
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
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

      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-card">
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
        </div>
      )}
    </div>
  );
}
