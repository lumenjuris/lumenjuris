import { Router, type Request, type Response } from "express";
import { proxyAuthMiddleware as auth } from "../middleware/authMiddleware.js";
import { BACKEND_URL, BACKNODE_URL } from "../config.js";
import { relayToNode } from "../relay.js";
import { logOpenAiTokens, trackFeature } from "../tracking.js";

// Chemin relatif /api/template" 
export const templateRouter: Router = Router();








// ─── Routes ────────────────────────────────────────────────────────────────────
const id = (req: Request) => encodeURIComponent(req.params.externalId as string);

templateRouter.post("/import", auth, handleTemplateImport);

templateRouter.get("/", auth, (req, res) => relayToNode(req, res, "/template"));
templateRouter.get("/:externalId", auth, (req, res) =>
  relayToNode(req, res, `/template/${id(req)}`),
);
templateRouter.put("/:externalId", auth, (req, res) =>
  relayToNode(req, res, `/template/${id(req)}`),
);
templateRouter.delete("/:externalId", auth, (req, res) =>
  relayToNode(req, res, `/template/${id(req)}`),
);
templateRouter.get("/:externalId/playbook", auth, (req, res) =>
  relayToNode(req, res, `/template/${id(req)}/playbook`),
);
templateRouter.put("/:externalId/playbook", auth, (req, res) =>
  relayToNode(req, res, `/template/${id(req)}/playbook`),
);
templateRouter.post("/:externalId/generate", auth, handleTemplateGenerate);


// Création directe d'un modèle (structure déjà prête, sans structuration IA) —
// utilisée par la génération « de zéro » pour préenregistrer le contrat en
// bibliothèque de modèles.
// Le router est monté sur "/api/template" (voir proxy/index.ts), donc ce chemin
// relatif "/" correspond bien à POST /api/template attendu par le front.
templateRouter.post("/", auth, (req, res) => {
  void trackFeature("import_template", res.locals.userId as number | undefined);
  relayToNode(req, res, "/template");
});







// ─── Génération d'un contrat à partir d'un modèle ──────────────────────────────

const GENERATE_PROMPT_BASE = `Tu es un juriste expert en droit français. À partir du modèle de contrat ci-dessous (dont les variables ont déjà été remplacées par les valeurs fournies par le juriste), produis le contrat final en respectant SCRUPULEUSEMENT ces règles :
- PRIORITÉ ABSOLUE aux CONSIGNES & CLAUSES SPÉCIFIQUES : intègre-les IMPÉRATIVEMENT et INTÉGRALEMENT dans le contrat, même si elles ne figurent pas dans le modèle. Si une consigne fournit le texte d'une clause, insère ce texte fidèlement (en l'adaptant uniquement pour la cohérence rédactionnelle et les accords).
- En cas de CONFLIT entre le modèle et une consigne, la CONSIGNE PRÉVAUT sur le modèle.
- Place chaque clause spécifique à l'endroit juridiquement pertinent du contrat (bon article/section), en renumérotant si besoin.
- Conserve le langage juridique formel et les références légales du texte source.
- Adapte les accords grammaticaux (genre, nombre, conjugaisons) pour un rendu cohérent.
- N'invente AUCUNE clause qui ne soit ni dans le modèle ni dans les consignes.
- Réponds UNIQUEMENT avec le texte final du contrat en français, sans markdown, sans préambule explicatif.`;

/**
 * Substitue les marqueurs <<NAME|original>> et {{NAME}} (legacy)
 * dans le contenu, par les valeurs fournies par l'utilisateur.
 * Si une valeur n'est pas fournie, conserve le texte original (ou le marqueur legacy).
 */
function substituteMarkers(
  content: string,
  variables: Record<string, string>,
): string {
  // Format actuel : <<NAME|original text>>
  let out = content.replace(
    /<<([A-Z0-9_]+)\|([\s\S]*?)>>/g,
    (_match, name: string, original: string) => {
      const val = variables[name];
      return val && val.trim() ? val : original;
    },
  );
  // Compat ancien format : {{NAME}}
  out = out.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, name: string) => {
    const val = variables[name];
    return val && val.trim() ? val : match;
  });
  return out;
}




