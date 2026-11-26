import {
  AnalysisContext,
  ClauseAI,
  ClauseRisk,
  ContractDraft,
  DraftVariable,
  ImportanceChamp,
  JurisprudenceCase,
  Recommendation,
  WizardQuestion,
} from "./types";

/* global localStorage, fetch, window, Response, setTimeout, Office */

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

/** Quota de l'offre épuisé (HTTP 402) — ex. contrats générés. */
export class QuotaExceededError extends Error {}

/**
 * Origine des appels : lue par le proxy (middleware clientSource) pour
 * distinguer dans le suivi d'usage ce qui vient du complément Word.
 */
const CLIENT_SOURCE_HEADER = { "x-lumen-client": "word-addin" };

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);



async function post<T>(endpoint: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...CLIENT_SOURCE_HEADER };
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
  if (response.status === 402) {
    const data = (await response.json().catch(() => ({}))) as { message?: string };
    throw new QuotaExceededError(
      data.message || "Quota de votre offre épuisé. Passez à un plan supérieur sur app.lumenjuris.com."
    );
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
  const data = await post<{ success: boolean; token?: string; message?: string }>("/api/addin/session", {
    email,
    password,
  });
  if (!data.success || !data.token) throw new Error(data.message || "Connexion refusée");
  localStorage.setItem(TOKEN_KEY, data.token);
}

/**
 * Connexion via Google ou Microsoft. Les pages de connexion de ces fournisseurs
 * refusent l'iframe du volet : on les ouvre dans une fenêtre de dialogue Office
 * (auth-dialog.html), qui renvoie le JWT par messageParent une fois connecté.
 */
