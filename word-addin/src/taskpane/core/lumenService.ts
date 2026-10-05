import { AnalysisContext, ClauseAI, ClauseRisk, JurisprudenceCase, Recommendation } from "./types";

/* global localStorage, fetch, window, Response, setTimeout */

/**
 * Client des endpoints LumenJuris — les MÊMES routes que la page « Analyse
 * des risques » de la plateforme :
 *  - POST /api/addin/login       → JWT (Bearer) pour le complément
 *  - POST /api/analyzer/analyze-contract  → ClauseRisk[] (analyse IA du proxy)
 *  - POST /api/analyzer/recommend-clause  → recommandations alternatives
 *  - POST /api/legal-text/jurisprudence   → recherche hybride (backend Python)
 *  - POST /api/assistant/addin-clause-detail → détail clause (issues/advice)
 *  - POST /api/assistant/addin-question      → question libre sur une clause
 *    (les prompts sont construits par le proxy, jamais ici)
 *
 * Auth : l'iframe Word ne reçoit pas le cookie httpOnly `authLumenJuris`,
 * le proxy accepte donc aussi `Authorization: Bearer <jwt>` (voir
 * proxy/src/middleware/authMiddleware.ts).
 */

// En local (développement), on parle au proxy lancé sur la machine (port 3000).
// En ligne, on parle au proxy du site actuel app.lumenjuris.com : les comptes
// des utilisateurs (et le compte de test fourni à Microsoft) sont dans sa base.
export const PROXY_BASE =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:3000"
    : "https://app.proxy.lumenjuris.com";

/**
 * Réveille le serveur dès l'ouverture du volet : l'hébergeur l'endort après
 * quelques minutes sans visite et le réveil prend jusqu'à 15 secondes. Ainsi,
 * la connexion qui suit ne paie pas cette attente.
 */
export function wakeServer(): void {
  fetch(`${PROXY_BASE}/health`).catch(() => {
    /* best-effort */
  });
}

const TOKEN_KEY = "lumen-addin-token";

export class AuthError extends Error {}

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

async function post<T>(endpoint: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // Toutes les routes métier exigent l'authentification en production :
  // le Bearer est envoyé dès qu'une session existe (login obligatoire côté UI).
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const send = () => fetch(`${PROXY_BASE}${endpoint}`, { method: "POST", headers, body: JSON.stringify(body) });
  let response: Response;
  try {
    response = await send();
  } catch {
    // Échec réseau (serveur en train de se réveiller, coupure brève) : un
    // second essai après une courte pause avant d'afficher l'erreur.
    await new Promise((resolve) => setTimeout(resolve, 2500));
    try {
      response = await send();
    } catch {
      throw new Error(
        "Serveur Lumen Juris injoignable. Vérifiez votre connexion internet puis réessayez."
      );
    }
  }
  if (response.status === 401) {
    clearToken();
    const data = (await response.json().catch(() => ({}))) as { message?: string };
    throw new AuthError(data.message || "Session expirée — reconnectez-vous.");
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = "";
    try {
      message = (JSON.parse(text) as { message?: string }).message || "";
    } catch {
      /* réponse non JSON */
    }
    throw new Error(message || `${endpoint} → ${response.status} ${text.slice(0, 200)}`);
  }
  return (await response.json()) as T;
}

/** Connexion avec les identifiants de la plateforme LumenJuris. */
export async function login(email: string, password: string): Promise<void> {
  const data = await post<{ success: boolean; token?: string; message?: string }>("/api/addin/login", {
    email,
    password,
  });
  if (!data.success || !data.token) throw new Error(data.message || "Connexion refusée");
  localStorage.setItem(TOKEN_KEY, data.token);
}

/** Contexte par défaut (mêmes valeurs que le formulaire plateforme). */
export const DEFAULT_CONTEXT: AnalysisContext = {
  contractType: "",
  userRole: "",
  specificQuestions: "",
  analysisDepth: "detailed",
  interestOrientation: "balanced",
  mission: "",
  legalRegime: "",
  contractObjective: "",
};

/**
 * Détection IA du contrat pour pré-remplir le formulaire d'analyse —
 * même route que la plateforme (`detectContractWithAI`).
 */
export async function detectContract(text: string): Promise<Partial<AnalysisContext>> {
  return post<Partial<AnalysisContext>>("/api/analyzer/detect-contract", { text });
}

/** Analyse du document — même payload que ContractAnalysis.tsx. */
export async function analyzeContract(content: string, context: AnalysisContext): Promise<ClauseRisk[]> {
  const data = await post<{ success: boolean; clauses: ClauseRisk[] }>("/api/analyzer/analyze-contract", {
    content,
    context,
  });
  return (data.clauses ?? []).map((clause, i) => ({
    ...clause,
    id: clause.id || `clause-${i}`,
  }));
}