async function handleTemplateGenerate(
  req: Request,
  res: Response,
): Promise<void> {
  const externalId = req.params.externalId as string;
  const { variables, playbook } = req.body as {
    variables?: Record<string, string>;
    playbook?: string;
  };

  if (!externalId || !variables || typeof variables !== "object") {
    res
      .status(400)
      .json({ success: false, message: "externalId et variables requis." });
    return;
  }

  try {
    const internalHeaders = {
      "Content-Type": "application/json",
      "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
      ...(res.locals.userId !== undefined
        ? {
          "x-user-id": String(res.locals.userId),
          "x-user-role": String(res.locals.role ?? "USER"),
        }
        : {}),
    };

    // 1. Récupère la structure du modèle
    const tplRes = await fetch(
      `${BACKNODE_URL}/template/${encodeURIComponent(externalId)}`,
      {
        headers: internalHeaders,
      },
    );
    const tplData = (await tplRes.json()) as {
      success: boolean;
      data?: { structure: { sections: any[]; detectedVariables: string[] } };
    };
    if (!tplData.success || !tplData.data) {
      res.status(404).json({ success: false, message: "Modèle introuvable." });
      return;
    }

    // 2. Consignes : on privilégie celles envoyées dans la requête (édition en cours,
    //    prise en compte immédiate). À défaut seulement, on lit le playbook enregistré.
    let playbookText = typeof playbook === "string" ? playbook.trim() : "";
    if (!playbookText) {
      const pbRes = await fetch(
        `${BACKNODE_URL}/template/${encodeURIComponent(externalId)}/playbook`,
        {
          headers: internalHeaders,
        },
      );
      const pbData = (await pbRes.json()) as {
        success: boolean;
        data?: { rulesText: string } | null;
      };
      playbookText = pbData.data?.rulesText?.trim() ?? "";
    }

    // 3. Pré-substitution des marqueurs avec les valeurs utilisateur
    const substitutedSections = tplData.data.structure.sections.map(
      (sec: any) => ({
        title: sec.title,
        clauses: sec.clauses.map((cl: any) => ({
          title: cl.title,
          content: substituteMarkers(cl.content, variables),
        })),
      }),
    );

    // 4. Construit le prompt avec contenu déjà substitué + consignes
    const consignesBlock = playbookText
      ? `\n\nCONSIGNES & CLAUSES SPÉCIFIQUES (PRIORITAIRES — à intégrer impérativement et intégralement) :\n${playbookText}\n`
      : "\n\nCONSIGNES & CLAUSES SPÉCIFIQUES : (aucune règle particulière)\n";
    const docBlock = substitutedSections
      .map(
        (sec: any) =>
          `## ${sec.title}\n\n` +
          sec.clauses
            .map((cl: any) =>
              cl.title ? `### ${cl.title}\n${cl.content}` : cl.content,
            )
            .join("\n\n"),
      )
      .join("\n\n");
    const prompt = `${GENERATE_PROMPT_BASE}${consignesBlock}\nCONTRAT (à finaliser) :\n${docBlock}\n\nProduis maintenant le contrat final :`;

    console.timeLog("appel gpt ")
    // 5. Appel gpt-5.2
    const aiRes = await fetch(`${BACKEND_URL}/openai-chat-5`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        reasoning: "medium",
        verbosity: "medium",
        model: "gpt-5.2",
      }),
    });
    console.timeLog("appel gpt")
    if (!aiRes.ok) {
      res
        .status(502)
        .json({ success: false, message: "Génération AI échouée." });
      return;
    }
    const aiData = (await aiRes.json()) as {
      content?: string;
      openai_tokens?: unknown;
    };

    // Log tokens
    if (aiData.openai_tokens && res.locals.userId) {
      await logOpenAiTokens(
        { openai_tokens: aiData.openai_tokens } as any,
        res.locals.userId as number,
      );
    }

    void trackFeature(
      "generate_contract",
      res.locals.userId as number | undefined,
    );
    res.json({
      success: true,
      content: aiData.content ?? "",
      templateName: (tplData.data as any).meta?.name ?? null,
    });
  } catch (e: any) {
    console.error("[template/generate] error:", e.message);
    if (!res.headersSent)
      res.status(500).json({
        success: false,
        message: "Erreur interne lors de la génération.",
      });
  }
}



