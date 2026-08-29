/* eslint-disable no-console */
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import http from "http";
import { proxyAuthMiddleware } from "./src/middleware/authMiddleware.js";
import { analyzeContractWithAI } from "./src/services/aiAnalyser/aiAnalyzer.js";
import { detectContractWithAI } from "./src/utils/contractDetector.js";
import { performCompleteMarketAnalysis } from "./src/utils/marketAnalysis.js";
import { getRecommendedClauses } from "./src/utils/recommendClause.js";
import { detectLegalReferences } from "./src/utils/detectLegalReferences.js";
import { fetchLegalTexts } from "./src/utils/fetchLegalTexts.js";
import { summarizeCaseInline } from "./src/utils/aiSummarizer.js";
// Charge d'abord server/.env puis la racine
dotenv.config({ path: path.resolve(process.cwd(), "server/.env") });
dotenv.config();
const app = express();
app.set("etag", false);
//Cors adapté pour prod
app.use(cors({
    origin: [
        /^http:\/\/localhost:\d+$/,
        /^https:\/\/localhost:\d+$/, // complément Word (dev server HTTPS)
        /^http:\/\/127\.0\.0\.1:\d+$/,
        /^https:\/\/.*\.odns\.fr$/,
        "http://localhost:5173",
    ],
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: "20mb" }));
const IS_PROD = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 3000);
const BACKEND_URL = IS_PROD ? process.env.BACKEND_URL : "http://localhost:5678";
const BACKNODE_URL = IS_PROD
    ? process.env.BACKNODE_URL
    : "http://localhost:3020";
// ---- Relay vers Python backend ------------------------------------------------
function relayStreamToPython(req, res, targetPath) {
    const backendUrl = new URL(`${BACKEND_URL}${targetPath}`);
    const options = {
        hostname: backendUrl.hostname,
        port: Number(backendUrl.port) || 80,
        path: backendUrl.pathname,
        method: req.method,
        headers: { ...req.headers, host: backendUrl.host },
    };
    const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
    });
    proxyReq.on("error", (e) => {
        console.error("relay Python error:", e.message);
        if (!res.headersSent)
            res.status(502).json({ error: "python_unreachable" });
    });
    req.pipe(proxyReq, { end: true });
}
function relayJsonToPython(req, res, targetPath, handleData) {
    fetch(`${BACKEND_URL}${targetPath}`, {
        method: req.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
    })
        .then(async (r) => {
            const data = await r.json().catch(() => ({}));
            if (handleData)
                await handleData(data, res.locals.userId);
            res.status(r.status).json(data);
        })
        .catch((e) => {
            console.error("relay Python error:", e.message);
            if (!res.headersSent)
                res.status(502).json({ error: "python_unreachable" });
        });
}
// Relay requêtes vers le serveur Node
function relayToNode(req, res, targetPath) {
    fetch(`${BACKNODE_URL}${targetPath}`, {
        method: req.method,
        headers: {
            "Content-Type": "application/json",
            cookie: req.headers.cookie || "",
            "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
            ...(res.locals.userId !== undefined
                ? {
                    "x-user-id": String(res.locals.userId),
                    "x-user-role": String(res.locals.role ?? "USER"),
                }
                : {}),
        },
        body: req.method === "GET" ? undefined : JSON.stringify(req.body),
    })
        .then(async (r) => {
            const setCookieHeader = typeof r.headers.getSetCookie === "function"
                ? r.headers.getSetCookie()
                : r.headers.get("set-cookie");
            if (setCookieHeader &&
                ((Array.isArray(setCookieHeader) && setCookieHeader.length > 0) ||
                    !Array.isArray(setCookieHeader))) {
                res.setHeader("set-cookie", setCookieHeader);
            }
            // 304 n'a pas de body — on le remonte en 200 vide pour ne pas bloquer le front
            if (r.status === 304) {
                res.status(200).json({ success: false, status: 304, raw: "" });
                return;
            }
            const contentType = r.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
                const data = await r.json().catch(() => ({}));
                res.status(r.status).json(data);
                return;
            }
            const text = await r.text().catch(() => "");
            res.status(r.status).json({
                success: r.ok,
                status: r.status,
                raw: text,
            });
        })
        .catch((e) => {
            console.error("relay Node error:", e.message);
            if (!res.headersSent)
                res.status(502).json({ error: "backnode_unreachable" });
        });
}
/**
 * Relais vers backNode en passthrough binaire : préserve le content-type et
 * le content-disposition de la réponse (PDF déchiffré, CSV d'export…). À utiliser
 * pour les endpoints qui ne renvoient PAS du JSON.
 */
