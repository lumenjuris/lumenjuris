import { useEffect, useId, useRef, useState } from "react";
import { useCompanyLookup } from "../../hooks/useCompanyLookup";
import type { CompanyResult } from "../../types/companySearch";
import { formatCompanyOption, normalizeDigits } from "../../utils/companyLookup";

type CompanySearchFieldProps = {
  /** Appelé à la sélection d'une entreprise (résultat brut + SIRET si saisi). */
  onSelect: (result: CompanyResult, siret?: string) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
};

/**
 * Recherche d'entreprise (combobox ARIA) avec deux modes auto-détectés :
 * par SIRET (14 chiffres) ou par nom (autocomplete debouncé). Émet le résultat
 * brut de l'API ; au composant parent de le mapper vers ses propres champs.
 */
export function CompanySearchField({
  onSelect,
  label = "Remplissage automatique",
  hint = "Saisissez le nom ou le SIRET de l’entreprise pour préremplir les champs ci-dessous (modifiables ensuite).",
  placeholder = "Ex. « LumenJuris » ou « 55203253400703 »",
}: CompanySearchFieldProps) {
  const { query, setQuery, mode, status, results, error } = useCompanyLookup();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const listboxId = useId();
  const optionId = (index: number) => `${listboxId}-option-${index}`;
  const containerRef = useRef<HTMLDivElement>(null);

  const hasResults = status === "success" && results.length > 0;
  const showPanel =
    open &&
    (status === "loading" ||
      status === "empty" ||
      status === "error" ||
      hasResults);

  useEffect(() => {
    setActiveIndex(hasResults ? 0 : -1);
  }, [results, hasResults]);

  useEffect(() => {
    if (!showPanel) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showPanel]);

  const handleSelect = (index: number) => {
    const result = results[index];
    if (!result) return;
    const siret = mode === "siret" ? normalizeDigits(query) : undefined;
    onSelect(result, siret);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!hasResults) return;
      setOpen(true);
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!hasResults) return;
      setOpen(true);
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      if (hasResults && activeIndex >= 0) {
        event.preventDefault();
        handleSelect(activeIndex);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      {(label || hint) && (
        <div>
          {label && <p className="text-sm font-medium text-gray-900">{label}</p>}
          {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            showPanel && activeIndex >= 0 ? optionId(activeIndex) : undefined
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-[#354F99] focus:ring-2 focus:ring-[#354F99]/20"
        />

        {showPanel && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Entreprises correspondantes"
            className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {status === "loading" && (
              <li className="px-3 py-2 text-sm text-gray-500">
                Recherche en cours…
              </li>
            )}
            {status === "empty" && (
              <li className="px-3 py-2 text-sm text-gray-500">
                Aucun résultat. Saisissez les informations manuellement.
              </li>
            )}
            {status === "error" && (
              <li className="px-3 py-2 text-sm text-red-600">{error}</li>
            )}
            {hasResults &&
              results.map((result, index) => {
                const { title, subtitle } = formatCompanyOption(result);
                const isActive = index === activeIndex;
                return (
                  <li
                    key={`${result.siren ?? "x"}-${index}`}
                    id={optionId(index)}
                    role="option"
                    aria-selected={isActive}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      handleSelect(index);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`cursor-pointer px-3 py-2 ${
                      isActive ? "bg-[#354F99]/10" : "hover:bg-gray-50"
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900">{title}</p>
                    {subtitle && (
                      <p className="text-xs text-gray-500">{subtitle}</p>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </div>
  );
}
