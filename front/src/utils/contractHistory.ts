import type { ContractAnalysis } from "../types";
import type { AnalysisContext } from "../types/contextualAnalysis";
import type { TextPatch } from "../store/documentTextStore";
import type { AppliedRecommendation } from "../store/appliedRecommendationsStore";
import type { MarketAnalysisResult } from "./marketAnalysis";
import { fetchProxy } from "./fetchProxy";

export type ContractHistoryStatus = "uploaded" | "analyzed";

export interface ContractHistoryItem {
  id: string;
  fileName: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  status: ContractHistoryStatus;
  wordCount: number;
  clausesCount: number;
  activePatchCount: number;
  overallRiskScore?: number;
  contractType?: string;
}

export interface ContractHistorySnapshot {
  id: string;
  status: ContractHistoryStatus;
  savedAt: string;
  contract: ContractAnalysis;
  htmlContent: string | null;
  currentAnalysisContext: AnalysisContext | null;
  patches: TextPatch[];
  appliedRecommendations: AppliedRecommendation[];
  marketAnalysis: MarketAnalysisResult | null;
  reviewedClauseIds: string[];
}

interface CreateContractHistorySnapshotArgs {
  id: string;
  contract: ContractAnalysis;
  htmlContent: string | null;
  currentAnalysisContext: AnalysisContext | null;
  patches: TextPatch[];
  appliedRecommendations: AppliedRecommendation[];
  marketAnalysis: MarketAnalysisResult | null;
  reviewedClauseIds: string[];
}

// ---- pure helpers (no I/O) ---------------------------------------------------

export function createContractHistoryId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `contract-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createContractHistorySnapshot({
  id,
  contract,
  htmlContent,
  currentAnalysisContext,
  patches,
  appliedRecommendations,
  marketAnalysis,
  reviewedClauseIds,
}: CreateContractHistorySnapshotArgs): ContractHistorySnapshot {
  return {
    id,
    status: contract.processed ? "analyzed" : "uploaded",
    savedAt: new Date().toISOString(),
    contract,
    htmlContent,
    currentAnalysisContext,
    patches,
    appliedRecommendations,
    marketAnalysis,
    reviewedClauseIds,
  };
}

// Builds a ContractHistoryItem preview from a snapshot (used for in-memory temporary entries)
export function createContractHistoryPreviewItem(
  snapshot: ContractHistorySnapshot,
  existing?: ContractHistoryItem,
): ContractHistoryItem {
  return buildHistoryItem(normalizeSnapshot(snapshot), existing);
}

export function compareByUploadTimeDesc(
  a: ContractHistoryItem,
  b: ContractHistoryItem,
): number {
  return getUploadTime(b) - getUploadTime(a);
}

// ---- API calls ---------------------------------------------------------------

export async function loadContractHistoryIndex(): Promise<ContractHistoryItem[]> {
  try {
    const res = await fetchProxy("/api/contract-history", { credentials: "include" });
    if (!res.ok) return [];
    const payload = (await res.json()) as { success: boolean; data?: ContractHistoryItem[] };
    return payload.success && payload.data ? payload.data : [];
  } catch {
    return [];
  }
}

export async function saveContractHistorySnapshot(
  snapshot: ContractHistorySnapshot,
): Promise<ContractHistoryItem | null> {
  if (snapshot.status !== "analyzed" || !snapshot.contract?.processed) return null;

  try {
    const res = await fetchProxy("/api/contract-history", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ externalId: snapshot.id, snapshot }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { success: boolean; data?: ContractHistoryItem };
    return payload.success && payload.data ? payload.data : null;
  } catch {
    return null;
  }
}

export async function loadContractHistorySnapshot(
  id: string,
): Promise<ContractHistorySnapshot | null> {
  try {
    const res = await fetchProxy(`/api/contract-history/${encodeURIComponent(id)}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { success: boolean; data?: ContractHistorySnapshot };
    if (!payload.success || !payload.data) return null;
    return normalizeSnapshot(payload.data);
  } catch {
    return null;
  }
}

export async function touchContractHistoryEntry(id: string): Promise<void> {
  try {
    await fetchProxy(`/api/contract-history/${encodeURIComponent(id)}/touch`, {
      method: "PATCH",
      credentials: "include",
    });
  } catch {
    // fire-and-forget
  }
}

export async function deleteContractHistoryEntry(id: string): Promise<void> {
  try {
    const res = await fetchProxy(`/api/contract-history/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) console.warn("[contract history] delete failed:", res.status);
  } catch {
    console.warn("[contract history] delete error");
  }
}

// ---- internal helpers --------------------------------------------------------

function buildHistoryItem(
  snapshot: ContractHistorySnapshot,
  existing?: ContractHistoryItem,
): ContractHistoryItem {
  const now = new Date().toISOString();
  const content = snapshot.contract.content || "";
  const uploadDate = toIsoString(snapshot.contract.uploadDate) ?? now;

  return {
    id: snapshot.id,
    fileName: snapshot.contract.fileName || "Document",
    createdAt: existing?.createdAt ?? uploadDate,
    updatedAt: now,
    lastOpenedAt: existing?.lastOpenedAt ?? now,
    status: snapshot.status,
    wordCount: snapshot.contract.extractionMetadata?.wordCount ?? countWords(content),
    clausesCount: snapshot.contract.clauses?.length ?? 0,
    activePatchCount: snapshot.patches.filter((patch) => patch.active).length,
    overallRiskScore: snapshot.contract.overallRiskScore,
    contractType:
      snapshot.contract.contractType ||
      snapshot.currentAnalysisContext?.contractType ||
      undefined,
  };
}

function normalizeSnapshot(snapshot: ContractHistorySnapshot): ContractHistorySnapshot {
  return {
    ...snapshot,
    contract: normalizeContract(snapshot.contract),
    currentAnalysisContext: snapshot.currentAnalysisContext ?? null,
    htmlContent: snapshot.htmlContent ?? null,
    patches: snapshot.patches ?? [],
    appliedRecommendations: normalizeAppliedRecommendations(
      snapshot.appliedRecommendations ?? [],
    ),
    marketAnalysis: snapshot.marketAnalysis ?? null,
    reviewedClauseIds: snapshot.reviewedClauseIds ?? [],
  };
}

function normalizeContract(contract: ContractAnalysis): ContractAnalysis {
  return {
    ...contract,
    uploadDate: new Date(contract.uploadDate),
    reviewHistory: contract.reviewHistory?.map((entry) => ({
      ...entry,
      timestamp: new Date(entry.timestamp),
    })),
  };
}

function normalizeAppliedRecommendations(
  appliedRecommendations: AppliedRecommendation[],
): AppliedRecommendation[] {
  return appliedRecommendations.map((recommendation) => ({
    ...recommendation,
    appliedAt: new Date(recommendation.appliedAt),
  }));
}

function countWords(content: string): number {
  return content.trim() ? content.trim().split(/\s+/).length : 0;
}

function toIsoString(value: string | Date | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getUploadTime(item: ContractHistoryItem): number {
  return getTime(item.createdAt) || getTime(item.lastOpenedAt);
}

function getTime(value: string): number {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
