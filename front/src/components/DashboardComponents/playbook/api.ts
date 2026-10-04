/**
 * Couche d'accès API du Playbook (passe par le proxy).
 */
import { fetchProxy } from "../../../utils/fetchProxy";
import { throwIfQuotaExceeded } from "../../../utils/featureQuota";
import type {
  AnalysisSnapshot,
  PlaybookAnalysisDetail,
  PlaybookAnalysisSummary,
  PlaybookCheckResult,
  PlaybookInfo,
  PlaybookRule,
  RuleInput,
} from "./types";

const BASE = "/api/playbook";

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; data?: T; message?: string };
  if (!res.ok || data.success === false) throw new Error(data.message || `Erreur ${res.status}`);
  return data.data as T;
}

const envoyer = (method: string, body: unknown) => ({
  method,
  credentials: "include" as const,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const lire = (chemin: string) => fetchProxy(`${BASE}${chemin}`, { credentials: "include" });
const id = (v: string) => encodeURIComponent(v);

export const playbookApi = {
  // ─── Playbooks ───
  playbooks: () => lire("/playbooks").then(json<PlaybookInfo[]>),
  createPlaybook: (name: string, contractType?: string | null) =>
    fetchProxy(`${BASE}/playbooks`, envoyer("POST", { name, contractType })).then(json<PlaybookInfo>),
  renamePlaybook: (playbookId: string, name: string) =>
    fetchProxy(`${BASE}/playbooks/${id(playbookId)}`, envoyer("PATCH", { name })).then(json<void>),
  removePlaybook: (playbookId: string) =>
    fetchProxy(`${BASE}/playbooks/${id(playbookId)}`, { method: "DELETE", credentials: "include" }).then(json<void>),

  // ─── Règles ───
  list: (playbookId?: string) =>
    lire(`/rules${playbookId ? `?playbook=${id(playbookId)}` : ""}`).then(json<PlaybookRule[]>),
  create: (payload: RuleInput & { playbookId?: string }) =>
    fetchProxy(`${BASE}/rules`, envoyer("POST", payload)).then(json<PlaybookRule>),
  update: (ruleId: string, patch: Partial<RuleInput>) =>
    fetchProxy(`${BASE}/rules/${id(ruleId)}`, envoyer("PATCH", patch)).then(json<PlaybookRule>),
  remove: (ruleId: string) =>
    fetchProxy(`${BASE}/rules/${id(ruleId)}`, { method: "DELETE", credentials: "include" }).then(json<void>),

  // ─── Analyse ───
  /** Compare un contrat aux règles actives du playbook choisi (par défaut : le playbook principal). */
  check: async (content: string, playbookId?: string): Promise<PlaybookCheckResult> => {
    const res = await fetchProxy(`${BASE}/check`, envoyer("POST", { content, playbookId }));
    await throwIfQuotaExceeded(res, "analyzerPlaybook");
    const data = (await res.json().catch(() => ({}))) as PlaybookCheckResult & { success?: boolean; message?: string };
    if (!res.ok || data.success === false) throw new Error(data.message || "L'analyse playbook n'a pas pu être réalisée.");
    return data;
  },

  // ─── Historique ───
  analyses: () => lire("/analyses").then(json<PlaybookAnalysisSummary[]>),
  analysis: (analysisId: string) => lire(`/analyses/${id(analysisId)}`).then(json<PlaybookAnalysisDetail>),
  saveAnalysis: (payload: { fileName: string; playbookId?: string; summary: PlaybookCheckResult["summary"]; snapshot: AnalysisSnapshot }) =>
    fetchProxy(`${BASE}/analyses`, envoyer("POST", payload)).then(json<{ id: string }>),
  updateAnalysis: (analysisId: string, payload: { summary: PlaybookCheckResult["summary"]; snapshot: AnalysisSnapshot }) =>
    fetchProxy(`${BASE}/analyses/${id(analysisId)}`, envoyer("PATCH", payload)).then(json<{ id: string }>),
  removeAnalysis: (analysisId: string) =>
    fetchProxy(`${BASE}/analyses/${id(analysisId)}`, { method: "DELETE", credentials: "include" }).then(json<void>),
};
