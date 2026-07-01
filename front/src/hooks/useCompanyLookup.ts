import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CompanyResult,
  CompanySearchResponse,
} from "../types/companySearch";
import {
  buildSearchUrl,
  detectLookupMode,
  isValidSiret,
  normalizeDigits,
  type LookupMode,
} from "../utils/companyLookup";

export type LookupStatus = "idle" | "loading" | "success" | "empty" | "error";

const DEBOUNCE_MS = 300;
const MIN_NAME_LENGTH = 3;
const CACHE_LIMIT = 30;

type UseCompanyLookupResult = {
  query: string;
  setQuery: (value: string) => void;
  mode: LookupMode;
  status: LookupStatus;
  results: CompanyResult[];
  error: string | null;
  reset: () => void;
};

/**
 * Pilote la recherche d'entreprise (API publique, appel direct navigateur).
 * - debounce 300 ms ;
 * - annulation des requêtes obsolètes via AbortController (anti-race) ;
 * - cache mémoïsé par (mode + requête normalisée) ;
 * - gestion explicite des états idle/loading/success/empty/error (429 inclus).
 */
export function useCompanyLookup(): UseCompanyLookupResult {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LookupStatus>("idle");
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, CompanyResult[]>>(new Map());

  const mode = detectLookupMode(query);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setResults([]);
    setError(null);
  }, []);

  // Nettoyage : annule la requête en vol au démontage.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    const currentMode = detectLookupMode(trimmed);

    // Conditions minimales avant d'interroger l'API.
    const ready =
      currentMode === "siret"
        ? isValidSiret(trimmed)
        : trimmed.length >= MIN_NAME_LENGTH;

    if (!trimmed) {
      reset();
      return;
    }
    if (!ready) {
      abortRef.current?.abort();
      setStatus("idle");
      setResults([]);
      setError(null);
      return;
    }

    const cacheKey = `${currentMode}:${
      currentMode === "siret" ? normalizeDigits(trimmed) : trimmed.toLowerCase()
    }`;

    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      abortRef.current?.abort();
      setResults(cached);
      setStatus(cached.length > 0 ? "success" : "empty");
      setError(null);
      return;
    }

    const timer = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;

      setStatus("loading");
      setError(null);

      fetch(buildSearchUrl(trimmed, currentMode), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      })
        .then(async (response) => {
          if (response.status === 429) {
            throw new Error("rate_limit");
          }
          if (!response.ok) {
            throw new Error("http_error");
          }
          const data = (await response.json()) as CompanySearchResponse;
          const list = Array.isArray(data.results) ? data.results : [];

          // Mise en cache (éviction FIFO simple si dépassement).
          const cache = cacheRef.current;
          cache.set(cacheKey, list);
          if (cache.size > CACHE_LIMIT) {
            const oldest = cache.keys().next().value;
            if (oldest !== undefined) cache.delete(oldest);
          }

          if (abortRef.current !== controller) return;
          setResults(list);
          setStatus(list.length > 0 ? "success" : "empty");
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (abortRef.current !== controller) return;
          setResults([]);
          setStatus("error");
          setError(
            err instanceof Error && err.message === "rate_limit"
              ? "Trop de requêtes. Patientez quelques secondes puis réessayez, ou saisissez les informations manuellement."
              : "Service indisponible. Saisissez les informations manuellement ci-dessous.",
          );
        })
        .finally(() => {
          if (abortRef.current === controller) abortRef.current = null;
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, reset]);

  return { query, setQuery, mode, status, results, error, reset };
}
