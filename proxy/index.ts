/* eslint-disable no-console */
import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import http from "http";

import { proxyAuthMiddleware } from "./src/middleware/authMiddleware.js";
import { analyzeContractWithAI } from "./src/services/aiAnalyser/aiAnalyzer.js";
import type { AnalysisContext } from "./src/services/aiAnalyser/types.js";
import { detectContractWithAI } from "./src/utils/contractDetector.js";
import { performCompleteMarketAnalysis } from "./src/utils/marketAnalysis.js";
import type { MarketAnalysisResult } from "./src/utils/marketAnalysis.js";
import { getRecommendedClauses } from "./src/utils/recommendClause.js";
import { detectLegalReferences } from "./src/utils/detectLegalReferences.js";
import { fetchLegalTexts } from "./src/utils/fetchLegalTexts.js";
import { summarizeCaseInline } from "./src/utils/aiSummarizer.js";
import type { JurisprudenceCase } from "./src/utils/aiSummarizer.js";

// Charge d'abord server/.env puis la racine
dotenv.config({ path: path.resolve(process.cwd(), "server/.env") });
dotenv.config();

const app = express();
app.set("etag", false);

//Cors adapté pour prod
app.use(
  cors({
    origin: [
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
      /^https:\/\/.*\.odns\.fr$/,
      "http://localhost:5173",
    ],
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "20mb" }));
const IS_PROD = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 3000);
const BACKEND_URL = IS_PROD ? process.env.BACKEND_URL : "http://localhost:5678";
const BACKNODE_URL = IS_PROD
  ? process.env.BACKNODE_URL
  : "http://localhost:3020";

// ---- Relay vers Python backend ------------------------------------------------
function relayStreamToPython(
  req: Request,
  res: Response,
  targetPath: string,
): void {
  const backendUrl = new URL(`${BACKEND_URL}${targetPath}`);
  const options: http.RequestOptions = {
    hostname: backendUrl.hostname,
    port: Number(backendUrl.port) || 80,
    path: backendUrl.pathname,
    method: req.method,
    headers: { ...req.headers, host: backendUrl.host },
  };
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers as any);
    proxyRes.pipe(res, { end: true });
  });
  proxyReq.on("error", (e) => {
    console.error("relay Python error:", e.message);
    if (!res.headersSent) res.status(502).json({ error: "python_unreachable" });
  });
  req.pipe(proxyReq, { end: true });
}

function relayJsonToPython(
  req: Request,
  res: Response,
  targetPath: string,
  handleData?: (data: PythonJsonResponse, userId?: number) => Promise<void>,
): void {
  fetch(`${BACKEND_URL}${targetPath}`, {
    method: req.method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req.body),
  })
    .then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (handleData) await handleData(data, res.locals.userId as number | undefined);
      res.status(r.status).json(data);
    })
    .catch((e: any) => {
      console.error("relay Python error:", e.message);
      if (!res.headersSent)
        res.status(502).json({ error: "python_unreachable" });
    });
}

// Relay requêtes vers le serveur Node
function relayToNode(req: Request, res: Response, targetPath: string): void {
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
      const setCookieHeader =
        typeof (r.headers as any).getSetCookie === "function"
          ? (r.headers as any).getSetCookie()
          : r.headers.get("set-cookie");

      if (
        setCookieHeader &&
        ((Array.isArray(setCookieHeader) && setCookieHeader.length > 0) ||
          !Array.isArray(setCookieHeader))
      ) {
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
    .catch((e: any) => {
      console.error("relay Node error:", e.message);
      if (!res.headersSent)
        res.status(502).json({ error: "backnode_unreachable" });
    });
}

// Comptage consommation token
type OpenAiUsagePayload = {
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
};

type PythonJsonResponse = Record<string, any> & {
  openai_tokens?: OpenAiUsagePayload;
};

async function logOpenAiTokens(data: PythonJsonResponse, userId?: number): Promise<void> {
  const usage = data.openai_tokens;
  delete data.openai_tokens;

  if (!usage?.model) return;
  const inputTokens = Number(usage.input_tokens ?? 0);
  const outputTokens = Number(usage.output_tokens ?? 0);

  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
    console.warn("OpenAI usage ignored: invalid payload", usage);
    return;
  }

  try {
    const logResponse = await fetch(
      `${BACKNODE_URL}/llm/increment/${encodeURIComponent(usage.model)}/${Math.trunc(inputTokens)}/${Math.trunc(outputTokens)}`,
      {
        method: "PUT",
        headers: {
          "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
          ...(userId ? { "x-user-id": String(userId) } : {}),
        },
      },
    );

    if (!logResponse.ok) {
      const errorText = await logResponse.text().catch(() => "");
      console.warn("OpenAI usage log failed:", logResponse.status, errorText);
    }
  } catch (e: any) {
    console.error("OpenAI usage log error:", e.message);
  }
}

