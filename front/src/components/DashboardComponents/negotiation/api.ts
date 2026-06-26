/**
 * Couche d'accès API du module Négociation (passe par le proxy).
 */
import { fetchProxy } from "../../../utils/fetchProxy";
import type { NegotiationDetail, DiffResult, ProposalStatus, GuestNegotiation } from "./types";

const BASE = "/api/negotiation";

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as { success?: boolean; data?: T; message?: string };
  if (!res.ok || data.success === false) throw new Error(data.message || `Erreur ${res.status}`);
  return data.data as T;
}

function postJson(path: string, body?: unknown) {
  return fetchProxy(path, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export const negotiationApi = {
  /** Ouvre (ou réutilise) une négociation pour un contrat. */
  enter: (contractExternalId: string, title?: string) =>
    postJson(`${BASE}/enter`, { contractExternalId, title }).then(json<{ id: string; status: string }>),

  listForContract: (contractExternalId: string) =>
    fetchProxy(`${BASE}/contract/${contractExternalId}`, { credentials: "include" }).then(json<unknown[]>),

  get: (id: string) =>
    fetchProxy(`${BASE}/${id}`, { credentials: "include" }).then(json<NegotiationDetail>),

  abort: (id: string) => postJson(`${BASE}/${id}/abort`).then(json<unknown>),
  exit: (id: string) => postJson(`${BASE}/${id}/exit`).then(json<unknown>),

  // Versions
  createVersion: (id: string, contentText: string, label?: string) =>
    postJson(`${BASE}/${id}/versions`, { contentText, label }).then(json<{ id: string; versionNumber: number }>),
  validateVersion: (id: string, versionId: string) =>
    postJson(`${BASE}/${id}/versions/${versionId}/validate`).then(json<unknown>),

  // Propositions / redlines
  addProposal: (id: string, p: { clauseRef: string; proposedText: string; originalText?: string; type?: string }) =>
    postJson(`${BASE}/${id}/proposals`, p).then(json<{ id: string }>),
  setProposalStatus: (id: string, proposalId: string, status: ProposalStatus) =>
    fetchProxy(`${BASE}/${id}/proposals/${proposalId}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then(json<unknown>),

  // Annotations / commentaires (ancrés sur le texte)
  addComment: (id: string, c: { body: string; clauseRef?: string | null; visibility?: string; anchorStart?: number | null; anchorEnd?: number | null; quote?: string | null; proposedText?: string | null }) =>
    postJson(`${BASE}/${id}/comments`, c).then(json<{ id: string }>),
  resolveComment: (id: string, commentId: string, resolved: boolean) =>
    fetchProxy(`${BASE}/${id}/comments/${commentId}/resolve`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved }),
    }).then(json<unknown>),

  // Participants
  addParticipant: (id: string, p: { side: string; role: string; name?: string; email?: string }) =>
    postJson(`${BASE}/${id}/participants`, p).then(json<{ id: string }>),
  removeParticipant: (id: string, participantId: string) =>
    fetchProxy(`${BASE}/${id}/participants/${participantId}`, { method: "DELETE", credentials: "include" }).then(json<unknown>),

  // Invités
  inviteGuest: (id: string, ttlHours?: number) =>
    postJson(`${BASE}/${id}/guests`, { ttlHours }).then(json<{ id: string; token: string; expiresAt: string }>),
  revokeGuest: (id: string, guestId: string) =>
    postJson(`${BASE}/${id}/guests/${guestId}/revoke`).then(json<unknown>),

  /** Diff structuré clause par clause (délégué à FastAPI via le proxy). */
  diff: async (leftText: string, rightText: string): Promise<DiffResult> => {
    const res = await fetchProxy(`/api/negotiation-diff`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leftText, rightText }),
    });
    const data = (await res.json()) as DiffResult & { success?: boolean; message?: string };
    if (!res.ok || data.success === false) throw new Error(data.message || `Échec du diff (${res.status})`);
    return data;
  },
};

// ── Accès invité (page publique, par token) ──
export const guestApi = {
  get: (token: string) =>
    fetchProxy(`${BASE}/public/${token}`).then(json<GuestNegotiation>),
  addComment: (token: string, c: { body: string; clauseRef?: string | null; anchorStart?: number | null; anchorEnd?: number | null; quote?: string | null; proposedText?: string | null }) =>
    fetchProxy(`${BASE}/public/${token}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c),
    }).then(json<{ id: string }>),
};
