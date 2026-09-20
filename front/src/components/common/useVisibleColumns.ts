import { useEffect, useState } from "react";

/**
 * Mémorise les colonnes affichées d'un tableau dans le `localStorage`.
 *
 * Le stockage peut être indisponible (navigation privée, stockage bloqué) :
 * chaque accès est protégé, et on retombe alors sur les colonnes par défaut.
 *
 * @param storageKey Clé de stockage, propre à chaque tableau.
 * @param defaultIds Colonnes affichées tant que l'utilisateur n'a rien choisi.
 * @param knownIds   Toutes les colonnes existantes : une préférence enregistrée
 *                   qui cite une colonne supprimée depuis est nettoyée.
 */
export function useVisibleColumns(
  storageKey: string,
  defaultIds: string[],
  knownIds: string[],
) {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const kept = parsed.filter((id) => knownIds.includes(id));
          if (kept.length > 0) return kept;
        }
      }
    } catch (error) {
      console.error("Erreur de la lecture du localStorage", error);
    }
    return defaultIds;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(visibleColumns));
    } catch (error) {
      console.error("Erreur de la sauvegarde dans le localStorage", error);
    }
  }, [storageKey, visibleColumns]);

  return [visibleColumns, setVisibleColumns] as const;
}