function handleExtractDocumentText(req: Request, res: Response): void {
  relayStreamToPython(req, res, "/extract-document-text");
}

function handleLegifranceSearch(req: Request, res: Response): void {
  relayJsonToPython(req, res, "/legifrance-search");
}

function handleClassifyVeille(req: Request, res: Response): void {
  relayJsonToPython(req, res, "/classify-veille");
}

function handleJurisprudence(req: Request, res: Response): void {
  relayJsonToPython(req, res, "/jurisprudence");
}

function handleAnalyzeClause(req: Request, res: Response): void {
  relayJsonToPython(req, res, "/analyze-clause", logOpenAiTokens);
}

function handleChat(req: Request, res: Response): void {
  relayJsonToPython(req, res, "/chat", logOpenAiTokens);
}

function handleOpenAiChat(req: Request, res: Response): void {
  relayJsonToPython(req, res, "/openai-chat", logOpenAiTokens);
}

function handleOpenAiChat5(req: Request, res: Response): void {
  relayJsonToPython(req, res, "/openai-chat-5", logOpenAiTokens);
}

function handleHuggingFaceGenerate(req: Request, res: Response): void {
  relayJsonToPython(req, res, "/huggingface-generate");
}

function handleInseeRequest(req: Request, res: Response): void | Response {
  if (typeof req.params.siren !== "string") {
    return res.status(400).json({
      success: false,
      message: "Bad request, le parsing du siren n'est pas conforme.",
    });
  }
  const siren = encodeURIComponent(req.params.siren);
  relayToNode(req, res, `/enterprise/insee/${siren}`);
}

function handleLlmCurrentUsage(req: Request, res: Response): void {
  relayToNode(req, res, "/llm/usage");
}

function handleLlmUsageHistory(req: Request, res: Response): void {
  // Transmet le query param ?days= tel quel au backNode
  const days = req.query.days ? `?days=${req.query.days}` : "";
  relayToNode(req, res, `/llm/usage/history${days}`);
}

function handleLlmUserUsage(req: Request, res: Response): void {
  relayToNode(req, res, "/llm/usage/me");
}

function handleLlmUsersUsage(req: Request, res: Response): void {
  relayToNode(req, res, "/llm/usage/users");
}

function handleNodeUserGet(req: Request, res: Response): void {
  relayToNode(req, res, "/user/get");
}

function handleNodeUserUpdate(req: Request, res: Response): void {
  relayToNode(req, res, "/user");
}

function handleNodeLogin(req: Request, res: Response): void {
  relayToNode(req, res, "/user/auth/login");
}

function handleNodeLogout(req: Request, res: Response): void {
  relayToNode(req, res, "/user/auth/logout");
}

function handleNodeUserPreferences(req: Request, res: Response): void {
  relayToNode(req, res, `/user/preferences`);
}

function handleNodeUserPreferencesUI(req: Request, res: Response): void {
  relayToNode(req, res, `/user/preferences/ui`);
}

function handleNodeUserTwoFactor(req: Request, res: Response): void {
  relayToNode(req, res, `/user/two-factor`);
}

function handleNodeUserTwoFactorVerify(req: Request, res: Response): void {
  relayToNode(req, res, `/user/two-factor/verify`);
}

function handleNodeUserExportData(req: Request, res: Response): void {
  relayToNode(req, res, `/user/export-data`);
}

function handleNodeUserDeleteAccount(req: Request, res: Response): void {
  relayToNode(req, res, `/user/account`);
}

function handleNodeEnterpriseGet(req: Request, res: Response): void {
  relayToNode(req, res, "/enterprise");
}

function handleNodeEnterpriseUpdate(req: Request, res: Response): void {
  relayToNode(req, res, "/enterprise");
}

