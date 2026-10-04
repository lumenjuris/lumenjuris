import { useCallback, useState } from "react";
import { QuotaLimitModal } from "./QuotaLimitModal";
import {
  QUOTA_LIMIT_MESSAGES,
  QuotaExceededError,
  type QuotaFeature,
} from "../../utils/featureQuota";

/**
 * Gère l'affichage de la QuotaLimitModal pour une page/fonctionnalité.
 *
 * Usage :
 *  const { openQuotaLimit, handleQuotaError, quotaModal } = useQuotaLimit();
 *  ...
 *  try { ...action... } catch (err) {
 *    if (handleQuotaError(err)) return;   // quota : modale ouverte, on s'arrête
 *    setError("...");                     // autre erreur : traitement habituel
 *  }
 *  ...
 *  return (<>...{quotaModal}</>);
 */
export function useQuotaLimit() {
  const [feature, setFeature] = useState<QuotaFeature | null>(null);

  /** Ouvre la modale pour une feature donnée (blocage détecté en amont). */
  const openQuotaLimit = useCallback((f: QuotaFeature) => setFeature(f), []);

  /**
   * Si l'erreur est un blocage de quota, ouvre la modale et renvoie `true`
   * (l'appelant doit s'arrêter). Sinon renvoie `false` (erreur à traiter
   * normalement).
   */
  const handleQuotaError = useCallback((err: unknown): boolean => {
    if (err instanceof QuotaExceededError) {
      setFeature(err.feature);
      return true;
    }
    return false;
  }, []);

  const quotaModal = feature ? (
    <QuotaLimitModal
      title={QUOTA_LIMIT_MESSAGES[feature].title}
      message={QUOTA_LIMIT_MESSAGES[feature].message}
      onClose={() => setFeature(null)}
    />
  ) : null;

  return { openQuotaLimit, handleQuotaError, quotaModal };
}