// ─── Import d'un contrat → modèle ──────────────────────────────────────────────
//
// Fonctionnement :
// 1. Le texte extrait est découpé en paragraphes numérotés.
// 2. Les emplacements vides d'un modèle vierge ("....", "…", "____", "[à compléter]")
//    sont repérés par le code et remplacés par des repères numérotés [[P1]], [[P2]]…
// 3. L'IA ne réécrit PAS le contrat : elle renvoie seulement
//    - les numéros des paragraphes qui sont des titres (pour découper en sections),
//    - un nom pour chaque repère [[Pn]] (modèle vierge),
//    - les variables avec leurs valeurs exactes (contrat déjà rempli).
// 4. Le code découpe les sections et place lui-même les marqueurs
//    <<NOM_VARIABLE|texte original>> dans le texte.
// Avantages : réponse IA très courte (donc rapide et peu coûteuse) et texte du
// contrat garanti identique à l'original.

/** Taille max du texte envoyé à l'IA. Le découpage et les marqueurs s'appliquent
 *  quand même à tout le document. */
const MAX_CHARS_SENT_TO_AI = 150_000;

const EXTRACT_VARIABLES_PROMPT_BASE = `Tu reçois le texte d'un contrat. Chaque paragraphe est précédé de son numéro, au format "12| texte du paragraphe".
Ta mission : repérer les informations propres à CE contrat, qu'un juriste devra compléter ou modifier pour réutiliser le document comme modèle, et repérer les paragraphes qui sont des titres.
Tu ne dois PAS réécrire le contrat.

Le document peut être :
- un modèle VIERGE : les emplacements à compléter ("....", "…", "____", "[à compléter]") ont été remplacés par des repères [[P1]], [[P2]]… Quand une indication suivait l'emplacement, elle est ajoutée dans le repère : [[P1 (forme juridique)]] ;
- un contrat DÉJÀ REMPLI : les informations sont écrites en toutes lettres ;
- un mélange des deux.

Réponds UNIQUEMENT avec un JSON valide, sans markdown, au format :
{
  "contractType": "Type de contrat en quelques mots",
  "headingLines": [3, 8, 15],
  "placeholders": [
    { "id": "P1", "name": "DENOMINATION_APPORTEUR", "label": "Dénomination de l'apporteur", "type": "text" }
  ],
  "variables": [
    { "name": "DENOMINATION_PRESTATAIRE", "label": "Dénomination du prestataire", "type": "text", "values": ["Alpha Conseil SAS", "ALPHA CONSEIL"] }
  ]
}

OÙ CHERCHER :
- La désignation des parties ("Entre les soussignés", "ENTRE :", "ET :") et le préambule contiennent la plupart des variables : analyse-les EN ENTIER et en priorité, pour CHAQUE partie.
- Puis le reste du contrat : dates, durées, montants, lieux, désignations spécifiques, bloc de signature.

INFORMATIONS À REPÉRER :
- identité des parties : dénomination, forme sociale, capital social, adresse du siège, numéro de TVA intracommunautaire, SIREN / SIRET / RCS, ville d'immatriculation, représentant et sa qualité ;
- dates, durées, délais, montants, pourcentages, taux ;
- éléments spécifiques à l'opération : désignation du bien, de la prestation, du poste, du territoire, lieu d'exécution ;
- lieu et date de signature.

À NE PAS REPÉRER :
- le texte juridique générique et les références légales (ex : "article 1103 du Code civil") ;
- les numéros d'articles, les titres, les numéros de page ;
- les appellations génériques des parties ("le Prestataire", "la Société", "les Parties").

RÈGLES POUR "placeholders" (modèle vierge) :
- Donne une entrée pour CHAQUE repère [[Pn]] qui correspond à une information à compléter. Déduis le nom du texte qui entoure le repère : "dont le siège social est situé [[P2]]" → ADRESSE_SIEGE_APPORTEUR.
- Ignore un repère qui n'est pas une information à compléter (ex : points de suspension à la fin d'une énumération, points de conduite d'un sommaire).
- Deux repères qui concernent des parties différentes ont des noms différents (ADRESSE_SIEGE_APPORTEUR et ADRESSE_SIEGE_SOCIETE).
- Deux repères qui demandent exactement la même information pour la même partie ont le même nom.

RÈGLES POUR "variables" (contrat rempli) :
- Recopie chaque valeur EXACTEMENT comme dans le texte (majuscules, accents, ponctuation), sans le numéro de paragraphe.
- La valeur ne contient que l'information elle-même : "15 000 euros" et non "pour un montant de 15 000 euros".
- Si la même information apparaît sous plusieurs formes ("Alpha Conseil SAS", "ALPHA CONSEIL"), mets toutes les formes dans la même variable.
- Une même valeur ne doit apparaître que dans UNE seule variable.
- Ne mets jamais un repère [[Pn]] dans "values".

RÈGLES POUR "name", "label" et "type" :
- name : MAJUSCULES_AVEC_UNDERSCORES, sans accent, qui décrit l'information ET la partie concernée si besoin (DENOMINATION_CLIENT, ADRESSE_SIEGE_CLIENT, DATE_EFFET). Pas de suffixe _1, _2.
- label : libellé court en français, lisible par un juriste.
- type : "text", "date", "number", "money" ou "duration".

RÈGLES POUR "headingLines" :
- Numéros des paragraphes qui sont des titres de parties ou d'articles (ex : "PRÉAMBULE", "ARTICLE 1 – OBJET"), dans l'ordre du texte.
- N'inclus pas le titre principal du document.`;