function handleNodeContractHistory(req: Request, res: Response): void {
  relayToNode(req, res, "/contract-history");
}

function handleNodeChatHistory(req: Request, res: Response): void {
  relayToNode(req, res, "/chat-history");
}

function handleNodeContractHistoryItem(req: Request, res: Response): void {
  const externalId = encodeURIComponent(req.params.externalId as string);
  relayToNode(req, res, `/contract-history/${externalId}`);
}

function handleNodeContractHistoryTouch(req: Request, res: Response): void {
  const externalId = encodeURIComponent(req.params.externalId as string);
  relayToNode(req, res, `/contract-history/${externalId}/touch`);
}

function handleSignUpUser(req: Request, res: Response): void {
  relayToNode(req, res, "/user/create");
}

function handleNodeUserForgotPassword(req: Request, res: Response): void {
  relayToNode(req, res, "/user/forgotpassword");
}

function handleNodeUserResetPassword(req: Request, res: Response): void {
  relayToNode(req, res, "/user/updatepassword");
}

function handleNodeGoogle(_req: Request, res: Response): void {
  res.redirect(`${BACKNODE_URL}/auth/google`);
}

function handleBillingCustomer(req: Request, res: Response): void {
  relayToNode(req, res, "/billing/customer");
}

function handleBillingPaymentIntent(req: Request, res: Response): void {
  relayToNode(req, res, "/billing/payment-intent");
}

function handleBillingPlans(req: Request, res: Response): void {
  relayToNode(req, res, "/billing/plans");
}

function handleBillingSubscription(req: Request, res: Response): void {
  relayToNode(req, res, "/billing/subscription");
}

function handleBillingAddCredits(req: Request, res: Response): void {
  relayToNode(req, res, "/billing/add-credits");
}

function handleBillingRemoveCredits(req: Request, res: Response): void {
  relayToNode(req, res, "/billing/remove-credits");
}

function handleBillingCredits(req: Request, res: Response): void {
  relayToNode(req, res, "/billing/credits");
}

async function handleDetectContract(
  req: Request,
  res: Response,
): Promise<void> {
  const { text } = req.body as { text?: string };
  if (!text || typeof text !== "string") {
    res
      .status(400)
      .json({ success: false, message: "Le champ 'text' est requis." });
    return;
  }
  try {
    const context = await detectContractWithAI(text);
    res.json(context);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur interne";
    console.error("detect-contract error:", message);
    res.status(500).json({ success: false, message });
  }
}

async function handleMarketAnalysis(
  req: Request,
  res: Response,
): Promise<void> {
  const { contractText, contractType, detectedClauses } = req.body as {
    contractText?: string;
    contractType?: string;
    detectedClauses?: unknown[];
  };
  if (!contractText || !contractType) {
    res.status(400).json({
      success: false,
      message: "Les champs 'contractText' et 'contractType' sont requis.",
    });
    return;
  }
  try {
    const result: MarketAnalysisResult = await performCompleteMarketAnalysis(
      contractText,
      contractType,
      (detectedClauses ?? []) as any,
    );
    res.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur interne";
    console.error("market-analysis error:", message);
    res.status(500).json({ success: false, message });
  }
}

async function handleRecommendClause(
  req: Request,
  res: Response,
): Promise<void> {
  const { clause, context, model } = req.body as {
    clause?: unknown;
    context?: unknown;
    model?: string;
  };
  if (!clause) {
    res
      .status(400)
      .json({ success: false, message: "Le champ 'clause' est requis." });
    return;
  }
  try {
    const recommendations = await getRecommendedClauses(
      clause as any,
      context as any,
      model,
    );
    res.json(recommendations);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur interne";
    console.error("recommend-clause error:", message);
    res.status(500).json({ success: false, message });
  }
}

async function handleDetectLegalReferences(
  req: Request,
  res: Response,
): Promise<void> {
  const { clause } = req.body as { clause?: unknown };
  if (!clause) {
    res
      .status(400)
      .json({ success: false, message: "Le champ 'clause' est requis." });
    return;
  }
  try {
    const refs = await detectLegalReferences(clause as any);
    res.json(refs);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur interne";
    console.error("detect-legal-references error:", message);
    res.status(500).json({ success: false, message });
  }
}