export function loginWithProvider(provider: "google" | "microsoft"): Promise<void> {
  return new Promise((resolve, reject) => {
    // Hors de Word (taskpane.html ouvert directement dans un navigateur),
    // Office.context.ui n'existe pas : la fenêtre de dialogue est impossible.
    if (typeof Office === "undefined" || !Office.context || !Office.context.ui) {
      reject(new Error("La connexion Google / Microsoft ne fonctionne que dans Word (pas dans un navigateur seul)."));
      return;
    }
    // Relatif à taskpane.html : fonctionne en local (racine) et en prod (/word-addin/).
    const url = new URL(`auth-dialog.html?provider=${provider}`, window.location.href).toString();
    Office.context.ui.displayDialogAsync(url, { height: 70, width: 40, promptBeforeOpen: false }, (result) => {
      if (result.status === Office.AsyncResultStatus.Failed) {
        reject(new Error(`Impossible d'ouvrir la fenêtre de connexion (${result.error.message}).`));
        return;
      }
      const dialog = result.value;
      dialog.addEventHandler(Office.EventType.DialogMessageReceived, (arg) => {
        dialog.close();
        let data: { token?: string | null; error?: string | null } = {};
        try {
          data = JSON.parse((arg as { message: string }).message);
        } catch {
          /* message illisible */
        }
        if (data.token) {
          localStorage.setItem(TOKEN_KEY, data.token);
          resolve();
        } else if (data.error === "banned") {
          reject(new Error("Ce compte est suspendu. Contactez le support Lumen Juris."));
        } else {
          reject(new Error("La connexion a échoué. Réessayez ou utilisez votre e-mail et mot de passe."));
        }
      });
      dialog.addEventHandler(Office.EventType.DialogEventReceived, (arg) => {
        // 12006 = fenêtre fermée par l'utilisateur ; 12002 = page introuvable ;
        // 12003 = redirection vers une page HTTP (HTTPS obligatoire).
        const code = (arg as { error?: number }).error;
        reject(
          new Error(
            code === 12006
              ? "Connexion annulée."
              : `La fenêtre de connexion a rencontré une erreur (code ${code}).`
          )
        );
      });
    });
  });
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


/* ================================================================
 * Génération de contrat « de zéro » — mêmes routes et même lecture
 * des réponses que la plateforme (front/generateur/contractAi.ts).
 * Les prompts sont construits par le proxy, jamais ici.
 * ================================================================ */

async function callGenerator(route: "generate-questions" | "generate-draft", body: object): Promise<string> {
  const data = await post<{ content?: string }>(`/api/template/${route}`, body);
  return data.content ?? "";
}

/** Isole le premier bloc JSON ([...] ou {...}) d'une réponse potentiellement bavarde. */
function extractJson(s: string): string {
  const openArr = s.indexOf("[");
  const closeArr = s.lastIndexOf("]");
  const openObj = s.indexOf("{");
  const closeObj = s.lastIndexOf("}");
  if (openArr !== -1 && (openObj === -1 || openArr < openObj) && closeArr > openArr) {
    return s.slice(openArr, closeArr + 1);
  }
  if (openObj !== -1 && closeObj > openObj) return s.slice(openObj, closeObj + 1);
  return s;
}

function lireImportance(v: unknown): ImportanceChamp | undefined {
  const s =
    typeof v === "string"
      ? v.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      : "";
  return s === "obligatoire" || s === "recommande" || s === "optionnel" ? s : undefined;
}

let qCounter = 0;

/** Étape 1 : questions de cadrage (gratuit, sans quota). */
export async function generateContractQuestions(title: string): Promise<WizardQuestion[]> {
  const out = await callGenerator("generate-questions", { title });
  let arr: unknown;
  try {
    arr = JSON.parse(extractJson(out));
  } catch {
    arr = null;
  }
  if (!Array.isArray(arr)) throw new Error("Questions illisibles");
  const questions = (arr as unknown[])
    .map((raw): WizardQuestion | null => {
      const o = raw as { question?: unknown; type?: unknown; options?: unknown; hint?: unknown };
      const question = typeof o.question === "string" ? o.question.trim() : "";
      if (!question) return null;
      const options = Array.isArray(o.options) ? o.options.map((x) => String(x).trim()).filter(Boolean) : [];
      const type: "choice" | "text" = o.type === "text" || options.length === 0 ? "text" : "choice";
      const hint = typeof o.hint === "string" && o.hint.trim() ? o.hint.trim() : undefined;
      qCounter += 1;
      return { id: `q${qCounter}`, question, type, hint, options: type === "choice" ? options.slice(0, 4) : undefined };
    })
    .filter((q): q is WizardQuestion => q !== null)
    .slice(0, 8);
  if (questions.length === 0) throw new Error("Aucune question générée");
  return questions;
}

function parseDraft(out: string, title: string): ContractDraft {
  try {
    const j = JSON.parse(extractJson(out)) as { title?: unknown; variables?: unknown; sections?: unknown };
    if (j && Array.isArray(j.sections)) {
      const variables = Array.isArray(j.variables)
        ? (j.variables as unknown[])
            .map((v): DraftVariable | null => {
              const o = v as { id?: unknown; label?: unknown; importance?: unknown };
              const id = typeof o.id === "string" ? o.id.trim() : "";
              if (!id) return null;
              const label = typeof o.label === "string" && o.label.trim() ? o.label.trim() : id;
              const importance = lireImportance(o.importance);
              return importance ? { id, label, importance } : { id, label };
            })
            .filter((v): v is DraftVariable => v !== null)
        : [];
      const sections = (j.sections as unknown[])
        .map((sec) => {
          const o = sec as { heading?: unknown; content?: unknown };
          return {
            heading: typeof o.heading === "string" && o.heading.trim() ? o.heading.trim() : undefined,
            content: String(o.content ?? "").trim(),
          };
        })
        .filter((sec) => sec.content);
      if (sections.length > 0) {
        return {
          title: typeof j.title === "string" && j.title.trim() ? j.title.trim() : title.toUpperCase(),
          variables,
          sections,
        };
      }
    }
  } catch {
    /* repli ci-dessous */
  }
  return { title: title.toUpperCase(), variables: [], sections: [{ content: out.trim() }] };
}

/** Étape 2 (parcours guidé) : rédaction depuis les réponses. 1 rédaction = 1 crédit. */
export async function generateContractDraft(
  title: string,
  answers: { question: string; answer: string }[],
  includeRgpd = true
): Promise<ContractDraft> {
  const out = await callGenerator("generate-draft", { mode: "questions", title, answers, parties: [], includeRgpd });
  return parseDraft(out, title);
}

/** Étape 2 (« Générer maintenant ») : rédaction directe depuis l'intitulé. 1 rédaction = 1 crédit. */
export async function generateContractDraftFromBrief(
  title: string,
  brief: string,
  includeRgpd = true
): Promise<ContractDraft> {
  const out = await callGenerator("generate-draft", {
    mode: "brief",
    title,
    brief: brief.trim() || title,
    attachments: [],
    parties: [],
    includeRgpd,
  });
  return parseDraft(out, title);
}
