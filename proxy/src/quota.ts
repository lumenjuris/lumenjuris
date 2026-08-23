import { BACKNODE_URL } from "./config.js";

/** En-têtes internes pour appeler backNode au nom d'un utilisateur (comme tracking.ts). */
function internalHeaders(userId: number) {
  return {
    "Content-Type": "application/json",
    "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
    "x-user-id": String(userId),
  };
}

/**
 * Vérifie auprès de backNode si l'utilisateur a encore du quota pour `feature`
 * (sans décrémenter). À appeler AVANT de lancer une feature coûteuse.
 *
 * Fail-open : en cas d'erreur d'infra (backNode injoignable / réponse non OK),
 * on autorise — le quota n'est pas critique-sécurité, on ne bloque pas un client
 * pour un hoquet. Un `allowed:false` explicite du backNode, lui, bloque bien.
 */
export async function hasQuota(feature: string, userId: number): Promise<boolean> {
  try {
    const res = await fetch(
      `${BACKNODE_URL}/billing/quota/${encodeURIComponent(feature)}`,
      { method: "GET", headers: internalHeaders(userId) },
    );
    if (!res.ok) return true; // fail-open
    const data = await res.json();
    return data?.data?.allowed === true;
  } catch (e: any) {
    console.error("[quota] hasQuota error:", e?.message);
    return true; // fail-open
  }
}

/**
 * Décrémente un quota après un usage réussi (best-effort). N'interrompt jamais
 * le flux : si l'appel échoue, on loggue seulement (l'usage a déjà eu lieu).
 */
export async function consumeQuota(
  feature: string,
  userId: number,
  amount = 1,
): Promise<void> {
  try {
    await fetch(`${BACKNODE_URL}/billing/remove-credits`, {
      method: "PUT",
      headers: internalHeaders(userId),
      body: JSON.stringify({ feature, amount }),
    });
  } catch (e: any) {
    console.error("[quota] consumeQuota error:", e?.message);
  }
}