async function handleFetchLegalTexts(
  req: Request,
  res: Response,
): Promise<void> {
  const { refs, clause } = req.body as { refs?: unknown; clause?: unknown };
  if (!refs) {
    res
      .status(400)
      .json({ success: false, message: "Le champ 'refs' est requis." });
    return;
  }
  try {
    const texts = await fetchLegalTexts(refs as any, clause as any);
    res.json(texts);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur interne";
    console.error("fetch-legal-texts error:", message);
    res.status(500).json({ success: false, message });
  }
}

async function handleSummarizeCase(req: Request, res: Response): Promise<void> {
  const { item } = req.body as { item?: unknown };
  if (!item) {
    res
      .status(400)
      .json({ success: false, message: "Le champ 'item' est requis." });
    return;
  }
  try {
    const summary = await summarizeCaseInline(item as JurisprudenceCase);
    res.json({ summary });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erreur interne";
    console.error("summarize-case error:", message);
    res.status(500).json({ success: false, message });
  }
}

async function handleAnalyzeContract(
  req: Request,
  res: Response,
): Promise<void> {
  const { content, context } = req.body as {
    content?: string;
    context?: AnalysisContext;
  };
  if (!content || typeof content !== "string") {
    res
      .status(400)
      .json({ success: false, message: "Le champ 'content' est requis." });
    return;
  }
  try {
    const clauses = await analyzeContractWithAI(content, context, res.locals.userId as number | undefined);
    res.json({ success: true, clauses });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    console.error("analyze-contract error:", message);
    res.status(500).json({ success: false, message });
  }
}

function handleNodeVeille(req: Request, res: Response): void {
  const qs = req.query.nocache === "1" ? "?nocache=1" : "";
  relayToNode(req, res, `/veille${qs}`);
}

function handleNodeVeilleDebug(_req: Request, res: Response): void {
  relayToNode(_req, res, "/veille/debug");
}

function handleUserUploadsGet(req: Request, res: Response): void {
  relayToNode(req, res, "/user-uploads");
}

function handleUserUploadsPost(req: Request, res: Response): void {
  relayToNode(req, res, "/user-uploads/upload");
}

function handleUserUploadsRename(req: Request, res: Response): void {
  const filename = encodeURIComponent(req.params.filename as string);
  relayToNode(req, res, `/user-uploads/${filename}`);
}

function handleUserUploadsDelete(req: Request, res: Response): void {
  const filename = encodeURIComponent(req.params.filename as string);
  relayToNode(req, res, `/user-uploads/${filename}`);
}

function handleFeedback(req: Request, res: Response): void {
  relayToNode(req, res, "/feedback");
}

// ---- Template CRUD relay -------------------------------------------------------
function handleTemplateList(req: Request, res: Response): void {
  relayToNode(req, res, "/template");
}

function handleTemplateGet(req: Request, res: Response): void {
  const id = encodeURIComponent(req.params.externalId as string);
  relayToNode(req, res, `/template/${id}`);
}

function handleTemplateUpdate(req: Request, res: Response): void {
  const id = encodeURIComponent(req.params.externalId as string);
  relayToNode(req, res, `/template/${id}`);
}

function handleTemplateDelete(req: Request, res: Response): void {
  const id = encodeURIComponent(req.params.externalId as string);
  relayToNode(req, res, `/template/${id}`);
}

function handleTemplatePlaybook(req: Request, res: Response): void {
  const id = encodeURIComponent(req.params.externalId as string);
  relayToNode(req, res, `/template/${id}/playbook`);
}

// ─── Signature electronique ───────────────────────────────────────────────────

function handleSignatureStats(req: Request, res: Response): void {
  relayToNode(req, res, "/signature-envelope/stats");
}

function handleSignatureList(req: Request, res: Response): void {
  const qs = req.query["status"] ? `?status=${encodeURIComponent(req.query["status"] as string)}` : "";
  relayToNode(req, res, `/signature-envelope${qs}`);
}

function handleSignatureCreate(req: Request, res: Response): void {
  relayToNode(req, res, "/signature-envelope");
}

function handleSignatureDelete(req: Request, res: Response): void {
  const id = encodeURIComponent(req.params.externalId as string);
  relayToNode(req, res, `/signature-envelope/${id}`);
}

