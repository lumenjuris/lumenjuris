import { useEffect, useRef, useState } from "react";
import { Check, Columns3, RotateCcw } from "lucide-react";

/** Une colonne proposée dans le sélecteur. */
export interface ColumnOption {
  id: string;
  label: string;
  /** Colonne toujours affichée : elle est cochée et non décochable. */
  locked?: boolean;
}

interface Props {
  columns: ColumnOption[];
  visibleColumns: string[];
  onChange: (visibleColumns: string[]) => void;
  /** Colonnes rétablies par « Par défaut ». */
  defaultColumns: string[];
}

/**
 * Sélecteur de colonnes d'un tableau : un bouton « Colonnes 5/9 » qui ouvre un
 * panneau de cases à cocher.
 *
 * Il remplace la rangée de cases à cocher affichée en permanence au-dessus des
 * tableaux : le réglage est rare, il n'a pas à occuper la page en continu.
 *
 * Deux garde-fous : on ne peut pas décocher la dernière colonne visible (le
 * tableau n'aurait plus rien à afficher), ni une colonne `locked`.
 */
export function ColumnPicker({ columns, visibleColumns, onChange, defaultColumns }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fermeture au clic en dehors et à la touche Échap.
  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const isVisible = (id: string) => visibleColumns.includes(id);
  const visibleCount = columns.filter((col) => isVisible(col.id)).length;

  const toggleColumn = (column: ColumnOption) => {
    if (column.locked) return;
    // Un tableau sans colonne n'aurait plus rien à afficher.
    if (isVisible(column.id) && visibleCount <= 1) return;

    onChange(
      isVisible(column.id)
        ? visibleColumns.filter((id) => id !== column.id)
        : [...visibleColumns, column.id],
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`inline-flex items-center gap-2 rounded-[10px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
          isOpen
            ? "border-blue-primary bg-brand-light text-blue-primary"
            : "border-line bg-white text-ink-secondary hover:border-line-emphasis hover:bg-surface-subtle"
        }`}
      >
        <Columns3 className="h-3.5 w-3.5" />
        Colonnes
        <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-ink-muted">
          {visibleCount}/{columns.length}
        </span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Colonnes affichées"
          className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_40px_-20px_rgba(16,24,40,0.45)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line-subtle px-3 py-2.5">
            <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
              Colonnes affichées
            </span>
            <button
              type="button"
              onClick={() => onChange(defaultColumns)}
              className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-blue-primary hover:underline"
            >
              <RotateCcw className="h-3 w-3" />
              Par défaut
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
            {columns.map((column) => {
              const checked = isVisible(column.id);
              // La dernière colonne cochée se verrouille d'elle-même.
              const disabled = column.locked || (checked && visibleCount <= 1);

              return (
                <button
                  key={column.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={checked}
                  disabled={disabled}
                  onClick={() => toggleColumn(column)}
                  title={column.locked ? "Colonne toujours affichée" : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                    disabled
                      ? "cursor-not-allowed text-ink-subtle"
                      : "text-ink-secondary hover:bg-surface-subtle"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                      checked
                        ? "border-blue-primary bg-blue-primary text-white"
                        : "border-line-emphasis bg-white"
                    }`}
                  >
                    {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className="truncate">{column.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