type VariableType = "text" | "date" | "number" | "money" | "duration";

const ALLOWED_VARIABLE_TYPES: VariableType[] = ["text", "date", "number", "money", "duration"];

interface VariableDefinition {
  name: string;
  label: string;
  type: VariableType;
}

/** Variable d'un contrat rempli : l'IA donne les valeurs à retrouver dans le texte. */
interface ExtractedVariable extends VariableDefinition {
  values: string[];
}

/** Repère [[Pn]] d'un modèle vierge, nommé par l'IA. */
interface NamedPlaceholder extends VariableDefinition {
  id: string;
}

interface AiExtractionResult {
  contractType: string | null;
  headingLines: number[];
  placeholders: NamedPlaceholder[];
  variables: ExtractedVariable[];
}

/** Emplacement vide repéré par le code dans un modèle vierge. */
interface BlankPlaceholder {
  /** Texte exact du document (ex : ". .. ; (forme juridique)"). */
  originalText: string;
  /** Indication entre parenthèses qui suivait l'emplacement (ex : "forme juridique"). */
  hint: string | null;
}

interface PreparedDocument {
  /** Paragraphes où chaque emplacement vide est remplacé par [[P1]], [[P2]]… */
  paragraphs: string[];
  /** Emplacement d'origine de chaque repère : "P1" → { originalText, hint }. */
  placeholders: Map<string, BlankPlaceholder>;
}

interface TemplateSection {
  title: string;
  clauses: Array<{ id: string; title: string; content: string; variables: string[] }>;
}

/**
 * Emplacements vides d'un modèle vierge :
 * - [à compléter], [NOM], […]
 * - ____ (au moins 3 tirets bas)
 * - "…", "...", ". .." (au moins 3 points, espaces isolés tolérés)
 * - XXX
 * éventuellement suivis d'une indication entre parenthèses : ". .. ; (forme juridique)".
 * Groupes : 1 = emplacement, 2 = partie parenthèse complète, 3 = texte de l'indication.
 */
const BLANK_REGEX = /(\[[^\[\]]{0,40}\]|_{3,}|…(?:[ \t]?[.…])*|\.(?:[ \t]?[.…]){2,}|\bX{3,}\b)([ \t]*[;,]?[ \t]*\(([^()]{1,40})\))?/g;

