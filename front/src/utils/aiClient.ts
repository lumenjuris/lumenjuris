import { fetchProxy } from "./fetchProxy";

/** Modèles IA que l'utilisateur peut choisir (ex : analyse de clause dans l'analyzer). */
export type OpenAIModelId =
  | "gpt-4o"
  | "gpt-4o-mini"
  | "gpt-5.2"
  | "gpt-5.4-nano";

/**
 * Appelle une aide IA du proxy (/api/assistant/<route>). Le proxy construit le
 * prompt à partir des données envoyées : aucun prompt n'est écrit dans le front.
 *
 * @param route - nom de l'aide (ex : "cdd-clause", "reformulate-clause")
 * @param data - données utiles à l'aide (texte, consigne…)
 * @returns le texte produit par l'IA
 */
export async function callAssistant(route: string, data: object): Promise<string> {
  const res = await fetchProxy(`/api/assistant/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = (await res.json().catch(() => ({}))) as { content?: string; detail?: string };
  if (!res.ok) {
    throw new Error(body.detail || `Echec de l'aide IA ${route}, resStatus:${res.status}`);
  }
  return body.content ?? "";
}