function relayToNodeRaw(req, res, targetPath) {
    fetch(`${BACKNODE_URL}${targetPath}`, {
        method: req.method,
        headers: {
            cookie: req.headers.cookie || "",
            "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
            ...(res.locals.userId !== undefined
                ? { "x-user-id": String(res.locals.userId), "x-user-role": String(res.locals.role ?? "USER") }
                : {}),
        },
    })
        .then(async (r) => {
            const ct = r.headers.get("content-type") || "application/octet-stream";
            const cd = r.headers.get("content-disposition");
            const buf = Buffer.from(await r.arrayBuffer());
            res.status(r.status);
            res.setHeader("content-type", ct);
            if (cd)
                res.setHeader("content-disposition", cd);
            res.send(buf);
        })
        .catch((e) => {
            console.error("relay Node raw error:", e.message);
            if (!res.headersSent)
                res.status(502).json({ error: "backnode_unreachable" });
        });
}
/** Construit un chemin backNode en propageant la query string entrante. */
function withQuery(base, req) {
    const i = req.originalUrl.indexOf("?");
    return i >= 0 ? `${base}${req.originalUrl.slice(i)}` : base;
}
// ─── Contrathèque ───
function handleContractExtract(req, res) {
    // Multipart (fichier) → backend Python d'extraction de métadonnées
    relayStreamToPython(req, res, "/extract-contract-metadata");
}
async function logOpenAiTokens(data, userId) {
    const usage = data.openai_tokens;
    delete data.openai_tokens;
    if (!usage?.model)
        return;
    const inputTokens = Number(usage.input_tokens ?? 0);
    const outputTokens = Number(usage.output_tokens ?? 0);
    if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
        console.warn("OpenAI usage ignored: invalid payload", usage);
        return;
    }
    try {
        const logResponse = await fetch(`${BACKNODE_URL}/llm/increment/${encodeURIComponent(usage.model)}/${Math.trunc(inputTokens)}/${Math.trunc(outputTokens)}`, {
            method: "PUT",
            headers: {
                "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
                ...(userId ? { "x-user-id": String(userId) } : {}),
            },
        });
        if (!logResponse.ok) {
            const errorText = await logResponse.text().catch(() => "");
            console.warn("OpenAI usage log failed:", logResponse.status, errorText);
        }
    }
    catch (e) {
        console.error("OpenAI usage log error:", e.message);
    }
}
function handleExtractDocumentText(req, res) {
    relayStreamToPython(req, res, "/extract-document-text");
}
function handleLegifranceSearch(req, res) {
    relayJsonToPython(req, res, "/legifrance-search");
}
function handleClassifyVeille(req, res) {
    relayJsonToPython(req, res, "/veille");
}
function handleJurisprudence(req, res) {
    relayJsonToPython(req, res, "/jurisprudence");
}
function handleAnalyzeClause(req, res) {
    relayJsonToPython(req, res, "/analyze-clause", logOpenAiTokens);
}
function handleChat(req, res) {
    relayJsonToPython(req, res, "/chat", logOpenAiTokens);
}
function handleOpenAiChat(req, res) {
    relayJsonToPython(req, res, "/openai-chat", logOpenAiTokens);
}
function handleOpenAiChat5(req, res) {
    relayJsonToPython(req, res, "/openai-chat-5", logOpenAiTokens);
}
function handleHuggingFaceGenerate(req, res) {
    relayJsonToPython(req, res, "/huggingface-generate");
}
function handleInseeRequest(req, res) {
    if (typeof req.params.siren !== "string") {
        return res.status(400).json({
            success: false,
            message: "Bad request, le parsing du siren n'est pas conforme.",
        });
    }
    const siren = encodeURIComponent(req.params.siren);
    relayToNode(req, res, `/enterprise/insee/${siren}`);
}
function handleLlmCurrentUsage(req, res) {
    relayToNode(req, res, "/llm/usage");
}
function handleLlmUsageHistory(req, res) {
    // Transmet le query param ?days= tel quel au backNode
    const days = req.query.days ? `?days=${req.query.days}` : "";
    relayToNode(req, res, `/llm/usage/history${days}`);
}
function handleLlmUserUsage(req, res) {
    relayToNode(req, res, "/llm/usage/me");
}
function handleLlmUsersUsage(req, res) {
    relayToNode(req, res, "/llm/usage/users");
}
function handleNodeUserGet(req, res) {
    relayToNode(req, res, "/user/get");
}
function handleNodeUserUpdate(req, res) {
    relayToNode(req, res, "/user");
}
function handleNodeLogin(req, res) {
    relayToNode(req, res, "/user/auth/login");
}
function handleNodeLogout(req, res) {
    relayToNode(req, res, "/user/auth/logout");
}
function handleNodeUserPreferences(req, res) {
    relayToNode(req, res, `/user/preferences`);
}
function handleNodeUserPreferencesUI(req, res) {
    relayToNode(req, res, `/user/preferences/ui`);
}
function handleNodeUserTwoFactor(req, res) {
    relayToNode(req, res, `/user/two-factor`);
}
function handleNodeUserTwoFactorVerify(req, res) {
    relayToNode(req, res, `/user/two-factor/verify`);
}
function handleNodeUserExportData(req, res) {
    relayToNode(req, res, `/user/export-data`);
}
function handleNodeUserDeleteAccount(req, res) {
    relayToNode(req, res, `/user/account`);
}
function handleNodeEnterpriseGet(req, res) {
    relayToNode(req, res, "/enterprise");
}
function handleNodeEnterpriseUpdate(req, res) {
    relayToNode(req, res, "/enterprise");
}
function handleNodeContractHistory(req, res) {
    relayToNode(req, res, "/contract-history");
}
function handleNodeChatHistory(req, res) {
    relayToNode(req, res, "/chat-history");
}
function handleNodeContractHistoryItem(req, res) {
    const externalId = encodeURIComponent(req.params.externalId);
    relayToNode(req, res, `/contract-history/${externalId}`);
}
function handleNodeContractHistoryTouch(req, res) {
    const externalId = encodeURIComponent(req.params.externalId);
    relayToNode(req, res, `/contract-history/${externalId}/touch`);
}
function handleSignUpUser(req, res) {
    relayToNode(req, res, "/user/create");
}
function handleNodeUserForgotPassword(req, res) {
    relayToNode(req, res, "/user/forgotpassword");
}
function handleNodeUserResetPassword(req, res) {
    relayToNode(req, res, "/user/updatepassword");
}
function handleNodeGoogle(_req, res) {
    res.redirect(`${BACKNODE_URL}/api/user/auth/google`);
}
function handleBillingCustomer(req, res) {
    relayToNode(req, res, "/billing/customer");
}
function handleBillingPaymentIntent(req, res) {
    relayToNode(req, res, "/billing/payment-intent");
}
function handleBillingPlans(req, res) {
    relayToNode(req, res, "/billing/plans");
}
function handleBillingSubscription(req, res) {
    relayToNode(req, res, "/billing/subscription");
}
function handleBillingAddCredits(req, res) {
    relayToNode(req, res, "/billing/add-credits");
}
function handleBillingRemoveCredits(req, res) {
    relayToNode(req, res, "/billing/remove-credits");
}
function handleBillingCredits(req, res) {
    relayToNode(req, res, "/billing/credits");
}
async function handleDetectContract(req, res) {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
        res
            .status(400)
            .json({ success: false, message: "Le champ 'text' est requis." });
        return;
    }
    try {
        const context = await detectContractWithAI(text);
        res.json(context);
    }
    catch (e) {
        const message = e instanceof Error ? e.message : "Erreur interne";
        console.error("detect-contract error:", message);
        res.status(500).json({ success: false, message });
    }
}
async function handleMarketAnalysis(req, res) {
    const { contractText, contractType, detectedClauses } = req.body;
    if (!contractText || !contractType) {
        res.status(400).json({
            success: false,
            message: "Les champs 'contractText' et 'contractType' sont requis.",
        });
        return;
    }
    try {
        const result = await performCompleteMarketAnalysis(contractText, contractType, (detectedClauses ?? []));
        res.json(result);
    }
    catch (e) {
        const message = e instanceof Error ? e.message : "Erreur interne";
        console.error("market-analysis error:", message);
        res.status(500).json({ success: false, message });
    }
}
async function handleRecommendClause(req, res) {
    const { clause, context, model } = req.body;
    if (!clause) {
        res
            .status(400)
            .json({ success: false, message: "Le champ 'clause' est requis." });
        return;
    }
    try {
        const recommendations = await getRecommendedClauses(clause, context, model);
        res.json(recommendations);
    }
    catch (e) {
        const message = e instanceof Error ? e.message : "Erreur interne";
        console.error("recommend-clause error:", message);
        res.status(500).json({ success: false, message });
    }
}
async function handleDetectLegalReferences(req, res) {
    const { clause } = req.body;
    if (!clause) {
        res
            .status(400)
            .json({ success: false, message: "Le champ 'clause' est requis." });
        return;
    }
    try {
        const refs = await detectLegalReferences(clause);
        res.json(refs);
    }
    catch (e) {
        const message = e instanceof Error ? e.message : "Erreur interne";
        console.error("detect-legal-references error:", message);
        res.status(500).json({ success: false, message });
    }
}
async function handleFetchLegalTexts(req, res) {
    const { refs, clause } = req.body;
    if (!refs) {
        res
            .status(400)
            .json({ success: false, message: "Le champ 'refs' est requis." });
        return;
    }
    try {
        const texts = await fetchLegalTexts(refs, clause);
        res.json(texts);
    }
    catch (e) {
        const message = e instanceof Error ? e.message : "Erreur interne";
        console.error("fetch-legal-texts error:", message);
        res.status(500).json({ success: false, message });
    }
}
async function handleSummarizeCase(req, res) {
    const { item } = req.body;
    if (!item) {
        res
            .status(400)
            .json({ success: false, message: "Le champ 'item' est requis." });
        return;
    }
    try {
        const summary = await summarizeCaseInline(item);
        res.json({ summary });
    }
    catch (e) {
        const message = e instanceof Error ? e.message : "Erreur interne";
        console.error("summarize-case error:", message);
        res.status(500).json({ success: false, message });
    }
}
async function handleAnalyzeContract(req, res) {
    const { content, context } = req.body;
    if (!content || typeof content !== "string") {
        res
            .status(400)
            .json({ success: false, message: "Le champ 'content' est requis." });
        return;
    }
    try {
        const clauses = await analyzeContractWithAI(content, context, res.locals.userId);
        res.json({ success: true, clauses });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Erreur interne";
        console.error("analyze-contract error:", message);
        res.status(500).json({ success: false, message });
    }
}
function handleNodeVeille(req, res) {
    const qs = req.query.nocache === "1" ? "?nocache=1" : "";
    relayToNode(req, res, `/veille${qs}`);
}
function handleNodeVeilleDebug(_req, res) {
    relayToNode(_req, res, "/veille/debug");
}
function handleUserUploadsGet(req, res) {
    relayToNode(req, res, "/user-uploads");
}
function handleUserUploadsPost(req, res) {
    relayToNode(req, res, "/user-uploads/upload");
}
function handleUserUploadsRename(req, res) {
    const filename = encodeURIComponent(req.params.filename);
    relayToNode(req, res, `/user-uploads/${filename}`);
}
function handleUserUploadsDelete(req, res) {
    const filename = encodeURIComponent(req.params.filename);
    relayToNode(req, res, `/user-uploads/${filename}`);
}
function handleFeedback(req, res) {
    relayToNode(req, res, "/feedback");
}
// ---- Template CRUD relay -------------------------------------------------------
function handleTemplateList(req, res) {
    relayToNode(req, res, "/template");
}
function handleTemplateGet(req, res) {
    const id = encodeURIComponent(req.params.externalId);
    relayToNode(req, res, `/template/${id}`);
}
function handleTemplateUpdate(req, res) {
    const id = encodeURIComponent(req.params.externalId);
    relayToNode(req, res, `/template/${id}`);
}
function handleTemplateDelete(req, res) {
    const id = encodeURIComponent(req.params.externalId);
    relayToNode(req, res, `/template/${id}`);
}
function handleTemplatePlaybook(req, res) {
    const id = encodeURIComponent(req.params.externalId);
    relayToNode(req, res, `/template/${id}/playbook`);
}
// ─── Signature electronique ───────────────────────────────────────────────────
function handleSignatureStats(req, res) {
    relayToNode(req, res, "/signature-envelope/stats");
}
function handleSignatureList(req, res) {
    const qs = req.query["status"] ? `?status=${encodeURIComponent(req.query["status"])}` : "";
    relayToNode(req, res, `/signature-envelope${qs}`);
}
function handleSignatureCreate(req, res) {
    relayToNode(req, res, "/signature-envelope");
}
function handleSignatureDelete(req, res) {
    const id = encodeURIComponent(req.params.externalId);
    relayToNode(req, res, `/signature-envelope/${id}`);
}
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
function substituteMarkers(content, variables) {
    // Format actuel : <<NAME|original text>>
    let out = content.replace(/<<([A-Z0-9_]+)\|([\s\S]*?)>>/g, (_match, name, original) => {
        const val = variables[name];
        return val && val.trim() ? val : original;
    });
    // Compat ancien format : {{NAME}}
    out = out.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, name) => {
        const val = variables[name];
        return val && val.trim() ? val : match;
    });
    return out;
}
async function handleTemplateGenerate(req, res) {
    const externalId = req.params.externalId;
    const { variables, playbook } = req.body;
    if (!externalId || !variables || typeof variables !== "object") {
        res.status(400).json({ success: false, message: "externalId et variables requis." });
        return;
    }
    try {
        const internalHeaders = {
            "Content-Type": "application/json",
            "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
            ...(res.locals.userId !== undefined
                ? { "x-user-id": String(res.locals.userId), "x-user-role": String(res.locals.role ?? "USER") }
                : {}),
        };
        // 1. Récupère la structure du modèle
        const tplRes = await fetch(`${BACKNODE_URL}/template/${encodeURIComponent(externalId)}`, {
            headers: internalHeaders,
        });
        const tplData = await tplRes.json();
        if (!tplData.success || !tplData.data) {
            res.status(404).json({ success: false, message: "Modèle introuvable." });
            return;
        }
        // 2. Consignes : on privilégie celles envoyées dans la requête (édition en cours,
        //    prise en compte immédiate). À défaut seulement, on lit le playbook enregistré.
        let playbookText = typeof playbook === "string" ? playbook.trim() : "";
        if (!playbookText) {
            const pbRes = await fetch(`${BACKNODE_URL}/template/${encodeURIComponent(externalId)}/playbook`, {
                headers: internalHeaders,
            });
            const pbData = await pbRes.json();
            playbookText = pbData.data?.rulesText?.trim() ?? "";
        }
        // 3. Pré-substitution des marqueurs avec les valeurs utilisateur
        const substitutedSections = tplData.data.structure.sections.map((sec) => ({
            title: sec.title,
            clauses: sec.clauses.map((cl) => ({
                title: cl.title,
                content: substituteMarkers(cl.content, variables),
            })),
        }));
        // 4. Construit le prompt avec contenu déjà substitué + consignes
        const consignesBlock = playbookText
            ? `\n\nCONSIGNES & CLAUSES SPÉCIFIQUES (PRIORITAIRES — à intégrer impérativement et intégralement) :\n${playbookText}\n`
            : "\n\nCONSIGNES & CLAUSES SPÉCIFIQUES : (aucune règle particulière)\n";
        const docBlock = substitutedSections.map((sec) => `## ${sec.title}\n\n` + sec.clauses.map((cl) => cl.title ? `### ${cl.title}\n${cl.content}` : cl.content).join("\n\n")).join("\n\n");
        const prompt = `${GENERATE_PROMPT_BASE}${consignesBlock}\nCONTRAT (à finaliser) :\n${docBlock}\n\nProduis maintenant le contrat final :`;
        // 5. Appel gpt-5.2
        const aiRes = await fetch(`${BACKEND_URL}/openai-chat-5`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt,
                reasoning: "medium",
                verbosity: "high",
                model: "gpt-5.2",
            }),
        });
        if (!aiRes.ok) {
            res.status(502).json({ success: false, message: "Génération AI échouée." });
            return;
        }
        const aiData = await aiRes.json();
        // Log tokens
        if (aiData.openai_tokens && res.locals.userId) {
            await logOpenAiTokens({ openai_tokens: aiData.openai_tokens }, res.locals.userId);
        }
        res.json({
            success: true,
            content: aiData.content ?? "",
            templateName: tplData.data.meta?.name ?? null,
        });
    }
    catch (e) {
        console.error("[template/generate] error:", e.message);
        if (!res.headersSent)
            res.status(500).json({ success: false, message: "Erreur interne lors de la génération." });
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
async function handleTemplateImport(req, res) {
    const { fileBase64, mimeType, filename, name, contractType, aiHints } = req.body;
    if (!fileBase64 || !filename || !name) {
        res.status(400).json({ success: false, message: "fileBase64, filename et name sont requis." });
        return;
    }
    try {
        // 1. Extraction du texte via Python
        const buffer = Buffer.from(fileBase64, "base64");
        const formData = new FormData();
        formData.append("file", new Blob([buffer], { type: mimeType || "application/octet-stream" }), filename);
        const extractRes = await fetch(`${BACKEND_URL}/extract-document-text`, {
            method: "POST",
            body: formData,
        });
        if (!extractRes.ok) {
            res.status(502).json({ success: false, message: "Extraction du document échouée." });
            return;
        }
        const extractData = await extractRes.json();
        if (!extractData.text) {
            res.status(422).json({ success: false, message: "Aucun texte extrait du document." });
            return;
        }
        // 2. Structuration via OpenAI gpt-5.2 (avec indications optionnelles du juriste)
        const hintsBlock = aiHints && aiHints.trim()
            ? `\n\nINDICATIONS DU JURISTE (à prendre en compte en priorité pour identifier les variables) :\n${aiHints.trim()}\n`
            : "";
        const fullPrompt = STRUCTURE_PROMPT_BASE + hintsBlock + "\n\nTexte du contrat :\n" + extractData.text.slice(0, 40000);
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
            res.status(502).json({ success: false, message: "Structuration AI échouée." });
            return;
        }
        const aiData = await aiRes.json();
        let structure;
        try {
            const raw = (aiData.content ?? "").trim();
            // Retire les balises markdown code block si présentes
            const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
            structure = JSON.parse(cleaned);
        }
        catch {
            res.status(422).json({ success: false, message: "La réponse AI n'est pas un JSON valide." });
            return;
        }
        // Log tokens
        if (aiData.openai_tokens && res.locals.userId) {
            await logOpenAiTokens({ openai_tokens: aiData.openai_tokens }, res.locals.userId);
        }
        // 3. Sauvegarde backNode
        const saveRes = await fetch(`${BACKNODE_URL}/template`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
                ...(res.locals.userId !== undefined
                    ? { "x-user-id": String(res.locals.userId), "x-user-role": String(res.locals.role ?? "USER") }
                    : {}),
            },
            body: JSON.stringify({ name, contractType, sourceFilename: filename, fileBase64, structure }),
        });
        const saved = await saveRes.json();
        res.status(saveRes.ok ? 201 : saveRes.status).json(saved);
    }
    catch (e) {
        console.error("[template/import] error:", e.message);
        if (!res.headersSent)
            res.status(500).json({ success: false, message: "Erreur interne lors de l'import." });
    }
}
async function handleUserUploadsAsset(req, res) {
    try {
        const filename = encodeURIComponent(req.params.filename);
        const r = await fetch(`${BACKNODE_URL}/userassets/${filename}`);
        if (!r.ok || !r.body) {
            res.status(r.status).end();
            return;
        }
        res.setHeader("content-type", r.headers.get("content-type") || "image/webp");
        const { Readable } = await import("stream");
        Readable.fromWeb(r.body).pipe(res);
    }
    catch {
        if (!res.headersSent)
            res.status(502).end();
    }
}
// Multipart (upload PDF) — stream direct, body non consommé par express.json
app.post(["/extract-document-text", "/api/extract-document-text"], handleExtractDocumentText);
// JSON routes — body déjà parsé par express.json
app.post(["/legifrance-search", "/api/legifrance-search"], handleLegifranceSearch);
app.post(["/jurisprudence", "/api/jurisprudence"], handleJurisprudence);
app.post(["/api/veille/classify-veille", "/api/veille/classify-veille"], handleClassifyVeille);
app.post(["/analyze-clause", "/api/analyze-clause"], handleAnalyzeClause);
app.post(["/api/chat", "/chat"], handleChat);
app.post(["/api/openai-chat", "/openai-chat"], handleOpenAiChat);
app.post(["/api/openai-chat-5", "/openai-chat-5"], handleOpenAiChat5);
app.post(["/api/huggingface-generate", "/huggingface-generate"], handleHuggingFaceGenerate);
// Node - Requêtes Backend
const auth = proxyAuthMiddleware;
// Routes publiques (pas d'auth requise)
app.post("/api/user/signup", handleSignUpUser);
app.post("/api/user/auth/login", handleNodeLogin);
/**
 * Login du complément Word : mêmes identifiants que la plateforme, mais le
 * JWT est renvoyé dans le corps (l'iframe Word ne peut pas recevoir le cookie
 * httpOnly cross-site). Le token est ensuite passé en Authorization: Bearer.
 */