/** Repère inséré dans le texte à la place d'un emplacement vide : [[P1]]. */
const PLACEHOLDER_TOKEN_REGEX = /\[\[(P\d+)\]\]/g;

/**
 * Découpe le texte extrait en paragraphes non vides.
 * Les PDF coupent souvent une phrase sur plusieurs lignes : si une ligne se
 * termine par une virgule ou si la suivante commence par une minuscule, on
 * considère que c'est le même paragraphe.
 */
function splitIntoParagraphs(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);

  const paragraphs: string[] = [];
  for (const line of lines) {
    const previous = paragraphs[paragraphs.length - 1];
    const previousEndsWithComma = previous !== undefined && /[,(–-]$/.test(previous);
    const lineStartsWithLowercase = /^[a-zàâäçéèêëîïôöûùüÿœ]/.test(line);

    if (previous !== undefined && (previousEndsWithComma || lineStartsWithLowercase)) {
      paragraphs[paragraphs.length - 1] = previous + " " + line;
    } else {
      paragraphs.push(line);
    }
  }
  return paragraphs;
}

/** Découpe le texte en paragraphes et remplace les emplacements vides par des repères [[Pn]]. */
function prepareDocument(text: string): PreparedDocument {
  const placeholders = new Map<string, BlankPlaceholder>();

  const paragraphs = splitIntoParagraphs(text).map((paragraph) =>
    paragraph.replace(
      BLANK_REGEX,
      (fullMatch: string, blank: string, parenthesisPart: string | undefined, hintText: string | undefined) => {
        const id = `P${placeholders.size + 1}`;

        // Une parenthèse de définition ("(ci-après « la Société »)") n'est pas une
        // indication de saisie : elle reste dans le texte, hors du repère.
        const isDefinition = hintText !== undefined && /«|ci-apr/i.test(hintText);

        if (parenthesisPart === undefined || hintText === undefined || isDefinition) {
          placeholders.set(id, { originalText: blank, hint: null });
          return `[[${id}]]${parenthesisPart ?? ""}`;
        }

        placeholders.set(id, { originalText: fullMatch, hint: hintText.trim() });
        return `[[${id}]]`;
      },
    ),
  );

  return { paragraphs, placeholders };
}

/** Construit le texte envoyé à l'IA : "1| paragraphe", "2| paragraphe"… */
function buildNumberedText(document: PreparedDocument): { numberedText: string; isTruncated: boolean } {
  let numberedText = "";
  for (let index = 0; index < document.paragraphs.length; index++) {
    // Pour l'IA, l'indication est ajoutée dans le repère : [[P1 (forme juridique)]].
    const paragraphForAi = document.paragraphs[index].replace(PLACEHOLDER_TOKEN_REGEX, (token: string, id: string) => {
      const hint = document.placeholders.get(id)?.hint;
      return hint ? `[[${id} (${hint})]]` : token;
    });

    const numberedLine = `${index + 1}| ${paragraphForAi}\n`;
    if (numberedText.length + numberedLine.length > MAX_CHARS_SENT_TO_AI) {
      return { numberedText, isTruncated: true };
    }
    numberedText += numberedLine;
  }
  return { numberedText, isTruncated: false };
}

