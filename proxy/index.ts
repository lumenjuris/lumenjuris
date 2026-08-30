/* eslint-disable no-console */
import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser"
import { PORT, BACKEND_URL, BACKNODE_URL } from "./src/config.js";


import { llmRouter } from "./src/routes/llm.js";
import { billingRouter } from "./src/routes/billing.js";
import { signatureRouter } from "./src/routes/signature.js";
import { clauseRouter } from "./src/routes/clause.js";
import { templateRouter } from "./src/routes/template.js";
import { contractRouter } from "./src/routes/contract.js";
import { negotiationRouter } from "./src/routes/negociation.js";
import { legalWatchRouter } from "./src/routes/legalWatch.js";
import { feedbackRouter } from "./src/routes/feedback.js";
import { loggerRouter } from "./src/routes/logger.js";
import { userRouter } from "./src/routes/user.js";
import { contractHistoryRouter } from "./src/routes/contractHistory.js";
import { enterpriseRouter } from "./src/routes/enterprise.js";
import { userUploadsRouter } from "./src/routes/userUploads.js";
import { addinRouter } from "./src/routes/addin.js";
import { analyzerRouter } from "./src/routes/analyzer.js";
import { chatHistoryRouter } from "./src/routes/chatHistory.js";
import { veilleRouter } from "./src/routes/veille.js";
import { openaiRouter } from "./src/routes/callopenai.js";
import { legalTextRouter } from "./src/routes/legalText.js";
import { aiRouter } from "./src/routes/ai.js";
import { adminRouter } from "./src/routes/admin.js";
import { summarizeContractRouter } from "./src/routes/summarizeContract.js";
import { globalErrorHandler } from "./src/middleware/globalErrorHandler.js";
import { addErrorFeedbackLogger } from "./src/middleware/loggerFeedback.js";



const app = express();
app.set("etag", false);
// Le proxy est derriere le reverse proxy de l'hebergeur : sans ce reglage,
// req.ip vaut 127.0.0.1 et l'IP reelle du visiteur n'est pas relayee a backNode.
app.set("trust proxy", 1);

//Cors adapté pour prod
app.use(
  cors({
    origin: [
      /^http:\/\/localhost:\d+$/,
      /^https:\/\/localhost:\d+$/, // complément Word (dev server HTTPS)
      /^http:\/\/127\.0\.0\.1:\d+$/,
      /^https:\/\/.*\.odns\.fr$/,
      "http://localhost:5173",
      "https://beta.lumenjuris.com"
    ],
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "80mb" }));

app.use(addErrorFeedbackLogger);

// ─── Montage des routers par domaine ───
app.use("/api/llm", llmRouter);
app.use("/api/billing", billingRouter);
app.use("/api/signature-envelope", signatureRouter);
app.use("/api/clause", clauseRouter);
app.use("/api/template", templateRouter);
app.use("/api/contract", contractRouter);
app.use("/api/negotiation", negotiationRouter);
app.use("/api/legal-watch", legalWatchRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/logger", loggerRouter);
app.use("/api/user", userRouter);
app.use("/api/contract-history", contractHistoryRouter);
app.use("/api/enterprise", enterpriseRouter);
app.use("/api/user-uploads", userUploadsRouter);
app.use("/api/addin", addinRouter);
app.use("/api/analyzer", analyzerRouter);
app.use("/api/chat-history", chatHistoryRouter);;
app.use("/api/veille", veilleRouter);
app.use("/api/openai", openaiRouter);
app.use("/api/legal-text", legalTextRouter);
app.use("/api/ai", aiRouter);
app.use("/api/admin", adminRouter)
app.use("/api/summarize-contract", summarizeContractRouter)
app.use("/api/delete-summarize-contract", summarizeContractRouter);




app.get("/api/google", (req, res) => { res.redirect(`${BACKNODE_URL}/auth/google`)});


// Health pour tester le serveur
app.get("/health", (req: Request, res: Response) => {
  return res.send({
    status: "OK",
    port: PORT,
  });
});

app.use(globalErrorHandler);


// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur proxy running on : http://localhost:${PORT}`);
  console.log(`Backend Python url : ${BACKEND_URL}`);
  console.log(`Backend NodeJs url : ${BACKNODE_URL}`);
});
