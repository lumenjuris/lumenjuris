import { useEffect, useState } from "react";

function resolveInitialValue<T>(initialValue: T | (() => T)) {
  return initialValue instanceof Function ? initialValue() : initialValue;
}

export function useLocalStorageState<T>(
  key: string,
  initialValue: T | (() => T),
) {
  const [state, setState] = useState<T>(() => {
    const fallbackValue = resolveInitialValue(initialValue);

    if (typeof window === "undefined") {
      return fallbackValue;
    }

    try {
      const storedValue = window.localStorage.getItem(key);

      return storedValue ? (JSON.parse(storedValue) as T) : fallbackValue;
    } catch {
      return fallbackValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // fallback
    }
  }, [key, state]);

  return [state, setState] as const;
}
