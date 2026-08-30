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

const STRUCTURE_PROMPT_BASE = `Tu es un expert juridique. Voici le texte brut d'un contrat professionnel.
Structure-le en JSON strict avec ce format exact (rien d'autre) :
{
  "sections": [
    {
      "title": "Titre de la section",
      "clauses": [
        {
          "id": "s1_c1",
          "title": "Titre de la clause",
          "content": "Texte ORIGINAL de la clause AVEC les valeurs à variabiliser entourées de marqueurs <<NOM_VARIABLE|valeur originale>>",
          "variables": ["NOM_VARIABLE"]
        }
      ]
    }
  ],
  "detectedVariables": ["NOM_VARIABLE", "AUTRE_VAR"]
}

RÈGLES IMPORTANTES :
- CONSERVE INTÉGRALEMENT le texte original (mots, ponctuation, valeurs, noms, adresses, dates, montants).
- Identifie les valeurs à transformer en variables : noms d'entreprises, noms de personnes, dates, durées, montants, adresses, numéros (SIREN, RCS), intitulés de postes, villes.
- Pour CHAQUE valeur identifiée, entoure-la d'un marqueur <<NOM_VARIABLE|VALEUR_ORIGINALE_EXACTE>> SANS rien retirer du texte.
- **INTERDIT** : ne JAMAIS produire <<NOM_VARIABLE|>>, <<NOM_VARIABLE| >> ni <<NOM_VARIABLE>> sans la valeur originale. La partie après le \`|\` doit contenir le texte exact du document source. Si tu n'as pas de valeur précise, n'ajoute PAS de marqueur.
- NOM_VARIABLE en MAJUSCULES_AVEC_UNDERSCORES descriptif (ex: NOM_SOCIETE, NOM_SOCIETE_1, ADRESSE_SIEGE, DATE_DEBUT, MONTANT_INDEMNITE).
- EXEMPLE CORRECT : "La société <<NOM_SOCIETE|Alpha>> dont le siège est situé au <<ADRESSE_SIEGE|10 rue des Lilas, 75010 Paris>> et immatriculée au RCS de <<VILLE_RCS|Paris>> sous le n° <<NUMERO_RCS|123 456 789>>."
- EXEMPLE INTERDIT : "La société <<NOM_SOCIETE|>> ..." (valeur vide) — NE FAIS PAS ÇA.
- Si une même entité revient plusieurs fois (ex. nom de société), utilise le MÊME nom de variable à chaque occurrence.
- Identifie toutes les sections du contrat (préambule, objet, durée, rémunération, clauses spécifiques, signatures…).
- Conserve le langage juridique exact du texte source.
- Réponds UNIQUEMENT avec le JSON valide, sans markdown, sans explication.

Texte du contrat :
`;

async function handleTemplateImport(
  req: Request,
  res: Response,
): Promise<void> {
  const { fileBase64, mimeType, filename, name, contractType, aiHints } =
    req.body as {
      fileBase64?: string;
      mimeType?: string;
      filename?: string;
      name?: string;
      contractType?: string;
      aiHints?: string;
    };

  if (!fileBase64 || !filename || !name) {
    res.status(400).json({
      success: false,
      message: "fileBase64, filename et name sont requis.",
    });
    return;
  }

  try {
    // 1. Extraction du texte via Python
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

    // 2. Structuration via OpenAI gpt-5.2 (avec indications optionnelles du juriste)
    const hintsBlock =
      aiHints && aiHints.trim()
        ? `\n\nINDICATIONS DU JURISTE (à prendre en compte en priorité pour identifier les variables) :\n${aiHints.trim()}\n`
        : "";
    const fullPrompt =
      STRUCTURE_PROMPT_BASE +
      hintsBlock +
      "\n\nTexte du contrat :\n" +
      extractData.text.slice(0, 40000);
    const aiRes = await fetch(`${BACKEND_URL}/openai-chat-5`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: fullPrompt,
        reasoning: "low",
        verbosity: "low",
        model: "gpt-5.2",
      }),
    });
    if (!aiRes.ok) {
      res
        .status(502)
        .json({ success: false, message: "Structuration AI échouée." });
      return;
    }
    const aiData = (await aiRes.json()) as {
      content?: string;
      openai_tokens?: unknown;
    };

    let structure: unknown;
    try {
      const raw = (aiData.content ?? "").trim();
      // Retire les balises markdown code block si présentes
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
      structure = JSON.parse(cleaned);
    } catch {
      res.status(422).json({
        success: false,
        message: "La réponse AI n'est pas un JSON valide.",
      });
      return;
    }

    // Log tokens
    if (aiData.openai_tokens && res.locals.userId) {
      await logOpenAiTokens(
        { openai_tokens: aiData.openai_tokens } as any,
        res.locals.userId as number,
      );
    }

    // 3. Sauvegarde backNode
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
        contractType,
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
    res.status(saveRes.ok ? 201 : saveRes.status).json(saved);
  } catch (e: any) {
    console.error("[template/import] error:", e.message);
    if (!res.headersSent)
      res
        .status(500)
        .json({ success: false, message: "Erreur interne lors de l'import." });
  }
}

