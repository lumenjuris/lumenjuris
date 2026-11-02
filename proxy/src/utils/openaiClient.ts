import { pythonHeaders } from "../config.js";
/* eslint-disable no-console */
const IS_PROD = process.env.NODE_ENV === "production";
const BACKEND_URL = IS_PROD ? process.env.BACKEND_URL : "http://127.0.0.1:5678";
const BACKNODE_URL = IS_PROD
  ? process.env.BACKNODE_URL
  : "http://localhost:3020";



type OpenAiUsagePayload = {
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
};



async function logTokens(usage: OpenAiUsagePayload | undefined, userId?: number): Promise<void> {
  if (!usage?.model) return;
  const input = Math.trunc(Number(usage.input_tokens ?? 0));
  const output = Math.trunc(Number(usage.output_tokens ?? 0));
  if (!Number.isFinite(input) || !Number.isFinite(output)) return;
  try {
    await fetch(
      `${BACKNODE_URL}/llm/increment/${encodeURIComponent(usage.model)}/${input}/${output}`,
      {
        method: "PUT",
        headers: {
          // backNode protège toutes ses routes via internalApiKeyMiddleware :
          // sans cette clé, l'incrément renvoie 401 et le tracking est perdu en silence.
          "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
          ...(userId ? { "x-user-id": String(userId) } : {}),
        },
      },
    );
  } catch {
    // token logging is best-effort
  }
}

export interface OpenAIOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: string };
}

export async function callOpenAI(
  messages: { role: string; content: string }[],
  options: OpenAIOptions = {},
  userId?: number,
): Promise<string> {
  const r = await fetch(`${BACKEND_URL}/openai-chat`, {
    method: "POST",
    headers: pythonHeaders(),
    body: JSON.stringify({ messages, ...options }),
  });
  if (!r.ok) throw new Error(`openai-chat error ${r.status}`);
  const d = (await r.json()) as {
    content?: string;
    openai_tokens?: OpenAiUsagePayload;
  };
  void logTokens(d.openai_tokens, userId);
  if (typeof d.content !== "string") throw new Error("openai-chat: no content");
  return d.content;
}

export async function callOpenAi52(
  prompt: string,
  reasoning: string = "low",
  verbosity: string = "low",
  model: string = "gpt-5.2",
  userId?: number,
): Promise<string> {
  const r = await fetch(`${BACKEND_URL}/openai-chat-5`, {
    method: "POST",
    headers: pythonHeaders(),
    body: JSON.stringify({ prompt, reasoning, verbosity, model }),
  });
  if (!r.ok) throw new Error(`openai-chat-5 error ${r.status}`);
  const d = (await r.json()) as {
    content?: string;
    openai_tokens?: OpenAiUsagePayload;
  };
  void logTokens(d.openai_tokens, userId);
  if (typeof d.content !== "string")
    throw new Error("openai-chat-5: no content");
  return d.content;
}
