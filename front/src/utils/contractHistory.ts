import type { ContractAnalysis } from "../types";
import type { AnalysisContext } from "../types/contextualAnalysis";
import type { TextPatch } from "../store/documentTextStore";
import type { AppliedRecommendation } from "../store/appliedRecommendationsStore";
import type { MarketAnalysisResult } from "./marketAnalysis";

export type ContractHistoryStatus = "uploaded" | "analyzed";

export interface ContractHistoryItem {
  version: 1;
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
  version: 1;
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

const HISTORY_INDEX_KEY = "contract_history_index_v1";
const SNAPSHOT_KEY_PREFIX = "contract_history_snapshot_v1_";
const MAX_HISTORY_ITEMS = 20;

export function createContractHistoryId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `contract-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadContractHistoryIndex(): ContractHistoryItem[] {
  const index = readJson<ContractHistoryItem[]>(HISTORY_INDEX_KEY, []);
  const analyzedIndex = index
    .filter(isPersistedAnalyzedHistoryItem)
    .sort(compareByUploadTimeDesc);

  if (analyzedIndex.length !== index.length) {
    try {
      localStorage.setItem(HISTORY_INDEX_KEY, JSON.stringify(analyzedIndex));
      cleanupSnapshots(analyzedIndex);
    } catch (error) {
      console.warn("[contract history] migration error", error);
    }
  }

  return analyzedIndex;
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
    version: 1,
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

export function saveContractHistorySnapshot(
  snapshot: ContractHistorySnapshot,
): ContractHistoryItem | null {
  if (!canUseLocalStorage()) return null;

  try {
    const normalizedSnapshot = normalizeSnapshot(snapshot);
    if (!isPersistableSnapshot(normalizedSnapshot)) {
      discardUnanalyzedHistoryEntry(normalizedSnapshot.id);
      return null;
    }

    const index = loadContractHistoryIndex();
    const snapshotKey = buildSnapshotKey(normalizedSnapshot.id);
    localStorage.setItem(snapshotKey, JSON.stringify(normalizedSnapshot));

    const existing = index.find((item) => item.id === normalizedSnapshot.id);
    const item = buildHistoryItem(normalizedSnapshot, existing);
    const nextIndex = sortByUploadTimeDesc([
      item,
      ...index.filter((entry) => entry.id !== normalizedSnapshot.id),
    ]).slice(0, MAX_HISTORY_ITEMS);

    localStorage.setItem(HISTORY_INDEX_KEY, JSON.stringify(nextIndex));
    cleanupSnapshots(nextIndex);

    return item;
  } catch (error) {
    console.warn("[contract history] save error", error);
    return null;
  }
}

export function loadContractHistorySnapshot(
  id: string,
): ContractHistorySnapshot | null {
  if (!canUseLocalStorage()) return null;

  try {
    const raw = localStorage.getItem(buildSnapshotKey(id));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ContractHistorySnapshot;
    if (parsed.version !== 1 || parsed.id !== id) return null;

    const normalizedSnapshot = normalizeSnapshot(parsed);
    if (!isPersistableSnapshot(normalizedSnapshot)) {
      discardUnanalyzedHistoryEntry(id);
      return null;
    }

    return normalizedSnapshot;
  } catch (error) {
    console.warn("[contract history] load error", error);
    return null;
  }
}

export function createContractHistoryPreviewItem(
  snapshot: ContractHistorySnapshot,
  existing?: ContractHistoryItem,
): ContractHistoryItem {
  return buildHistoryItem(normalizeSnapshot(snapshot), existing);
}

export function touchContractHistoryEntry(id: string): ContractHistoryItem[] {
  if (!canUseLocalStorage()) return [];

  try {
    const now = new Date().toISOString();
    const nextIndex = sortByUploadTimeDesc(
      loadContractHistoryIndex().map((item) =>
        item.id === id ? { ...item, lastOpenedAt: now, updatedAt: now } : item,
      ),
    );

    localStorage.setItem(HISTORY_INDEX_KEY, JSON.stringify(nextIndex));
    return nextIndex;
  } catch (error) {
    console.warn("[contract history] touch error", error);
    return loadContractHistoryIndex();
  }
}

export function deleteContractHistoryEntry(id: string): ContractHistoryItem[] {
  if (!canUseLocalStorage()) return [];

  try {
    localStorage.removeItem(buildSnapshotKey(id));
    const nextIndex = loadContractHistoryIndex().filter(
      (item) => item.id !== id,
    );
    localStorage.setItem(HISTORY_INDEX_KEY, JSON.stringify(nextIndex));
    return nextIndex;
  } catch (error) {
    console.warn("[contract history] delete error", error);
    return loadContractHistoryIndex();
  }
}

function buildHistoryItem(
  snapshot: ContractHistorySnapshot,
  existing?: ContractHistoryItem,
): ContractHistoryItem {
  const now = new Date().toISOString();
  const content = snapshot.contract.content || "";
  const uploadDate = toIsoString(snapshot.contract.uploadDate) ?? now;
  const clausesCount = snapshot.contract.clauses?.length ?? 0;
  const wordCount =
    snapshot.contract.extractionMetadata?.wordCount ?? countWords(content);

  return {
    version: 1,
    id: snapshot.id,
    fileName: snapshot.contract.fileName || "Document",
    createdAt: existing?.createdAt ?? uploadDate,
    updatedAt: now,
    lastOpenedAt: existing?.lastOpenedAt ?? now,
    status: snapshot.status,
    wordCount,
    clausesCount,
    activePatchCount: snapshot.patches.filter((patch) => patch.active).length,
    overallRiskScore: snapshot.contract.overallRiskScore,
    contractType:
      snapshot.contract.contractType ||
      snapshot.currentAnalysisContext?.contractType ||
      undefined,
  };
}

function isPersistedAnalyzedHistoryItem(
  item: ContractHistoryItem | null | undefined,
): item is ContractHistoryItem {
  return item?.version === 1 && Boolean(item.id) && item.status === "analyzed";
}

function isPersistableSnapshot(snapshot: ContractHistorySnapshot): boolean {
  return snapshot.status === "analyzed" && snapshot.contract?.processed === true;
}

function discardUnanalyzedHistoryEntry(id: string) {
  try {
    localStorage.removeItem(buildSnapshotKey(id));
    const nextIndex = loadContractHistoryIndex().filter(
      (item) => item.id !== id,
    );
    localStorage.setItem(HISTORY_INDEX_KEY, JSON.stringify(nextIndex));
  } catch (error) {
    console.warn("[contract history] discard error", error);
  }
}

function normalizeSnapshot(
  snapshot: ContractHistorySnapshot,
): ContractHistorySnapshot {
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

function cleanupSnapshots(index: ContractHistoryItem[]) {
  const allowedIds = new Set(index.map((item) => item.id));
  Object.keys(localStorage)
    .filter(
      (key) =>
        key.startsWith(SNAPSHOT_KEY_PREFIX) &&
        !allowedIds.has(key.slice(SNAPSHOT_KEY_PREFIX.length)),
    )
    .forEach((key) => localStorage.removeItem(key));
}

function buildSnapshotKey(id: string): string {
  return `${SNAPSHOT_KEY_PREFIX}${id}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseLocalStorage()) return fallback;

  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function countWords(content: string): number {
  return content.trim() ? content.trim().split(/\s+/).length : 0;
}

function toIsoString(value: string | Date | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sortByUploadTimeDesc(
  items: ContractHistoryItem[],
): ContractHistoryItem[] {
  return [...items].sort(compareByUploadTimeDesc);
}

function compareByUploadTimeDesc(
  a: ContractHistoryItem,
  b: ContractHistoryItem,
): number {
  return getUploadTime(b) - getUploadTime(a);
}

function getUploadTime(item: ContractHistoryItem): number {
  return getTime(item.createdAt) || getTime(item.lastOpenedAt);
}

function getTime(value: string): number {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
