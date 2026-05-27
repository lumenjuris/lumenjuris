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
    return res.json({
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
app.post(
  ["/api/huggingface-generate", "/huggingface-generate"],
  handleHuggingFaceGenerate,
);

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

// Routes protégées (JWT vérifié par le proxy)
app.post("/api/user/auth/logout", auth, handleNodeLogout);
app.get("/api/insee/:siren", auth, handleInseeRequest);
app.get("/api/llm/usage", auth, handleLlmCurrentUsage);
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
app.get(
  "/api/contract-history/:externalId",
  auth,
  handleNodeContractHistoryItem,
);
app.delete(
  "/api/contract-history/:externalId",
  auth,
  handleNodeContractHistoryItem,
);
app.patch(
  "/api/contract-history/:externalId/touch",
  auth,
  handleNodeContractHistoryTouch,
);
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

// Health pour tester le serveur
app.get("/health", (req: Request, res: Response) => {
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