// ─── Génération d'un contrat à partir d'un modèle ──────────────────────────────

const GENERATE_PROMPT_BASE = `Tu es un juriste expert en droit français. À partir du modèle de contrat ci-dessous (dont les variables ont déjà été remplacées par les valeurs fournies par le juriste), produis le contrat final en :
- Conservant le langage juridique formel et les références légales du texte source.
- Appliquant les règles, ajouts et précisions des CONSIGNES COMPLÉMENTAIRES.
- Adaptant les accords grammaticaux (genre, nombre, conjugaisons) si nécessaire.
- Ne PAS inventer de nouvelles clauses hors consignes.
- Répondre UNIQUEMENT avec le texte final du contrat en français, sans markdown, sans préambule explicatif.`;

/**
 * Substitue les marqueurs <<NAME|original>> et {{NAME}} (legacy)
 * dans le contenu, par les valeurs fournies par l'utilisateur.
 * Si une valeur n'est pas fournie, conserve le texte original (ou le marqueur legacy).
 */
function substituteMarkers(content: string, variables: Record<string, string>): string {
  // Format actuel : <<NAME|original text>>
  let out = content.replace(/<<([A-Z0-9_]+)\|([\s\S]*?)>>/g, (_match, name: string, original: string) => {
    const val = variables[name];
    return val && val.trim() ? val : original;
  });
  // Compat ancien format : {{NAME}}
  out = out.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, name: string) => {
    const val = variables[name];
    return val && val.trim() ? val : match;
  });
  return out;
}