/** Recommandations alternatives — même route que la modale plateforme. */
export async function fetchRecommendations(
  clause: ClauseRisk,
  context?: AnalysisContext
): Promise<Recommendation[]> {
  const data = await post<
    | { title?: string; clauseText: string; benefits?: string; riskReduction?: string }[]
    | { recommendations?: { title?: string; clauseText: string; benefits?: string; riskReduction?: string }[] }
  >("/api/analyzer/recommend-clause", { clause, context });
  const items = Array.isArray(data) ? data : (data.recommendations ?? []);
  return items
    .filter((r) => r && r.clauseText)
    .map((r) => ({
      title: r.title ?? "",
      clauseText: r.clauseText,
      benefits: r.benefits ?? "",
      riskReduction: r.riskReduction ?? "",
    }));
}

/* ------------------- Jurisprudence (repris de getAutomaticDecisions.ts) ------------------- */

const STOPWORDS = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "d'un", "d'une", "et", "ou",
  "en", "au", "aux", "ce", "cette", "ces", "qui", "que", "dont", "pour", "par",
  "sur", "dans", "avec", "sans", "est", "sont", "être", "peut", "il", "elle",
  "ne", "pas", "plus", "très", "son", "sa", "ses", "leur", "leurs", "cela",
  "clause", "contrat", "risque", "juridique",
]);

function significantTerms(text: string, max: number): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-zà-öø-ÿ0-9\s-]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    .slice(0, max);
}

function buildJurisprudenceQueries(clause: ClauseRisk): string[] {
  const kw = (clause.keywords ?? []).filter(Boolean);
  const queries: string[] = [];
  const q1 = [clause.type, ...kw.slice(0, 2)].filter(Boolean).join(" ").trim();
  if (q1) queries.push(q1);
  const q2 = kw.slice(1, 5).join(" ").trim();
  if (q2 && q2 !== q1) queries.push(q2);
  const q3 = [clause.type, ...significantTerms(clause.justification, 4)].join(" ").trim();
  if (q3 && !queries.includes(q3)) queries.push(q3);
  return queries.slice(0, 3);
}

function buildJurisprudenceContext(clause: ClauseRisk): string {
  const ref = Array.isArray(clause.legalReference) ? clause.legalReference.join(", ") : clause.legalReference;
  return [
    `Type de clause : ${clause.type}.`,
    `Problème juridique identifié : ${clause.justification}`,
    ref ? `Références légales : ${ref}.` : "",
    `Clause : ${clause.content.slice(0, 800)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Recherche hybride de jurisprudence — même flux que la plateforme. */
export async function fetchJurisprudence(clause: ClauseRisk): Promise<JurisprudenceCase[]> {
  const queries = buildJurisprudenceQueries(clause);
  if (queries.length === 0) return [];
  const data = await post<Record<string, unknown>[]>("/api/legal-text/jurisprudence", {
    queries,
    context: buildJurisprudenceContext(clause),
  });
  if (!Array.isArray(data)) return [];
  return data.map((item: Record<string, unknown>, i) => ({
    id: (item.url as string) || `case-${i}`,
    title: (item.title as string) || "",
    url: (item.url as string) || "",
    summary: (item.summary as string) || "",
    court: (item.court as string) || "",
    year: item.year as number | undefined,
    relevanceScore: (item.relevanceScore as number) || 0.8,
    citation: item.citation as string | undefined,
    date: item.date as string | undefined,
    keyPrinciples: item.keyPrinciples as string[] | undefined,
    litige: item.litige as string | undefined,
    resultat: item.resultat as string | undefined,
  }));
}

/* ------------------- Détail clause & question (proxy /api/assistant) ------------------- */

/** Appelle une aide IA du proxy : le proxy construit le prompt à partir des données. */
async function callAssistant(route: string, data: unknown): Promise<string> {
  const response = await post<{ content?: string }>(`/api/assistant/${route}`, data);
  return response.content ?? "";
}

const parseClauseAI = (txt: string): ClauseAI =>
  JSON.parse(
    (txt || "{}")
      .trim()
      .replace(/^[\s\S]*?({)/, "$1")
      .replace(/```(?:json)?|```/gi, "")
  );

/** Détail IA d'une clause (prompt construit par le proxy). */
export async function fetchClauseDetail(clause: ClauseRisk): Promise<ClauseAI> {
  return parseClauseAI(await callAssistant("addin-clause-detail", { clauseText: clause.content }));
}

/** Question libre sur une clause (équivalent ChatUI de la modale). */
export async function askQuestion(clause: ClauseRisk, question: string): Promise<string> {
  return callAssistant("addin-question", {
    clauseText: clause.content,
    clauseType: clause.type,
    justification: clause.justification,
    question,
  });
}
