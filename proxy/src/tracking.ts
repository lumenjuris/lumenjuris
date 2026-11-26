import { BACKNODE_URL } from "./config.js";
import type { PythonJsonResponse } from "./relay.js";
import { currentClientSource } from "./middleware/clientSource.js";

/**
 * Loggue la consommation de tokens OpenAI renvoyée par le backend Python
 * vers backNode (best-effort). Retire `openai_tokens` de la réponse au passage.
 */
export async function logOpenAiTokens(
  data: PythonJsonResponse,
  userId?: number,
): Promise<void> {
  const usage = data.openai_tokens;
  delete data.openai_tokens;

  if (!usage?.model) return;
  const inputTokens = Number(usage.input_tokens ?? 0);
  const outputTokens = Number(usage.output_tokens ?? 0);

  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
    console.warn("OpenAI usage ignored: invalid payload", usage);
    return;
  }

  try {
    const logResponse = await fetch(
      `${BACKNODE_URL}/llm/increment/${encodeURIComponent(usage.model)}/${Math.trunc(inputTokens)}/${Math.trunc(outputTokens)}`,
      {
        method: "PUT",
        headers: {
          "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
          "x-client-source": currentClientSource(),
          ...(userId ? { "x-user-id": String(userId) } : {}),
        },
      },
    );

    if (!logResponse.ok) {
      const errorText = await logResponse.text().catch(() => "");
      console.warn("OpenAI usage log failed:", logResponse.status, errorText);
    }
  } catch (e: any) {
    console.error("OpenAI usage log error:", e.message);
  }
}

/** Tracking des fonctionnalités pour analyse et monitoring (best-effort). */
export async function trackFeature(
  feature: string,
  userId?: number,
): Promise<void> {
  if (!userId) return;
  try {
    await fetch(`${BACKNODE_URL}/feature-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
      },
      // `source` : "web" ou "word-addin" (middleware clientSource).
      body: JSON.stringify({ feature, userId, source: currentClientSource() }),
    });
  } catch (e: any) {
    console.error("[feature-track] error:", e.message);
  }
}

/** Compose le tracking d'une feature avec un callback existant (ex: logOpenAiTokens). */
export function withTracking(
  feature: string,
  base?: (data: PythonJsonResponse, userId?: number) => Promise<void>,
): (data: PythonJsonResponse, userId?: number) => Promise<void> {
  return async (data, userId) => {
    void trackFeature(feature, userId);
    if (base) await base(data, userId);
  };
}