async function handleTemplateGenerate(req: Request, res: Response): Promise<void> {
  const externalId = req.params.externalId as string;
  const { variables } = req.body as { variables?: Record<string, string> };

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
    const tplData = await tplRes.json() as { success: boolean; data?: { structure: { sections: any[]; detectedVariables: string[] } } };
    if (!tplData.success || !tplData.data) {
      res.status(404).json({ success: false, message: "Modèle introuvable." });
      return;
    }

    // 2. Récupère le playbook (peut être null)
    const pbRes = await fetch(`${BACKNODE_URL}/template/${encodeURIComponent(externalId)}/playbook`, {
      headers: internalHeaders,
    });
    const pbData = await pbRes.json() as { success: boolean; data?: { rulesText: string } | null };
    const playbookText = pbData.data?.rulesText?.trim() ?? "";

    // 3. Pré-substitution des marqueurs avec les valeurs utilisateur
    const substitutedSections = tplData.data.structure.sections.map((sec: any) => ({
      title: sec.title,
      clauses: sec.clauses.map((cl: any) => ({
        title: cl.title,
        content: substituteMarkers(cl.content, variables),
      })),
    }));

    // 4. Construit le prompt avec contenu déjà substitué + consignes
    const consignesBlock = playbookText
      ? `\n\nCONSIGNES COMPLÉMENTAIRES :\n${playbookText}\n`
      : "\n\nCONSIGNES COMPLÉMENTAIRES : (aucune règle particulière)\n";
    const docBlock = substitutedSections.map((sec: any) =>
      `## ${sec.title}\n\n` + sec.clauses.map((cl: any) =>
        cl.title ? `### ${cl.title}\n${cl.content}` : cl.content
      ).join("\n\n")
    ).join("\n\n");
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
    const aiData = await aiRes.json() as { content?: string; openai_tokens?: unknown };

    // Log tokens
    if (aiData.openai_tokens && res.locals.userId) {
      await logOpenAiTokens({ openai_tokens: aiData.openai_tokens } as any, res.locals.userId as number);
    }

    res.json({
      success: true,
      content: aiData.content ?? "",
      templateName: (tplData.data as any).meta?.name ?? null,
    });
  } catch (e: any) {
    console.error("[template/generate] error:", e.message);
    if (!res.headersSent) res.status(500).json({ success: false, message: "Erreur interne lors de la génération." });
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

async function handleTemplateImport(req: Request, res: Response): Promise<void> {
  const { fileBase64, mimeType, filename, name, contractType, aiHints } = req.body as {
    fileBase64?: string;
    mimeType?: string;
    filename?: string;
    name?: string;
    contractType?: string;
    aiHints?: string;
  };

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
    const extractData = await extractRes.json() as { success?: boolean; text?: string };
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
    const aiData = await aiRes.json() as { content?: string; openai_tokens?: unknown };

    let structure: unknown;
    try {
      const raw = (aiData.content ?? "").trim();
      // Retire les balises markdown code block si présentes
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      structure = JSON.parse(cleaned);
    } catch {
      res.status(422).json({ success: false, message: "La réponse AI n'est pas un JSON valide." });
      return;
    }

    // Log tokens
    if (aiData.openai_tokens && res.locals.userId) {
      await logOpenAiTokens({ openai_tokens: aiData.openai_tokens } as any, res.locals.userId as number);
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
  } catch (e: any) {
    console.error("[template/import] error:", e.message);
    if (!res.headersSent) res.status(500).json({ success: false, message: "Erreur interne lors de l'import." });
  }
}

async function handleUserUploadsAsset(req: Request, res: Response): Promise<void> {
  try {
    const filename = encodeURIComponent(req.params.filename as string);
    const r = await fetch(`${BACKNODE_URL}/userassets/${filename}`);
    if (!r.ok || !r.body) { res.status(r.status).end(); return; }
    res.setHeader("content-type", r.headers.get("content-type") || "image/webp");
    const { Readable } = await import("stream");
    Readable.fromWeb(r.body as any).pipe(res);
  } catch {
    if (!res.headersSent) res.status(502).end();
  }
}

// Multipart (upload PDF) — stream direct, body non consommé par express.json
app.post(
  ["/extract-document-text", "/api/extract-document-text"],
  handleExtractDocumentText,
);

// JSON routes — body déjà parsé par express.json
app.post(
  ["/legifrance-search", "/api/legifrance-search"],
  handleLegifranceSearch,
);
app.post(["/jurisprudence", "/api/jurisprudence"], handleJurisprudence);
app.post(["/classify-veille", "/api/classify-veille"], handleClassifyVeille);
app.post(["/analyze-clause", "/api/analyze-clause"], handleAnalyzeClause);
app.post(["/api/chat", "/chat"], handleChat);
app.post(["/api/openai-chat", "/openai-chat"], handleOpenAiChat);
app.post(["/api/openai-chat-5", "/openai-chat-5"], handleOpenAiChat5);
app.post(  ["/api/huggingface-generate", "/huggingface-generate"],  handleHuggingFaceGenerate,);

// Node - Requêtes Backend
const auth = proxyAuthMiddleware;

// Routes publiques (pas d'auth requise)
app.post("/api/signup", handleSignUpUser);
app.post("/api/user/auth/login", handleNodeLogin);
app.post("/api/auth/forgotpassword", handleNodeUserForgotPassword);
app.post("/api/user/resetpassword", handleNodeUserResetPassword);
app.get("/api/google", handleNodeGoogle);
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
app.get("/api/insee/:siren", auth, handleInseeRequest);
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
app.get(  "/api/contract-history/:externalId",  auth,  handleNodeContractHistoryItem,);
app.delete(  "/api/contract-history/:externalId",  auth,  handleNodeContractHistoryItem,);
app.patch(  "/api/contract-history/:externalId/touch",  auth,  handleNodeContractHistoryTouch,);
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
app.post("/api/analyze-contract", auth, handleAnalyzeContract);
app.post("/api/detect-contract", auth, handleDetectContract);
app.post("/api/market-analysis", auth, handleMarketAnalysis);
app.post("/api/recommend-clause", auth, handleRecommendClause);
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
app.get("/api/signature-envelope/public/:token", (req: Request, res: Response) => {
  relayToNode(req, res, `/signature-envelope/public/${encodeURIComponent(req.params.token as string)}`);
});
app.post("/api/signature-envelope/public/:token", (req: Request, res: Response) => {
  relayToNode(req, res, `/signature-envelope/public/${encodeURIComponent(req.params.token as string)}`);
});

// Health pour tester le serveur
app.get("/health", (req: Request, res: Response) => {
  return res.send({
    status: "OK",
    port: PORT,
    //urlBackendPython: BACKEND_URL,
    //urlBackendNodejs: BACKNODE_URL,
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur proxy running on : http://localhost:${PORT}`);
  console.log(`Backend Python url : ${BACKEND_URL}`);
  console.log(`Backend NodeJs url : ${BACKNODE_URL}`);
});
