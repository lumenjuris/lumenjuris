/**
 * Couche d'accès API de la Contrathèque (passe par le proxy).
 * Toutes les requêtes envoient le cookie d'auth (`credentials: "include"`).
 */
import { fetchProxy } from "../../../utils/fetchProxy";
import type {
  ContractStats, ContractListItem, ContractDetail, ListFilters,
  TagDTO, FolderDTO, ExtractedField, ValidationStatus, DeadlineEvent,
} from "./types";

const BASE = "/api/contract";

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as { success?: boolean; data?: T; message?: string };
  if (!res.ok || data.success === false) throw new Error(data.message || `Erreur ${res.status}`);
  return data.data as T;
}

function qs(f: ListFilters): string {
  const p = new URLSearchParams();
  if (f.status) p.set("status", f.status);
  if (f.type) p.set("type", f.type);
  if (f.counterparty) p.set("counterparty", f.counterparty);
  if (f.responsible) p.set("responsible", f.responsible);
  if (f.folder) p.set("folder", f.folder);
  if (f.tags?.length) p.set("tags", f.tags.join(","));
  if (f.isB2C === true) p.set("isB2C", "true");
  if (f.isB2C === false) p.set("isB2C", "false");
  if (f.q) p.set("q", f.q);
  if (f.signedFrom) p.set("signedFrom", f.signedFrom);
  if (f.signedTo) p.set("signedTo", f.signedTo);
  if (f.endFrom) p.set("endFrom", f.endFrom);
  if (f.endTo) p.set("endTo", f.endTo);
  if (f.sortBy) p.set("sortBy", f.sortBy);
  if (f.sortDir) p.set("sortDir", f.sortDir);
  if (f.page) p.set("page", String(f.page));
  if (f.pageSize) p.set("pageSize", String(f.pageSize));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const contractApi = {
  stats: () => fetchProxy(`${BASE}/stats`, { credentials: "include" }).then(json<ContractStats>),

  list: (f: ListFilters) =>
    fetchProxy(`${BASE}${qs(f)}`, { credentials: "include" }).then(json<{ items: ContractListItem[]; total: number }>),

  deadlines: (horizonDays = 365) =>
    fetchProxy(`${BASE}/deadlines?horizonDays=${horizonDays}`, { credentials: "include" }).then(json<DeadlineEvent[]>),

  get: (id: string) =>
    fetchProxy(`${BASE}/${id}`, { credentials: "include" }).then(json<ContractDetail>),

  create: (payload: Record<string, unknown>) =>
    fetchProxy(BASE, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(json<{ id: string }>),

  update: (id: string, patch: Record<string, unknown>) =>
    fetchProxy(`${BASE}/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json<unknown>),

  validateField: (id: string, fieldKey: string, value: string | null, status: ValidationStatus) =>
    fetchProxy(`${BASE}/${id}/validate-field`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldKey, value, status }),
    }).then(json<unknown>),

  addAmendment: (id: string, payload: Record<string, unknown>) =>
    fetchProxy(`${BASE}/${id}/amendment`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(json<{ id: string }>),

  archive: (id: string, archived: boolean) =>
    fetchProxy(`${BASE}/${id}/archive`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    }).then(json<unknown>),

  // ── Négociation : commentaires ──
  addComment: (id: string, body: string) =>
    fetchProxy(`${BASE}/${id}/comments`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }).then(json<unknown>),

  resolveComment: (commentId: string, resolved: boolean) =>
    fetchProxy(`${BASE}/comments/${commentId}/resolve`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved }),
    }).then(json<unknown>),

  deleteComment: (commentId: string) =>
    fetchProxy(`${BASE}/comments/${commentId}`, { method: "DELETE", credentials: "include" }).then(json<unknown>),

  // ── Négociation : workflow d'approbation ──
  setApproval: (id: string, status: string, note: string | null) =>
    fetchProxy(`${BASE}/${id}/approval`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note }),
    }).then(json<unknown>),

  // ── Négociation : instantané de version (pour comparaison) ──
  snapshot: (id: string, note: string | null, contentText: string | null) =>
    fetchProxy(`${BASE}/${id}/snapshot`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, contentText }),
    }).then(json<unknown>),

  /** Suggestion de reformulation d'une clause par l'IA (réutilise /openai-chat-5). */
  reformulateClause: async (clauseText: string, instruction: string): Promise<string> => {
    const prompt = `Tu es juriste expert en droit français des contrats. Reformule la clause ci-dessous ${instruction ? `en tenant compte de cette consigne : « ${instruction} ». ` : "pour la rendre plus claire, équilibrée et juridiquement robuste. "}Réponds UNIQUEMENT avec le texte reformulé de la clause, sans préambule ni explication.\n\nClause à reformuler :\n"""\n${clauseText}\n"""`;
    const res = await fetchProxy("/api/openai-chat-5", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, reasoning: "none", verbosity: "medium", model: "gpt-5.4-nano" }),
    });
    const data = (await res.json()) as { content?: string; detail?: string };
    if (!res.ok) throw new Error(data.detail || `Échec de la reformulation (${res.status})`);
    return (data.content ?? "").trim();
  },

  remove: (id: string) =>
    fetchProxy(`${BASE}/${id}`, { method: "DELETE", credentials: "include" }).then(json<unknown>),

  // Tags
  listTags: () => fetchProxy(`${BASE}/tags`, { credentials: "include" }).then(json<TagDTO[]>),
  createTag: (label: string, color: string) =>
    fetchProxy(`${BASE}/tags`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, color }),
    }).then(json<{ id: string }>),

  // Dossiers
  listFolders: () => fetchProxy(`${BASE}/folders`, { credentials: "include" }).then(json<FolderDTO[]>),
  createFolder: (name: string, parentExternalId?: string | null) =>
    fetchProxy(`${BASE}/folders`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentExternalId }),
    }).then(json<{ id: string }>),

  /** Extraction IA des métadonnées (multipart, relayé vers Python). */
  extract: async (file: File): Promise<{ fields: ExtractedField[]; ocr_text: string; filename: string }> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("scan", "false");
    const res = await fetchProxy(`${BASE}/extract`, { method: "POST", credentials: "include", body: fd });
    const data = (await res.json()) as { success?: boolean; fields?: ExtractedField[]; ocr_text?: string; filename?: string; detail?: string };
    if (!res.ok || data.success === false) throw new Error(data.detail || `Échec de l'extraction (${res.status})`);
    return { fields: data.fields ?? [], ocr_text: data.ocr_text ?? "", filename: data.filename ?? file.name };
  },

  /** URL du document PDF (déchiffré côté serveur). */
  documentUrl: (id: string) => `${import.meta.env.VITE_URL_PROXY}${BASE}/${id}/document`,

  /** Récupère le PDF en blob (avec cookie) pour affichage iframe. */
  documentBlob: async (id: string): Promise<string> => {
    const res = await fetchProxy(`${BASE}/${id}/document`, { credentials: "include" });
    if (!res.ok) throw new Error("Document indisponible");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  /** Déclenche le téléchargement CSV via le navigateur. */
  exportCsv: (f: ListFilters) => {
    const url = `${import.meta.env.VITE_URL_PROXY}${BASE}/export.csv${qs(f)}`;
    window.open(url, "_blank");
  },
};
