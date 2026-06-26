/**
 * Couche d'accès API de la bibliothèque de clauses (passe par le proxy).
 */
import { fetchProxy } from "../../../utils/fetchProxy";
import type { Clause, ClauseStats, ClauseInput, ClauseCategory, ClausePosition } from "./types";

const BASE = "/api/clause";

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as { success?: boolean; data?: T; message?: string };
  if (!res.ok || data.success === false) throw new Error(data.message || `Erreur ${res.status}`);
  return data.data as T;
}

export interface ClauseFilters {
  category?: ClauseCategory;
  position?: ClausePosition;
  onlyApproved?: boolean;
  q?: string;
}

function qs(f: ClauseFilters): string {
  const p = new URLSearchParams();
  if (f.category) p.set("category", f.category);
  if (f.position) p.set("position", f.position);
  if (f.onlyApproved) p.set("onlyApproved", "true");
  if (f.q) p.set("q", f.q);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const clauseApi = {
  stats: () => fetchProxy(`${BASE}/stats`, { credentials: "include" }).then(json<ClauseStats>),

  list: (f: ClauseFilters = {}) =>
    fetchProxy(`${BASE}${qs(f)}`, { credentials: "include" }).then(json<Clause[]>),

  get: (id: string) =>
    fetchProxy(`${BASE}/${id}`, { credentials: "include" }).then(json<Clause>),

  create: (payload: ClauseInput) =>
    fetchProxy(BASE, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(json<Clause>),

  update: (id: string, patch: Partial<ClauseInput>) =>
    fetchProxy(`${BASE}/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json<unknown>),

  remove: (id: string) =>
    fetchProxy(`${BASE}/${id}`, { method: "DELETE", credentials: "include" }).then(json<unknown>),
};
