/**
 * Création assistée d'un contrat « de zéro », façon juriste :
 *  1. questions de CADRAGE fermées (choix) qui déterminent la structure/options,
 *  2. rédaction du contrat avec des VARIABLES {{…}} pour les données factuelles.
 * Les prompts sont construits par le proxy (services/generateur/scratchPrompts.ts),
 * jamais ici : le front n'envoie que des données et lit les réponses de l'IA.
 */
import { fetchProxy } from "../../../utils/fetchProxy";
import { QuotaExceededError } from "../../../utils/featureQuota";

// Ré-export pour les consommateurs historiques (ScratchFlow) qui l'importaient ici.
export { QuotaExceededError };

/**
 * Appelle une route du générateur (proxy /api/template/…) et renvoie le texte
 * produit par l'IA. Lève QuotaExceededError si le quota est épuisé (402).
 */
async function callGenerator(route: string, body: object): Promise<string> {
  const res = await fetchProxy(`/api/template/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 402) {
    await res.json().catch(() => ({}));
    throw new QuotaExceededError("generatorFromScratch");
  }
  if (!res.ok) throw new Error(`Echec de la génération du contrat, status:${res.status}`);
  const data = await res.json();
  return data.content as string;
}

export interface WizardQuestion {
  id: string;
  question: string;
  type: "choice" | "text";
  options?: string[];
  /** Exemple de réponse (question "text") ou explication courte (question "choice"). */
  hint?: string;
}

/** Importance d'un champ à remplir : pilote l'affichage (optionnels repliés). */
export type ImportanceChamp = "obligatoire" | "recommande" | "optionnel";

export interface DraftVariable {
  id: string;
  label: string;
  importance?: ImportanceChamp;
}

function lireImportance(v: unknown): ImportanceChamp | undefined {
  const s = typeof v === "string" ? v.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") : "";
  return s === "obligatoire" || s === "recommande" || s === "optionnel" ? s : undefined;
}
export interface DraftSection {
  heading?: string;
  content: string;
}
export interface ContractDraft {
  title: string;
  variables: DraftVariable[];
  sections: DraftSection[];
}

/** Isole le premier bloc JSON ([...] ou {...}) d'une réponse potentiellement bavarde. */
function extractJson(s: string): string {
  const openArr = s.indexOf("[");
  const closeArr = s.lastIndexOf("]");
  const openObj = s.indexOf("{");
  const closeObj = s.lastIndexOf("}");
  // Choisit le conteneur qui commence le plus tôt.
  if (openArr !== -1 && (openObj === -1 || openArr < openObj) && closeArr > openArr) {
    return s.slice(openArr, closeArr + 1);
  }
  if (openObj !== -1 && closeObj > openObj) return s.slice(openObj, closeObj + 1);
  return s;
}

let qCounter = 0;

/**
 * Questions sur le CONTENU du contrat (ses règles, ses clauses), posées à un
 * professionnel qui n'est pas juriste. Les informations factuelles (noms,
 * dates, montants) n'y figurent pas : ce sont des champs à remplir dans
 * l'éditeur.
 */
export async function generateContractQuestions(title: string): Promise<WizardQuestion[]> {
  const out = await callGenerator("generate-questions", { title });
  let arr: unknown;
  try { arr = JSON.parse(extractJson(out)); } catch { arr = null; }
  if (!Array.isArray(arr)) throw new Error("Questions illisibles");
  const questions = (arr as unknown[])
    .map((raw): WizardQuestion | null => {
      const o = raw as { question?: unknown; type?: unknown; options?: unknown; hint?: unknown };
      const question = typeof o.question === "string" ? o.question.trim() : "";
      if (!question) return null;
      const options = Array.isArray(o.options)
        ? o.options.map((x) => String(x).trim()).filter(Boolean)
        : [];
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
    const j = JSON.parse(extractJson(out)) as {
      title?: unknown; variables?: unknown; sections?: unknown;
    };
    if (j && Array.isArray(j.sections)) {
      const variables = Array.isArray(j.variables)
        ? (j.variables as unknown[])
            .map((v) => {
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
        .map((s) => {
          const o = s as { heading?: unknown; content?: unknown };
          return {
            heading: typeof o.heading === "string" && o.heading.trim() ? o.heading.trim() : undefined,
            content: String(o.content ?? "").trim(),
          };
        })
        .filter((s) => s.content);
      if (sections.length > 0) {
        return {
          title: typeof j.title === "string" && j.title.trim() ? j.title.trim() : title.toUpperCase(),
          variables,
          sections,
        };
      }
    }
  } catch { /* repli ci-dessous */ }
  return { title: title.toUpperCase(), variables: [], sections: [{ content: out.trim() }] };
}

/**
 * Identité d'une partie, telle que renvoyée par la recherche d'entreprise
 * (base publique SIREN/SIRET) ou saisie à la main.
 */
export interface PartyIdentity {
  role: string;
  nom?: string | null;
  forme_juridique?: string | null;
  siren?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  rcs_ville?: string | null;
  representant?: string | null;
  qualite?: string | null;
}

/** Rédige le contrat structuré, avec variables {{…}}, à partir des réponses au questionnaire. */
export async function generateContractDraft(
  title: string,
  answers: { question: string; answer: string }[],
  parties: PartyIdentity[] = [],
  includeRgpd = true,
): Promise<ContractDraft> {
  const out = await callGenerator("generate-draft", { mode: "questions", title, answers, parties, includeRgpd });
  return parseDraft(out, title);
}

export interface BriefAttachment {
  name: string;
  text: string;
}

/**
 * Mode « je décris, l'outil se débrouille » : rédige le contrat directement
 * depuis un besoin exprimé librement et les pièces jointes fournies (texte
 * extrait de PDF/Word).
 */
export async function generateContractDraftFromBrief(
  title: string,
  brief: string,
  attachments: BriefAttachment[] = [],
  parties: PartyIdentity[] = [],
  includeRgpd = true,
): Promise<ContractDraft> {
  const out = await callGenerator("generate-draft", { mode: "brief", title, brief, attachments, parties, includeRgpd });
  return parseDraft(out, title);
}
