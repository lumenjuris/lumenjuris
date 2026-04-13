/* eslint-disable no-console */
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PROD = process.env.NODE_ENV === 'production';

// Charge d'abord server/.env puis la racine
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config();




const app = express();



//Cord adapté pour prod
app.use(cors({
  origin: [
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
    /^https:\/\/.*\.odns\.fr$/,
  ],
  credentials: true,
}));



app.use(express.json({ limit: '1mb' }));
const PORT = Number(process.env.PORT || 5173);
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5678";
const BACKNODE_URL = process.env.BACKNODE_URL || "http://localhost:3020";



// ---- Relay vers Python backend ------------------------------------------------
function relayStreamToPython(req: Request, res: Response, targetPath: string): void {
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
  proxyReq.on('error', (e) => {
    console.error('relay Python error:', e.message);
    if (!res.headersSent) res.status(502).json({ error: 'python_unreachable' });
  });
  req.pipe(proxyReq, { end: true });
}



function relayJsonToPython(req: Request, res: Response, targetPath: string): void {
  fetch(`${BACKEND_URL}${targetPath}`, {
    method: req.method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req.body),
  })
    .then(async (r) => {
      const data = await r.json().catch(() => ({}));
      res.status(r.status).json(data);
    })
    .catch((e: any) => {
      console.error('relay Python error:', e.message);
      if (!res.headersSent) res.status(502).json({ error: 'python_unreachable' });
    });
}

// Relay requêtes vers le serveur Node
function relayToNode(req: Request, res: Response, targetPath: string): void {
  fetch(`${BACKNODE_URL}${targetPath}`, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      cookie: req.headers.cookie || '',
    },
    body: req.method === 'GET' ? undefined : JSON.stringify(req.body),
  })
    .then(async (r) => {
      const contentType = r.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await r.json().catch(() => ({}));
        res.status(r.status).json(data);
        return;
      }

      const text = await r.text().catch(() => '');
      res.status(r.status).json({
        success: r.ok,
        status: r.status,
        raw: text,
      });
    })
    .catch((e: any) => {
      console.error('relay Node error:', e.message);
      if (!res.headersSent) res.status(502).json({ error: 'backnode_unreachable' });
    });
}

// Multipart (upload PDF) — stream direct, body non consommé par express.json
app.post('/extract-pdf-text', (req: Request, res: Response) => relayStreamToPython(req, res, '/extract-pdf-text'));

// JSON routes — body déjà parsé par express.json
app.post(['/legifrance-search', '/api/legifrance-search'], (req: Request, res: Response) => relayJsonToPython(req, res, '/legifrance-search'));
app.post(['/jurisprudence', '/api/jurisprudence'], (req: Request, res: Response) => relayJsonToPython(req, res, '/jurisprudence'));
app.post(['/analyze-clause', '/api/analyze-clause'], (req: Request, res: Response) => relayJsonToPython(req, res, '/analyze-clause'));
app.post(['/api/chat', '/chat'], (req: Request, res: Response) => relayJsonToPython(req, res, '/chat'));
app.post(['/api/openai-chat', '/openai-chat'], (req: Request, res: Response) => relayJsonToPython(req, res, '/openai-chat'));
app.post(['/api/openai-chat-5', '/openai-chat-5'], (req: Request, res: Response) => relayJsonToPython(req, res, '/openai-chat-5'));
app.post(['/api/huggingface-generate', '/huggingface-generate'], (req: Request, res: Response) => relayJsonToPython(req, res, '/huggingface-generate'));

// Node - Requêtes INSEE
app.get('/api/insee/:siren', (req: Request, res: Response) => {
  const siren = encodeURIComponent(req.params.siren);
  relayToNode(req, res, `/enterprise/insee/${siren}`);
});

// ---- Front React : Vite middleware (dev) ou static (prod) ---------------------
if (IS_PROD) {
  // En production : servir le build Vite
  const distPath = path.resolve(__dirname, '../../dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  app.listen(PORT, () => {
    console.log(`Serveur prod: http://localhost:${PORT}`);
  });
} else {
  // Quand npm run dev : Vite tourne en middleware dans Node
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    root: path.resolve(__dirname, '..'),
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
  app.listen(PORT, () => {
    console.log(` Dev server (Vite + Proxy): http://localhost:${PORT}`);
  });
}