/** Transforme "Nom de la société" ou "nom_société" en "NOM_DE_LA_SOCIETE". */
function toVariableName(rawName: string): string {
  return rawName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Lit nom, libellé et type d'une variable renvoyée par l'IA (null si le nom est vide). */
function readVariableDefinition(rawVariable: any): VariableDefinition | null {
  const name = toVariableName(String(rawVariable?.name ?? ""));
  if (!name) return null;
  const type = ALLOWED_VARIABLE_TYPES.includes(rawVariable?.type) ? rawVariable.type : "text";
  const label = String(rawVariable?.label ?? "").trim() || name;
  return { name, label, type };
}

/** Lit la réponse de l'IA et ne garde que les données exploitables. */
function parseAiExtraction(rawContent: string): AiExtractionResult {
  const cleaned = rawContent
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const parsed = JSON.parse(cleaned) as {
    contractType?: unknown;
    headingLines?: unknown;
    placeholders?: unknown;
    variables?: unknown;
  };

  const headingLines = Array.isArray(parsed.headingLines)
    ? parsed.headingLines.filter((line): line is number => Number.isInteger(line))
    : [];

  // Repères [[Pn]] nommés par l'IA.
  const placeholders: NamedPlaceholder[] = [];
  const rawPlaceholders = Array.isArray(parsed.placeholders) ? parsed.placeholders : [];
  for (const rawPlaceholder of rawPlaceholders) {
    const id = String(rawPlaceholder?.id ?? "").trim();
    const definition = readVariableDefinition(rawPlaceholder);
    if (/^P\d+$/.test(id) && definition) placeholders.push({ id, ...definition });
  }

  // Variables à valeurs. Si l'IA renvoie deux fois le même nom, on fusionne les valeurs.
  const variablesByName = new Map<string, ExtractedVariable>();
  const rawVariables = Array.isArray(parsed.variables) ? parsed.variables : [];
  for (const rawVariable of rawVariables) {
    const definition = readVariableDefinition(rawVariable);
    if (!definition) continue;

    const values: string[] = (Array.isArray(rawVariable?.values) ? rawVariable.values : [])
      .map((value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim())
      // On écarte les valeurs trop courtes, sans lettre ni chiffre, ou contenant
      // les caractères des marqueurs / repères (elles casseraient le texte).
      .filter((value: string) => value.length >= 2 && /[\p{L}\p{N}]/u.test(value) && !/<<|>>|\||\[\[|\]\]/.test(value));
    if (values.length === 0) continue;

    const existing = variablesByName.get(definition.name);
    if (existing) {
      existing.values.push(...values);
    } else {
      variablesByName.set(definition.name, { ...definition, values });
    }
  }

  return {
    contractType: typeof parsed.contractType === "string" && parsed.contractType.trim()
      ? parsed.contractType.trim()
      : null,
    headingLines,
    placeholders,
    variables: Array.from(variablesByName.values()),
  };
}

/**
 * Découpe les paragraphes en sections à partir des numéros de titres donnés par l'IA.
 * Ce qui précède le premier titre devient la section "En-tête".
 */
function buildSections(paragraphs: string[], headingLines: number[]): Array<{ title: string; paragraphs: string[] }> {
  // Numéros IA (commencent à 1) → index du tableau, sans doublon.
  const headingIndexes = new Set(
    headingLines
      .map((line) => line - 1)
      .filter((index) => index >= 0 && index < paragraphs.length),
  );

  const sections: Array<{ title: string; paragraphs: string[] }> = [];
  let currentSection = { title: "En-tête", paragraphs: [] as string[] };
  let currentSectionIsHeader = true;

  paragraphs.forEach((paragraph, index) => {
    const isHeading = headingIndexes.has(index);
    const currentTitleHasNoContent = !currentSectionIsHeader && currentSection.paragraphs.length === 0;

    if (isHeading && currentTitleHasNoContent) {
      // Deux titres qui se suivent ("TITRE I" puis "ARTICLE 1") : on les regroupe
      // pour ne perdre aucun texte.
      currentSection.title = `${currentSection.title} — ${paragraph}`;
    } else if (isHeading) {
      currentSectionIsHeader = false;
      if (currentSection.paragraphs.length > 0) sections.push(currentSection);
      currentSection = { title: paragraph, paragraphs: [] };
    } else {
      currentSection.paragraphs.push(paragraph);
    }
  });
  if (currentSection.paragraphs.length > 0) sections.push(currentSection);

  return sections;
}

/** Échappe les caractères spéciaux d'une chaîne pour l'utiliser dans une RegExp. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Transforme une valeur en motif de recherche tolérant : les espaces, apostrophes
 * et tirets peuvent différer entre le texte extrait et ce que l'IA recopie
 * (ex : ' et ’).
 */
function valueToSearchPattern(value: string): string {
  let pattern = "";
  for (const char of value) {
    if (char === " ") pattern += "\\s+";
    else if ("'’‘`".includes(char)) pattern += "['’‘`]";
    else if ("-–—‑".includes(char)) pattern += "[-–—‑]";
    else pattern += escapeRegExp(char);
  }
  return pattern;
}

/**
 * Entoure chaque valeur trouvée dans le contenu d'un marqueur <<NOM|valeur>>.
 * Une seule expression régulière est utilisée pour toutes les valeurs, les plus
 * longues en premier : une valeur déjà marquée ne peut donc pas être re-marquée
 * (ex : "Paris" à l'intérieur de "10 rue des Lilas, 75010 Paris").
 */
function insertVariableMarkers(content: string, variables: ExtractedVariable[]): string {
  const valuesToFind = variables
    .flatMap((variable) => variable.values.map((value) => ({ value, name: variable.name })))
    .sort((a, b) => b.value.length - a.value.length);
  if (valuesToFind.length === 0) return content;

  // Chaque valeur a son propre groupe capturant, pour retrouver la variable correspondante.
  const alternatives = valuesToFind.map((item) => `(${valueToSearchPattern(item.value)})`).join("|");
  // Les lookarounds évitent de marquer une valeur au milieu d'un mot ("Paris" dans "Parisien").
  const searchRegex = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, "gu");

  return content.replace(searchRegex, (matchedText, ...groups) => {
    const matchedIndex = groups.findIndex((group, index) => index < valuesToFind.length && group !== undefined);
    const variableName = valuesToFind[matchedIndex]?.name;
    return variableName ? `<<${variableName}|${matchedText}>>` : matchedText;
  });
}

/**
 * Remet le texte d'origine à la place des repères [[Pn]] :
 * - repère nommé par l'IA → marqueur <<NOM|texte d'origine>>
 * - repère ignoré par l'IA → texte d'origine tel quel
 */
function replacePlaceholderTokens(
  content: string,
  document: PreparedDocument,
  placeholderNames: Map<string, string>,
): string {
  return content.replace(PLACEHOLDER_TOKEN_REGEX, (token: string, id: string) => {
    const placeholder = document.placeholders.get(id);
    if (!placeholder) return token;
    const variableName = placeholderNames.get(id);
    return variableName ? `<<${variableName}|${placeholder.originalText}>>` : placeholder.originalText;
  });
}

/** Liste les noms de variables présents dans un contenu, dans l'ordre d'apparition. */
function listVariablesInContent(content: string): string[] {
  const names = new Set<string>();
  for (const match of content.matchAll(/<<([A-Z0-9_]+)\|/g)) {
    if (match[1]) names.add(match[1]);
  }
  return Array.from(names);
}

/** Assemble la structure du modèle (même format que celui attendu par le front et backNode). */
function buildTemplateStructure(document: PreparedDocument, extraction: AiExtractionResult) {
  const placeholderNames = new Map(extraction.placeholders.map((placeholder) => [placeholder.id, placeholder.name]));

  const sections: TemplateSection[] = buildSections(document.paragraphs, extraction.headingLines).map(
    (section, index) => {
      const contentWithValueMarkers = insertVariableMarkers(section.paragraphs.join("\n"), extraction.variables);
      const content = replacePlaceholderTokens(contentWithValueMarkers, document, placeholderNames);
      // Les titres ne reçoivent pas de marqueur : on y remet seulement le texte d'origine.
      const title = replacePlaceholderTokens(section.title, document, new Map());
      return {
        title,
        clauses: [{ id: `s${index + 1}_c1`, title: "", content, variables: listVariablesInContent(content) }],
      };
    },
  );

  // Libellé et type de chaque variable, qu'elle vienne d'une valeur ou d'un repère.
  const definitionsByName = new Map<string, VariableDefinition>();
  for (const { name, label, type } of [...extraction.variables, ...extraction.placeholders]) {
    if (!definitionsByName.has(name)) definitionsByName.set(name, { name, label, type });
  }

  // On ne garde que les variables réellement placées dans le texte.
  const placedNames = Array.from(
    new Set(sections.flatMap((section) => section.clauses.flatMap((clause) => clause.variables))),
  );

  return {
    sections,
    detectedVariables: placedNames,
    variableDefs: placedNames.map(
      (name) => definitionsByName.get(name) ?? { name, label: name, type: "text" as VariableType },
    ),
  };
}

async function handleTemplateImport(
  req: Request,
  res: Response,
): Promise<void> {
  const { fileBase64, mimeType, filename, name, contractType } =
    req.body as {
      fileBase64?: string;
      mimeType?: string;
      filename?: string;
      name?: string;
      contractType?: string;
    };

  if (!fileBase64 || !filename || !name) {
    res.status(400).json({
      success: false,
      message: "fileBase64, filename et name sont requis.",
    });
    return;
  }

  try {
    console.time("[template/import] total");
    // 1. Extraction du texte via Python
    console.time("[template/import] extraction du texte");
    const buffer = Buffer.from(fileBase64, "base64");
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([buffer], { type: mimeType || "application/octet-stream" }),
      filename,
    );
    const extractRes = await fetch(`${BACKEND_URL}/extract-document-text`, {
      method: "POST",
      body: formData,
    });
    console.timeEnd("[template/import] extraction du texte");
    if (!extractRes.ok) {
      res
        .status(502)
        .json({ success: false, message: "Extraction du document échouée." });
      return;
    }
    const extractData = (await extractRes.json()) as {
      success?: boolean;
      text?: string;
    };
    if (!extractData.text) {
      res
        .status(422)
        .json({ success: false, message: "Aucun texte extrait du document." });
      return;
    }

    // 2. Repérage des titres et des variables par l'IA (réponse courte, pas de réécriture)
    const preparedDocument = prepareDocument(extractData.text);
    const { numberedText, isTruncated } = buildNumberedText(preparedDocument);
    if (isTruncated) {
      console.warn(`[template/import] document long : seuls les ${MAX_CHARS_SENT_TO_AI} premiers caractères sont analysés par l'IA.`);
    }

    const fullPrompt = `${EXTRACT_VARIABLES_PROMPT_BASE}\n\nTEXTE DU CONTRAT :\n${numberedText}`;

    console.time("[template/import] analyse IA");
    const aiRes = await fetch(`${BACKEND_URL}/openai-chat-5`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: fullPrompt,
        reasoning: "medium",
        verbosity: "low",
        model: "gpt-5.2",
      }),
    });
    console.timeEnd("[template/import] analyse IA");
    if (!aiRes.ok) {
      res
        .status(502)
        .json({ success: false, message: "Analyse IA échouée." });
      return;
    }
    const aiData = (await aiRes.json()) as {
      content?: string;
      openai_tokens?: unknown;
    };

    let extraction: AiExtractionResult;
    try {
      extraction = parseAiExtraction(aiData.content ?? "");
    } catch {
      res.status(422).json({
        success: false,
        message: "La réponse AI n'est pas un JSON valide.",
      });
      return;
    }

    // 3. Découpage en sections + placement des marqueurs par le code
    const structure = buildTemplateStructure(preparedDocument, extraction);

    // Log tokens
    if (aiData.openai_tokens && res.locals.userId) {
      await logOpenAiTokens(
        { openai_tokens: aiData.openai_tokens } as any,
        res.locals.userId as number,
      );
    }

    // 4. Sauvegarde backNode
    const saveRes = await fetch(`${BACKNODE_URL}/template`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
        ...(res.locals.userId !== undefined
          ? {
            "x-user-id": String(res.locals.userId),
            "x-user-role": String(res.locals.role ?? "USER"),
          }
          : {}),
      },
      body: JSON.stringify({
        name,
        // Le type saisi par l'utilisateur est prioritaire, sinon celui déduit par l'IA.
        contractType: contractType || extraction.contractType || undefined,
        sourceFilename: filename,
        fileBase64,
        structure,
      }),
    });
    const saved = await saveRes.json();
    if (saveRes.ok)
      void trackFeature(
        "import_template",
        res.locals.userId as number | undefined,
      );
    console.timeEnd("[template/import] total");
    res.status(saveRes.ok ? 201 : saveRes.status).json(saved);
  } catch (e: any) {
    console.error("[template/import] error:", e.message);
    if (!res.headersSent)
      res
        .status(500)
        .json({ success: false, message: "Erreur interne lors de l'import." });
  }
}

