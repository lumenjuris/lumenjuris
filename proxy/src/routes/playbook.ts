import { Router } from "express";
import type { Request, Response } from "express";
import { proxyAuthMiddleware as auth } from "../middleware/authMiddleware.js";
import { relayToNode, withQuery } from "../relay.js";
import { trackFeature } from "../tracking.js";
import { hasQuota, consumeQuota } from "../quota.js";
import { BACKNODE_URL } from "../config.js";
import { callPythonOpenAi } from "../services/aiAnalyser/aiAnalyzer.js";
import {
  buildPlaybookPrompt,
  parsePlaybookResponse,
  preselectRules,
  summarize,
  type PlaybookRule,
} from "../services/playbook/playbookEngine.js";

// Monté sur "/api/playbook" — chemins relatifs, relayés tels quels vers backNode "/playbook".
export const playbookRouter: Router = Router();

const versNode = (req: Request, res: Response) => {
  const chemin = req.path.split("/").map((p) => encodeURIComponent(decodeURIComponent(p))).join("/");
  relayToNode(req, res, withQuery(`/playbook${chemin}`, req));
};

// ─── Playbooks, règles et historique (relais vers backNode) ───
playbookRouter.get(["/playbooks", "/rules", "/analyses", "/analyses/:id"], auth, versNode);
playbookRouter.post(["/playbooks", "/analyses"], auth, versNode);
playbookRouter.patch(["/playbooks/:id", "/rules/:id", "/analyses/:id"], auth, versNode);
playbookRouter.delete(["/playbooks/:id", "/rules/:id", "/analyses/:id"], auth, versNode);
playbookRouter.post("/rules", auth, (req, res) => {
  void trackFeature("playbook_rules", res.locals.userId as number | undefined);
  versNode(req, res);
});

/** Règles actives d'un playbook de l'utilisateur, lues dans backNode avec son identité. */
async function reglesActives(cookie: string, userId: number, role: string, playbookId?: string): Promise<PlaybookRule[]> {
  const qs = new URLSearchParams({ active: "true" });
  if (playbookId) qs.set("playbook", playbookId);
  const r = await fetch(`${BACKNODE_URL}/playbook/rules?${qs}`, {
    headers: {
      cookie,
      "x-internal-api-key": process.env.INTERNAL_API_KEY || "",
      "x-user-id": String(userId),
      "x-user-role": role,
    },
  });
  if (!r.ok) throw new Error(`backNode ${r.status}`);
  const payload = (await r.json()) as { data?: PlaybookRule[] };
  return payload.data ?? [];
}

/**
 * Analyse playbook d'un contrat. Indépendante de /api/analyzer/analyze-contract :
 * si elle échoue, l'analyse juridique n'est pas touchée.
 * Pas de règle pertinente → réponse immédiate, sans appel IA ni crédit consommé.
 */
playbookRouter.post("/check", auth, async (req, res) => {
  const { content, playbookId } = req.body as { content?: string; playbookId?: string };
  if (!content || typeof content !== "string") {
    res.status(400).json({ success: false, message: "Le champ 'content' est requis." });
    return;
  }
  const userId = res.locals.userId as number;
  const role = String(res.locals.role ?? "USER");

  try {
    const regles = await reglesActives(req.headers.cookie || "", userId, role, typeof playbookId === "string" ? playbookId : undefined);
    const pertinentes = preselectRules(content, regles);
    const base = { success: true, totalRules: regles.length, relevantRules: pertinentes.length };

    if (pertinentes.length === 0) {
      res.json({ ...base, findings: [], summary: summarize([]) });
      return;
    }

    if (!(await hasQuota("analyzerPlaybook", userId))) {
      res.status(402).json({
        success: false,
        code: "QUOTA_EXCEEDED",
        message: "Quota d'analyses playbook épuisé. Passez à un plan supérieur pour continuer.",
      });
      return;
    }

    const brut = await callPythonOpenAi(buildPlaybookPrompt(content, pertinentes), userId);
    const findings = parsePlaybookResponse(brut, pertinentes, content);
    await consumeQuota("analyzerPlaybook", userId, 1);
    void trackFeature("playbook_check", userId);
    res.json({ ...base, findings, summary: summarize(findings) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur interne";
    console.error("playbook check error:", message);
    res.status(500).json({ success: false, message: "L'analyse playbook n'a pas pu être réalisée." });
  }
});