app.post("/api/addin/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ success: false, message: "Email et mot de passe requis." });
            return;
        }
        const r = await fetch(`${BACKNODE_URL}/user/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        const data = (await r.json().catch(() => ({})));
        if (!r.ok || !data.success || !data.data?.idUser) {
            res.status(401).json({ success: false, message: data.message || "Identifiants invalides." });
            return;
        }
        if (data.twoFactorRequired) {
            res.status(403).json({
                success: false,
                message: "Ce compte a la double authentification activée : utilisez un compte sans 2FA pour le complément Word (POC).",
            });
            return;
        }
        const jwt = (await import("jsonwebtoken")).default;
        const token = jwt.sign({ userId: data.data.idUser, role: "USER" }, process.env.JWT_SECRET, {
            expiresIn: "7d",
        });
        res.json({ success: true, token, user: { idUser: data.data.idUser, email: data.data.email } });
    }
    catch (error) {
        console.error("addin/login error:", error);
        res.status(500).json({ success: false, message: "Erreur interne lors de la connexion." });
    }
});
app.post("/api/user/auth/forgotpassword", handleNodeUserForgotPassword);
app.post("/api/user/resetpassword", handleNodeUserResetPassword);
app.get("/api/user/auth/google", handleNodeGoogle);
app.post("/api/billing/customer", handleBillingCustomer);
app.post("/api/billing/payment-intent", handleBillingPaymentIntent);
app.get("/api/veille", handleNodeVeille);
app.get("/api/veille/debug", handleNodeVeilleDebug);
app.get("/api/user-uploads", auth, handleUserUploadsGet);
app.post("/api/user-uploads/upload", auth, handleUserUploadsPost);
app.put("/api/user-uploads/:filename", auth, handleUserUploadsRename);
app.delete("/api/user-uploads/:filename", auth, handleUserUploadsDelete);
app.get("/api/user-uploads/assets/:filename", auth, handleUserUploadsAsset);
// Routes protégées (JWT vérifié par le proxy)
app.post("/api/user/auth/logout", auth, handleNodeLogout);
app.get("/api/enterprise/insee/:siren", auth, handleInseeRequest);
app.get("/api/llm/usage", auth, handleLlmCurrentUsage);
app.get("/api/llm/usage/history", auth, handleLlmUsageHistory);
app.get("/api/llm/usage/me", auth, handleLlmUserUsage);
app.get("/api/llm/usage/users", auth, handleLlmUsersUsage);
app.get("/api/user/get", auth, handleNodeUserGet);
app.put("/api/user", auth, handleNodeUserUpdate);
app.get("/api/user/preferences", auth, handleNodeUserPreferences);
app.put("/api/user/preferences", auth, handleNodeUserPreferences);
app.get("/api/user/preferences/ui", auth, handleNodeUserPreferencesUI);
app.put("/api/user/preferences/ui", auth, handleNodeUserPreferencesUI);
app.post("/api/user/two-factor", auth, handleNodeUserTwoFactor);
app.post("/api/user/two-factor/verify", auth, handleNodeUserTwoFactorVerify);
app.post("/api/user/export-data", auth, handleNodeUserExportData);
app.delete("/api/user/account", auth, handleNodeUserDeleteAccount);
app.get("/api/enterprise", auth, handleNodeEnterpriseGet);
app.put("/api/enterprise", auth, handleNodeEnterpriseUpdate);
app.get("/api/contract-history", auth, handleNodeContractHistory);
app.post("/api/contract-history", auth, handleNodeContractHistory);
app.get("/api/contract-history/:externalId", auth, handleNodeContractHistoryItem);
app.delete("/api/contract-history/:externalId", auth, handleNodeContractHistoryItem);
app.patch("/api/contract-history/:externalId/touch", auth, handleNodeContractHistoryTouch);
app.get("/api/chat-history", auth, handleNodeChatHistory);
app.put("/api/chat-history", auth, handleNodeChatHistory);
app.post("/api/billing/customer", auth, handleBillingCustomer);
app.post("/api/billing/payment-intent", auth, handleBillingPaymentIntent);
app.get("/api/billing/plans", auth, handleBillingPlans);
app.post("/api/billing/subscription", auth, handleBillingSubscription);
app.get("/api/billing/subscription", auth, handleBillingSubscription);
app.put("/api/billing/add-credits", auth, handleBillingAddCredits);
app.put("/api/billing/remove-credits", auth, handleBillingRemoveCredits);
app.get("/api/billing/credits", auth, handleBillingCredits);
app.post("/api/analyzer/analyze-contract", auth, handleAnalyzeContract);
app.post("/api/analyzer/detect-contract", auth, handleDetectContract);
app.post("/api/analyzer/market-analysis", auth, handleMarketAnalysis);
app.post("/api/analyzer/recommend-clause", auth, handleRecommendClause);
app.post("/api/detect-legal-references", auth, handleDetectLegalReferences);
app.post("/api/fetch-legal-texts", auth, handleFetchLegalTexts);
app.post("/api/summarize-case", auth, handleSummarizeCase);
app.post("/api/feedback", auth, handleFeedback);
app.get("/api/feedback", auth, handleFeedback);
// Template de contrats
app.post("/api/template/import", auth, handleTemplateImport);
app.get("/api/template", auth, handleTemplateList);
app.get("/api/template/:externalId", auth, handleTemplateGet);
app.put("/api/template/:externalId", auth, handleTemplateUpdate);
app.delete("/api/template/:externalId", auth, handleTemplateDelete);
app.get("/api/template/:externalId/playbook", auth, handleTemplatePlaybook);
app.put("/api/template/:externalId/playbook", auth, handleTemplatePlaybook);
app.post("/api/template/:externalId/generate", auth, handleTemplateGenerate);
// Signature électronique (routes authentifiées)
app.get("/api/signature-envelope/stats", auth, handleSignatureStats);
app.get("/api/signature-envelope", auth, handleSignatureList);
app.post("/api/signature-envelope", auth, handleSignatureCreate);
app.delete("/api/signature-envelope/:externalId", auth, handleSignatureDelete);
// Signature électronique (routes PUBLIQUES — pas d'auth, token dans l'URL)
app.get("/api/signature-envelope/public/:token", (req, res) => {
    relayToNode(req, res, `/signature-envelope/public/${encodeURIComponent(req.params.token)}`);
});
app.post("/api/signature-envelope/public/:token", (req, res) => {
    relayToNode(req, res, `/signature-envelope/public/${encodeURIComponent(req.params.token)}`);
});
// ─── Contrathèque ───
// Extraction IA des métadonnées (multipart → Python). Aucune écriture base.
app.post("/api/contract/extract", auth, handleContractExtract);
// Routes statiques AVANT les routes paramétrées /:externalId
app.get("/api/contract/stats", auth, (req, res) => relayToNode(req, res, "/contract/stats"));
app.get("/api/contract/deadlines", auth, (req, res) => relayToNode(req, res, withQuery("/contract/deadlines", req)));
app.get("/api/contract/export.csv", auth, (req, res) => relayToNodeRaw(req, res, withQuery("/contract/export.csv", req)));
app.get("/api/contract/tags", auth, (req, res) => relayToNode(req, res, "/contract/tags"));
app.post("/api/contract/tags", auth, (req, res) => relayToNode(req, res, "/contract/tags"));
app.delete("/api/contract/tags/:externalId", auth, (req, res) => relayToNode(req, res, `/contract/tags/${encodeURIComponent(req.params.externalId)}`));
app.get("/api/contract/folders", auth, (req, res) => relayToNode(req, res, "/contract/folders"));
app.post("/api/contract/folders", auth, (req, res) => relayToNode(req, res, "/contract/folders"));
app.delete("/api/contract/folders/:externalId", auth, (req, res) => relayToNode(req, res, `/contract/folders/${encodeURIComponent(req.params.externalId)}`));
// Liste + création
app.get("/api/contract", auth, (req, res) => relayToNode(req, res, withQuery("/contract", req)));
app.post("/api/contract", auth, (req, res) => relayToNode(req, res, "/contract"));
// Sous-ressources d'un contrat
app.get("/api/contract/:externalId/document", auth, (req, res) => relayToNodeRaw(req, res, `/contract/${encodeURIComponent(req.params.externalId)}/document`));
app.get("/api/contract/:externalId/audit", auth, (req, res) => relayToNode(req, res, `/contract/${encodeURIComponent(req.params.externalId)}/audit`));
app.post("/api/contract/:externalId/validate-field", auth, (req, res) => relayToNode(req, res, `/contract/${encodeURIComponent(req.params.externalId)}/validate-field`));
app.post("/api/contract/:externalId/amendment", auth, (req, res) => relayToNode(req, res, `/contract/${encodeURIComponent(req.params.externalId)}/amendment`));
app.post("/api/contract/:externalId/version", auth, (req, res) => relayToNode(req, res, `/contract/${encodeURIComponent(req.params.externalId)}/version`));
app.post("/api/contract/:externalId/snapshot", auth, (req, res) => relayToNode(req, res, `/contract/${encodeURIComponent(req.params.externalId)}/snapshot`));
app.post("/api/contract/:externalId/archive", auth, (req, res) => relayToNode(req, res, `/contract/${encodeURIComponent(req.params.externalId)}/archive`));
// Négociation — commentaires + approbation (/comments/ avant /:externalId)
app.post("/api/contract/:externalId/comments", auth, (req, res) => relayToNode(req, res, `/contract/${encodeURIComponent(req.params.externalId)}/comments`));
app.post("/api/contract/:externalId/approval", auth, (req, res) => relayToNode(req, res, `/contract/${encodeURIComponent(req.params.externalId)}/approval`));
app.delete("/api/contract/comments/:commentId", auth, (req, res) => relayToNode(req, res, `/contract/comments/${encodeURIComponent(req.params.commentId)}`));
app.patch("/api/contract/comments/:commentId/resolve", auth, (req, res) => relayToNode(req, res, `/contract/comments/${encodeURIComponent(req.params.commentId)}/resolve`));
app.get("/api/contract/:externalId", auth, (req, res) => relayToNode(req, res, `/contract/${encodeURIComponent(req.params.externalId)}`));
app.patch("/api/contract/:externalId", auth, (req, res) => relayToNode(req, res, `/contract/${encodeURIComponent(req.params.externalId)}`));
app.delete("/api/contract/:externalId", auth, (req, res) => relayToNode(req, res, `/contract/${encodeURIComponent(req.params.externalId)}`));
// ─── Bibliothèque de clauses ───
app.get("/api/clause/stats", auth, (req, res) => relayToNode(req, res, "/clause/stats"));
app.get("/api/clause", auth, (req, res) => relayToNode(req, res, withQuery("/clause", req)));
app.post("/api/clause", auth, (req, res) => relayToNode(req, res, "/clause"));
app.post("/api/clause/:externalId/use", auth, (req, res) => relayToNode(req, res, `/clause/${encodeURIComponent(req.params.externalId)}/use`));
app.get("/api/clause/:externalId", auth, (req, res) => relayToNode(req, res, `/clause/${encodeURIComponent(req.params.externalId)}`));
app.patch("/api/clause/:externalId", auth, (req, res) => relayToNode(req, res, `/clause/${encodeURIComponent(req.params.externalId)}`));
app.delete("/api/clause/:externalId", auth, (req, res) => relayToNode(req, res, `/clause/${encodeURIComponent(req.params.externalId)}`));
// ─── Veille juridique (alertes + digest jurisprudence) ───
// Jobs du pipeline (rôle vérifié côté backNode)
app.post("/api/legal-watch/ingest", auth, (req, res) => relayToNode(req, res, "/legal-watch/ingest"));
app.post("/api/legal-watch/enrich", auth, (req, res) => relayToNode(req, res, "/legal-watch/enrich"));
app.post("/api/legal-watch/publish", auth, (req, res) => relayToNode(req, res, "/legal-watch/publish"));
app.post("/api/legal-watch/run", auth, (req, res) => relayToNode(req, res, "/legal-watch/run"));
app.post("/api/legal-watch/legal-concept", auth, (req, res) => relayToNode(req, res, "/legal-watch/legal-concept"));
// Consultation
app.get("/api/legal-watch/alerts", auth, (req, res) => relayToNode(req, res, withQuery("/legal-watch/alerts", req)));
app.patch("/api/legal-watch/alerts/:externalId", auth, (req, res) => relayToNode(req, res, `/legal-watch/alerts/${encodeURIComponent(req.params.externalId)}`));
app.get("/api/legal-watch/digest", auth, (req, res) => relayToNode(req, res, withQuery("/legal-watch/digest", req)));
app.get("/api/legal-watch/unread-count", auth, (req, res) => relayToNode(req, res, "/legal-watch/unread-count"));
app.get("/api/legal-watch/status", auth, (req, res) => relayToNode(req, res, "/legal-watch/status"));
app.get("/api/legal-watch/config", auth, (req, res) => relayToNode(req, res, "/legal-watch/config"));
app.patch("/api/legal-watch/sources/:name", auth, (req, res) => relayToNode(req, res, `/legal-watch/sources/${encodeURIComponent(req.params.name)}`));
app.patch("/api/legal-watch/concepts/:concept", auth, (req, res) => relayToNode(req, res, `/legal-watch/concepts/${encodeURIComponent(req.params.concept)}`));
// ─── Administration (gestion des utilisateurs & rôles) ───
app.get("/api/admin/users", auth, (req, res) => relayToNode(req, res, "/admin/users"));
app.patch("/api/admin/users/:idUser/role", auth, (req, res) => relayToNode(req, res, `/admin/users/${encodeURIComponent(req.params.idUser)}/role`));
app.patch("/api/admin/users/:idUser/plan", auth, (req, res) => relayToNode(req, res, `/admin/users/${encodeURIComponent(req.params.idUser)}/plan`));
// ─── Négociation (module isolé) ───
// Publiques invité (sans auth — token = secret) ; placées AVANT /:externalId.
app.get("/api/negotiation/public/:token", (req, res) => relayToNode(req, res, `/negotiation/public/${encodeURIComponent(req.params.token)}`));
app.post("/api/negotiation/public/:token/comments", (req, res) => relayToNode(req, res, `/negotiation/public/${encodeURIComponent(req.params.token)}/comments`));
// Entrée & liste
app.post("/api/negotiation/enter", auth, (req, res) => relayToNode(req, res, "/negotiation/enter"));
app.get("/api/negotiation/contract/:contractExternalId", auth, (req, res) => relayToNode(req, res, `/negotiation/contract/${encodeURIComponent(req.params.contractExternalId)}`));
// Sous-ressources (avant /:externalId nu)
app.post("/api/negotiation/:externalId/abort", auth, (req, res) => relayToNode(req, res, `/negotiation/${encodeURIComponent(req.params.externalId)}/abort`));
app.post("/api/negotiation/:externalId/exit", auth, (req, res) => relayToNode(req, res, `/negotiation/${encodeURIComponent(req.params.externalId)}/exit`));
app.post("/api/negotiation/:externalId/versions/:versionExternalId/validate", auth, (req, res) => relayToNode(req, res, `/negotiation/${encodeURIComponent(req.params.externalId)}/versions/${encodeURIComponent(req.params.versionExternalId)}/validate`));
app.post("/api/negotiation/:externalId/versions", auth, (req, res) => relayToNode(req, res, `/negotiation/${encodeURIComponent(req.params.externalId)}/versions`));
app.post("/api/negotiation/:externalId/proposals", auth, (req, res) => relayToNode(req, res, `/negotiation/${encodeURIComponent(req.params.externalId)}/proposals`));
app.patch("/api/negotiation/:externalId/proposals/:proposalExternalId", auth, (req, res) => relayToNode(req, res, `/negotiation/${encodeURIComponent(req.params.externalId)}/proposals/${encodeURIComponent(req.params.proposalExternalId)}`));
app.patch("/api/negotiation/:externalId/comments/:commentId/resolve", auth, (req, res) => relayToNode(req, res, `/negotiation/${encodeURIComponent(req.params.externalId)}/comments/${encodeURIComponent(req.params.commentId)}/resolve`));
app.post("/api/negotiation/:externalId/comments", auth, (req, res) => relayToNode(req, res, `/negotiation/${encodeURIComponent(req.params.externalId)}/comments`));
app.post("/api/negotiation/:externalId/participants", auth, (req, res) => relayToNode(req, res, `/negotiation/${encodeURIComponent(req.params.externalId)}/participants`));
app.delete("/api/negotiation/:externalId/participants/:participantExternalId", auth, (req, res) => relayToNode(req, res, `/negotiation/${encodeURIComponent(req.params.externalId)}/participants/${encodeURIComponent(req.params.participantExternalId)}`));
app.post("/api/negotiation/:externalId/guests/:guestExternalId/revoke", auth, (req, res) => relayToNode(req, res, `/negotiation/${encodeURIComponent(req.params.externalId)}/guests/${encodeURIComponent(req.params.guestExternalId)}/revoke`));
app.post("/api/negotiation/:externalId/guests", auth, (req, res) => relayToNode(req, res, `/negotiation/${encodeURIComponent(req.params.externalId)}/guests`));
app.get("/api/negotiation/:externalId", auth, (req, res) => relayToNode(req, res, `/negotiation/${encodeURIComponent(req.params.externalId)}`));
// Diff structuré délégué au microservice Python.
app.post("/api/negociation/negotiation-diff", auth, (req, res) => relayJsonToPython(req, res, "/negotiation-diff"));
// Health pour tester le serveur
app.get("/health", (req, res) => {
    return res.send({
        status: "OK",
        port: PORT,
        urlBackendPython: BACKEND_URL,
        urlBackendNodejs: BACKNODE_URL,
    });
});
// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`Serveur proxy running on : http://localhost:${PORT}`);
    console.log(`Backend Python url : ${BACKEND_URL}`);
    console.log(`Backend NodeJs url : ${BACKNODE_URL}`);
});
