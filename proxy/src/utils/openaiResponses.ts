import { BACKEND_URL } from "../config.js";

/**
 * Appel d'un modèle GPT-5 (API « Responses » d'OpenAI), avec le même message
 * système et les mêmes réglages que la route /openai-chat-5 du moteur Python.
 *
 * Si le relais a sa propre clé (OPENAI_API_KEY dans son .env), il appelle OpenAI
 * directement. Raison : en ligne, le moteur Python tourne sous Passenger chez
 * o2switch et ne traite que 2 demandes à la fois ; l'import d'un modèle en lance
 * jusqu'à 4 en même temps, qui attendaient donc leur tour (import deux fois plus
 * long qu'en local). Sans clé, on passe par le moteur Python comme avant.
 */

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const SYSTEM_PROMPT =
  "Tu es un expert en droit français, spécialisé en contrats et analyse de clauses à risque.";
const TIMEOUT_MS = 180_000;

export interface Gpt5Request {
  prompt: string;
  model: "gpt-5.2" | "gpt-5.4-nano";
  reasoning: "none" | "low" | "medium" | "high" | "xhigh";
  verbosity: "low" | "medium" | "high";
}

export interface Gpt5Response {
  content: string;
  openai_tokens?: { model: string; input_tokens: number; output_tokens: number };
}

export async function callGpt5(req: Gpt5Request): Promise<Gpt5Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? callOpenAiDirectly(req, apiKey) : callThroughPython(req);
}

async function callOpenAiDirectly(req: Gpt5Request, apiKey: string): Promise<Gpt5Response> {
  const body: Record<string, unknown> = {
    model: req.model,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: req.prompt },
    ],
    reasoning: { effort: req.reasoning },
    text: { verbosity: req.verbosity },
  };
  // Mêmes réglages que le moteur Python quand le raisonnement est désactivé.
  if (req.reasoning === "none") {
    body.temperature = 0.15;
    body.top_p = 0.95;
  }

  const res = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status} ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    output?: { type?: string; content?: { type?: string; text?: string }[] }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  // Équivalent de `response.output_text` du SDK Python : tous les textes produits, bout à bout.
  const content = (data.output ?? [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text ?? "")
    .join("");

  return {
    content,
    openai_tokens: {
      model: req.model,
      input_tokens: data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.output_tokens ?? 0,
    },
  };
}

async function callThroughPython(req: Gpt5Request): Promise<Gpt5Response> {
  const res = await fetch(`${BACKEND_URL}/openai-chat-5`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Python openai-chat-5 ${res.status}`);
  const data = (await res.json()) as Partial<Gpt5Response>;
  return { content: data.content ?? "", openai_tokens: data.openai_tokens };
}
