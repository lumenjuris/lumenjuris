/* eslint-disable no-console */
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PROD = process.env.NODE_ENV === "production";

// Charge d'abord server/.env puis la racine
dotenv.config({ path: path.resolve(process.cwd(), "server/.env") });
dotenv.config();

const app = express();

//Cord adapté pour prod
app.use(
  cors({
    origin: [
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
      /^https:\/\/.*\.odns\.fr$/,
    ],
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));
const PORT = Number(process.env.PORT || 5173);
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5678";
const BACKNODE_URL = process.env.BACKNODE_URL || "http://localhost:3020";

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
  handleData?: (data: PythonJsonResponse) => Promise<void>,
): void {
  fetch(`${BACKEND_URL}${targetPath}`, {
    method: req.method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req.body),
  })
    .then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (handleData) await handleData(data);
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

async function logOpenAiTokens(data: PythonJsonResponse): Promise<void> {
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
      { method: "PUT" },
    );

    if (!logResponse.ok) {
      const errorText = await logResponse.text().catch(() => "");
      console.warn("OpenAI usage log failed:", logResponse.status, errorText);
    }
  } catch (e: any) {
    console.error("OpenAI usage log error:", e.message);
  }
}

function handleExtractPdfText(req: Request, res: Response): void {
  relayStreamToPython(req, res, "/extract-pdf-text");
}

function handleLegifranceSearch(req: Request, res: Response): void {
  relayJsonToPython(req, res, "/legifrance-search");
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

function handleInseeRequest(req: Request, res: Response): void {
  const siren = encodeURIComponent(req.params.siren);
  relayToNode(req, res, `/enterprise/insee/${siren}`);
}

function handleLlmCurrentUsage(req: Request, res: Response): void {
  relayToNode(req, res, "/llm/usage");
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

function handleNodeUserTwoFactor(req: Request, res: Response): void {
  relayToNode(req, res, `/user/two-factor`);
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

function handleSignUpUser(req: Request, res: Response): void {
  relayToNode(req, res, "/user/create");
}

// Multipart (upload PDF) — stream direct, body non consommé par express.json
app.post("/extract-pdf-text", handleExtractPdfText);

// JSON routes — body déjà parsé par express.json
app.post(
  ["/legifrance-search", "/api/legifrance-search"],
  handleLegifranceSearch,
);
app.post(["/jurisprudence", "/api/jurisprudence"], handleJurisprudence);
app.post(["/analyze-clause", "/api/analyze-clause"], handleAnalyzeClause);
app.post(["/api/chat", "/chat"], handleChat);
app.post(["/api/openai-chat", "/openai-chat"], handleOpenAiChat);
app.post(["/api/openai-chat-5", "/openai-chat-5"], handleOpenAiChat5);
app.post(
  ["/api/huggingface-generate", "/huggingface-generate"],
  handleHuggingFaceGenerate,
);

// Node - Requêtes Backend
app.post("/api/signup", handleSignUpUser);
app.get("/api/insee/:siren", handleInseeRequest);
app.get("/api/llm/usage", handleLlmCurrentUsage);
app.get("/api/user/get", handleNodeUserGet);
app.put("/api/user", handleNodeUserUpdate);
app.post("/api/user/auth/login", handleNodeLogin);
app.post("/api/user/auth/logout", handleNodeLogout);
app.get("/api/user/preferences", handleNodeUserPreferences);
app.put("/api/user/preferences", handleNodeUserPreferences);
app.post("/api/user/two-factor", handleNodeUserTwoFactor);
app.post("/api/user/export-data", handleNodeUserExportData);
app.delete("/api/user/account", handleNodeUserDeleteAccount);
app.get("/api/enterprise", handleNodeEnterpriseGet);
app.put("/api/enterprise", handleNodeEnterpriseUpdate);

// ---- Front React : Vite middleware (dev) ou static (prod) ---------------------
if (IS_PROD) {
  // En production : servir le build Vite
  const distPath = path.resolve(__dirname, "../../dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
  app.listen(PORT, () => {
    console.log(`Serveur prod: http://localhost:${PORT}`);
  });
} else {
  // Quand npm run dev : Vite tourne en middleware dans Node
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root: path.resolve(__dirname, ".."),
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
  app.listen(PORT, () => {
    console.log(` Dev server (Vite + Proxy): http://localhost:${PORT}`);
  });
}
