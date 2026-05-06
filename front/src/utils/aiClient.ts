import { fetchProxy } from "./fetchProxy";


export interface OpenAIOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: any;
}

export type OpenAIModelId = "gpt-4o" | "gpt-4o-mini" | "gpt-5.2" | "gpt-5.4-nano";
export type ReasoningDepth = "none" | "low" | "medium" | "high" | "xhigh"
export type Verbosity = "low" | "medium" | "high"


export async function callOpenAI(messages: { role: string; content: string }[], options: OpenAIOptions = {}) {
  const res = await fetchProxy('/api/openai-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, ...options })
  });
  if (!res.ok) {
    throw new Error(`OpenAI backend error ${res.status}`);
  }
  const data = await res.json();
  return data.content as string;
}


/**
 * Call les modèles GPT-5 via le backend Responses API.
 *
 * @param promptContent - le prompt prêt à être envoyé au model
 * @param reasoningDepth - Profondeur de recherche du model
 * @returns 
 */
export async function callOpenAi52(
  promptContent: string,
  reasoningDepth: ReasoningDepth,
  verbosity: Verbosity,
  model: Extract<OpenAIModelId, "gpt-5.2" | "gpt-5.4-nano"> = "gpt-5.2",
) {
  const r = await fetchProxy(`/api/openai-chat-5`, { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body : JSON.stringify({prompt:promptContent, reasoning:reasoningDepth, verbosity, model})
  })

  if(!r.ok) {
    throw new Error(`Echec lors de l'appel OpenAI ${model}, resStatus:${r.status}`)
  }
  const data = await r.json();
  return data.content as string
}



export async function callHuggingFace(model: string, inputs: string, parameters: any = {}) {
  const res = await fetchProxy('/api/huggingface-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, inputs, parameters })
  });
  if (!res.ok) {
    throw new Error(`HuggingFace backend error ${res.status}`);
  }
  const data = await res.json();
  return data.generated_text as string;
}
