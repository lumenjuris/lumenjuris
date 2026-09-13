/**
 * Création assistée d'un contrat « de zéro », façon juriste :
 *  1. questions de CADRAGE fermées (choix) qui déterminent la structure/options,
 *  2. rédaction du contrat avec des VARIABLES {{…}} pour les données factuelles.
 * Réutilise le client IA existant (proxy → /openai-chat-5).
 */
import { callOpenAi52 } from "../../../utils/aiClient";

export interface WizardQuestion {
  id: string;
  question: string;
  type: "choice" | "text";
  options?: string[];
  /** Exemple de réponse (question "text") ou explication courte (question "choice"). */
  hint?: string;
}

export interface DraftVariable {
  id: string;
  label: string;
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
 * Exigence transverse : chaque contrat généré comporte un article RGPD adapté.
 * C'est un marqueur de la spécialité de l'outil — jamais une clause générique.
 */
const EXIGENCE_RGPD =
  `EXIGENCE RGPD (systématique) : inclure un article dédié « Protection des données personnelles (RGPD) », ` +
  `concret et rattaché à l'objet de CE contrat : quelles données sont traitées, pour quelles finalités et sur ` +
  `quelles bases légales, durées de conservation, droits des personnes et point de contact, mesures de sécurité. ` +
  `Si une partie traite des données pour le compte de l'autre, refléter l'article 28 du RGPD (instructions ` +
  `documentées, confidentialité, sous-traitance ultérieure, assistance, sort des données en fin de contrat). ` +
  `Ne jamais omettre cet article, même si le besoin exprimé n'en parle pas. `;

/** Exigence transverse : rien de contraire au droit français dans le texte produit. */
const EXIGENCE_LICEITE =
  `Le contrat doit être conforme au droit français en vigueur : n'insère aucune clause illicite, ` +
  `réputée non écrite ou contraire à une règle d'ordre public. `;

/**
 * Questions sur le CONTENU du contrat (ses règles, ses clauses), posées à un
 * professionnel qui n'est pas juriste. Les informations factuelles (noms,
 * dates, montants) n'y figurent pas : ce sont des champs à remplir dans
 * l'éditeur.
 */
export async function generateContractQuestions(title: string): Promise<WizardQuestion[]> {
  const prompt =
    `Tu aides un professionnel à préparer un contrat de type « ${title.trim()} ». Il n'est PAS juriste : ` +
    `dirigeant, commerçant, indépendant, responsable RH… ` +
    `Pose-lui les 4 à 7 questions qui décident du CONTENU de CE contrat : les règles et les clauses qui ` +
    `changent vraiment d'un contrat de ce type à l'autre (ex. selon le contrat : comment le paiement est ` +
    `organisé, ce qui se passe en cas de retard, comment et à quelles conditions on peut y mettre fin, qui ` +
    `est responsable en cas de problème, exclusivité, confidentialité, propriété de ce qui est produit, ` +
    `renouvellement…). Choisis celles qui comptent le plus pour CE type de contrat précis. ` +
    `INTERDIT : toute question qui demande une information à saisir — nom ou identité d'une partie, adresse, ` +
    `date, montant, prix, durée chiffrée, nombre. Ces informations seront des champs à remplir dans l'éditeur ` +
    `et ne doivent JAMAIS faire l'objet d'une question. ` +
    `LANGAGE : des mots de tous les jours, des phrases courtes, une seule idée par question, vouvoiement. ` +
    `Aucun jargon juridique ; si un terme juridique est vraiment indispensable, explique-le en quelques mots ` +
    `entre parenthèses. ` +
    `FORMAT : "type":"choice", avec 2 à 4 options courtes, concrètes et mutuellement exclusives qui disent ` +
    `la conséquence pratique de chaque choix ; le "hint" explique en une phrase simple à quoi sert la ` +
    `question (ou reste vide si c'est évident). ` +
    `RÈGLE ABSOLUE SUR LES OPTIONS : chaque option proposée doit être LICITE en droit français. Ne propose JAMAIS ` +
    `une option contraire à une règle d'ordre public ou manifestement illégale (par exemple : durée ou renouvellement ` +
    `d'essai au-delà des maxima légaux, clause de non-concurrence sans contrepartie financière, délai de paiement ` +
    `au-delà du plafond légal, renonciation à un droit auquel on ne peut pas renoncer). Quand la loi fixe un plafond ` +
    `ou un plancher, toutes les options restent dans les limites légales et la plus proche de la limite le rappelle ` +
    `(ex. « 2 mois — le maximum autorisé »). ` +
    `Réponds UNIQUEMENT en JSON : un tableau de 4 à 7 objets ` +
    `{"question": string, "type": "choice", "hint": string, "options": [string, …]}. Aucun texte hors JSON. ` +
    `Exemples de forme (le contenu doit être adapté au contrat demandé, pas recopié) : ` +
    `{"question":"Comment serez-vous payé ?","type":"choice","hint":"","options":["Chaque mois, sur facture","En une fois, à la fin de la mission","Un acompte au départ, le reste à la fin"]} ` +
    `{"question":"Le client peut-il arrêter le contrat avant la fin ?","type":"choice","hint":"Cela fixe ce qui se passe si l'un de vous veut s'arrêter en cours de route.","options":["Oui, à tout moment, avec un préavis","Oui, mais seulement en cas de faute grave","Non, le contrat va jusqu'à son terme"]}.`;
  const out = await callOpenAi52(prompt, "high", "low", "gpt-5.4-nano");
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
              const o = v as { id?: unknown; label?: unknown };
              const id = typeof o.id === "string" ? o.id.trim() : "";
              return id ? { id, label: typeof o.label === "string" && o.label.trim() ? o.label.trim() : id } : null;
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

/**
 * Bloc d'instructions décrivant les parties connues. Ces données sont ecrites
 * en toutes lettres dans le contrat : inutile d'en faire des variables a
 * remplir, elles sont deja renseignees.
 */
function blocParties(parties: PartyIdentity[] = []): string {
  const connues = parties.filter((p) => p.nom?.trim());
  if (connues.length === 0) return "";

  const fiches = connues
    .map((p) => {
      const lignes: string[] = [];
      const ajoute = (label: string, v?: string | null) => {
        if (v?.trim()) lignes.push(`  ${label} : ${v.trim()}`);
      };
      ajoute("Dénomination", p.nom);
      ajoute("Forme juridique", p.forme_juridique);
      ajoute("SIREN", p.siren);
      ajoute("Ville", p.ville);
      ajoute("Code postal", p.code_postal);
      ajoute("Greffe RCS", p.rcs_ville);
      ajoute("Représentant", p.representant);
      ajoute("Qualité du représentant", p.qualite);
      return `- ${p.role} :\n${lignes.join("\n")}`;
    })
    .join("\n");

  return (
    `PARTIES DÉJÀ IDENTIFIÉES — reprends ces informations telles quelles dans le préambule ` +
    `et partout où la partie est désignée. Ne crée AUCUNE variable {{…}} pour une donnée ` +
    `figurant ci-dessous : elle est connue, écris-la en clair. Les données absentes de cette ` +
    `liste (capital, adresse précise…) restent, elles, des variables.\n${fiches}\n\n`
  );
}

/** Format de sortie commun aux deux modes de rédaction. */
const FORMAT_JSON_CONTRAT =
  `Emploie des VARIABLES au format {{snake_case}} pour TOUTES les données factuelles à remplir ` +
  `(parties, adresses, dates, montants…). ` +
  `Réponds UNIQUEMENT en JSON : ` +
  `{"title": string en MAJUSCULES, "variables": [{"id": "snake_case", "label": "Libellé lisible"}], ` +
  `"sections": [{"heading": "Article 1 – …", "content": "… {{variable}} …"}]}. ` +
  `Inclure un préambule (heading « Préambule ») et une dernière section « Signatures ». ` +
  `Chaque variable utilisée dans un content DOIT figurer dans "variables". Aucun texte hors JSON.`;

/** Rédige le contrat structuré, avec variables {{…}}, à partir des réponses au questionnaire. */
export async function generateContractDraft(
  title: string,
  answers: { question: string; answer: string }[],
  parties: PartyIdentity[] = [],
): Promise<ContractDraft> {
  const choices = answers.map((a) => `- ${a.question} → ${a.answer.trim() || "(non renseigné)"}`).join("\n");
  const prompt =
    `Tu es un juriste français. Rédige un contrat de type « ${title.trim()} » conforme et structuré, ` +
    `en tenant compte des réponses suivantes du client :\n${choices}\n\n` +
    `Exception à la règle des variables ci-dessous : écris EN CLAIR dans le contrat les informations ` +
    `factuelles données dans ces réponses (noms, montants, dates, durées). Seules les réponses ` +
    `« (non renseigné) » et les données absentes deviennent des variables {{…}} à compléter. Pour un ` +
    `choix non renseigné, retiens l'option la plus usuelle et la plus équilibrée.\n\n` +
    blocParties(parties) +
    EXIGENCE_LICEITE + EXIGENCE_RGPD + FORMAT_JSON_CONTRAT;
  const out = await callOpenAi52(prompt, "medium", "medium", "gpt-5.2");
  return parseDraft(out, title);
}

export interface BriefAttachment {
  name: string;
  text: string;
}

/**
 * Mode « je décris, l'outil se débrouille » : rédige le contrat directement
 * depuis un besoin exprimé librement, en s'adaptant aux pièces jointes fournies
 * (texte extrait de PDF/Word). L'IA tranche elle-même les arbitrages, en
 * retenant l'option usuelle la plus protectrice.
 */
export async function generateContractDraftFromBrief(
  title: string,
  brief: string,
  attachments: BriefAttachment[] = [],
  parties: PartyIdentity[] = [],
): Promise<ContractDraft> {
  const docs = attachments
    .filter((a) => a.text.trim())
    .map((a) => {
      const text = a.text.trim();
      const excerpt = text.slice(0, 6000);
      const truncated = text.length > 6000 ? "\n[… document tronqué : seul le début est fourni]" : "";
      return `--- Pièce jointe « ${a.name} » ---\n${excerpt}${truncated}`;
    })
    .join("\n\n");
  const prompt =
    `Tu es un juriste français. Rédige un contrat de type « ${title.trim()} », complet et directement ` +
    `utilisable, à partir du besoin exprimé ci-dessous par un professionnel qui n'a pas le temps de ` +
    `détailler. Prends toi-même toutes les décisions de structure et de clauses qu'il n'a pas précisées, ` +
    `en retenant à chaque fois l'option la plus usuelle et la plus équilibrée en pratique française.\n\n` +
    `BESOIN EXPRIMÉ :\n${brief.trim()}\n\n` +
    (docs
      ? `PIÈCES JOINTES — adapte le contrat à leur contenu : reprends les informations et le contexte ` +
        `utiles, reste cohérent avec elles, et signale par une variable {{…}} toute donnée qu'elles ne ` +
        `fournissent pas :\n${docs}\n\n`
      : "") +
    blocParties(parties) +
    EXIGENCE_LICEITE + EXIGENCE_RGPD + FORMAT_JSON_CONTRAT;
  // Profondeur "medium" et non "high" : la redaction depuis une consigne libre
  // attendait nettement plus longtemps que le parcours par questions, pour un
  // resultat comparable — ce dernier redige deja en "medium". Le gain de temps
  // est immediat ; a reevaluer si la qualite des contrats produits baisse.
  const out = await callOpenAi52(prompt, "medium", "medium", "gpt-5.2");
  return parseDraft(out, title);
}
