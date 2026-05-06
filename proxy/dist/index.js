/* eslint-disable no-console */
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import http from "http";
// Charge d'abord server/.env puis la racine
dotenv.config({ path: path.resolve(process.cwd(), "server/.env") });
dotenv.config();
const app = express();
//Cors adapté pour prod
app.use(cors({
    origin: [
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
        /^https:\/\/.*\.odns\.fr$/,
    ],
    credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
const IS_PROD = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT || 5173);
const BACKEND_URL = IS_PROD ? process.env.BACKEND_URL : "http://localhost:5678";
const BACKNODE_URL = IS_PROD ? process.env.BACKNODE_URL : "http://localhost:3020";
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
            await handleData(data);
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
async function logOpenAiTokens(data) {
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
        const logResponse = await fetch(`${BACKNODE_URL}/llm/increment/${encodeURIComponent(usage.model)}/${Math.trunc(inputTokens)}/${Math.trunc(outputTokens)}`, { method: "PUT" });
        if (!logResponse.ok) {
            const errorText = await logResponse.text().catch(() => "");
            console.warn("OpenAI usage log failed:", logResponse.status, errorText);
        }
    }
    catch (e) {
        console.error("OpenAI usage log error:", e.message);
    }
}
function handleExtractPdfText(req, res) {
    relayStreamToPython(req, res, "/extract-pdf-text");
}
function handleLegifranceSearch(req, res) {
    relayJsonToPython(req, res, "/legifrance-search");
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
        return res.json({
            success: false,
            message: "Bad request, le parsing de du siren n'est pas conforme."
        });
    }
    const siren = encodeURIComponent(req.params.siren);
    relayToNode(req, res, `/enterprise/insee/${siren}`);
}
function handleLlmCurrentUsage(req, res) {
    relayToNode(req, res, "/llm/usage");
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
function handleSignUpUser(req, res) {
    relayToNode(req, res, "/user/create");
}
function handleNodeUserForgotPassword(req, res) {
    relayToNode(req, res, "/user/forgotpassword");
}
function handleNodeUserResetPassword(req, res) {
    relayToNode(req, res, "/user/updatepassword");
}
// Multipart (upload PDF) — stream direct, body non consommé par express.json
app.post("/extract-pdf-text", handleExtractPdfText);
// JSON routes — body déjà parsé par express.json
app.post(["/legifrance-search", "/api/legifrance-search"], handleLegifranceSearch);
app.post(["/jurisprudence", "/api/jurisprudence"], handleJurisprudence);
app.post(["/analyze-clause", "/api/analyze-clause"], handleAnalyzeClause);
app.post(["/api/chat", "/chat"], handleChat);
app.post(["/api/openai-chat", "/openai-chat"], handleOpenAiChat);
app.post(["/api/openai-chat-5", "/openai-chat-5"], handleOpenAiChat5);
app.post(["/api/huggingface-generate", "/huggingface-generate"], handleHuggingFaceGenerate);
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
app.post("/api/user/two-factor/verify", handleNodeUserTwoFactorVerify);
app.post("/api/user/export-data", handleNodeUserExportData);
app.delete("/api/user/account", handleNodeUserDeleteAccount);
app.get("/api/enterprise", handleNodeEnterpriseGet);
app.put("/api/enterprise", handleNodeEnterpriseUpdate);
app.post("/api/auth/forgotpassword", handleNodeUserForgotPassword);
app.post("/api/user/resetpassword", handleNodeUserResetPassword);
// Health pour tester le serveur
app.get("/health", (req, res) => {
    return res.send({
        status: "OK",
        port: PORT,
        urlBackendPython: BACKEND_URL,
        urlBackendNodejs: BACKNODE_URL
    });
});
// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`Serveur prod: http://localhost:${PORT}`);
    console.log(`Backend Python url : ${BACKEND_URL}`);
    console.log(`Backend NodeJs url : ${BACKNODE_URL}`);
});
