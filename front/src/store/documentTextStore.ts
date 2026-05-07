import { create } from "zustand";
import FEATURE_FLAGS from "../config/features";
import { fnv1a } from "../utils/hashUtils";
import { computeDiff, DiffSegment } from "../utils/diffUtils";
import { useAppliedRecommendationsStore } from "./appliedRecommendationsStore";

export interface TextPatch {
  id: string;
  clauseId: string;
  recommendationKey: string; // unique key per recommendation
  startOrig: number; // index in ORIGINAL text
  endOrig: number; // index in ORIGINAL text (exclusive)
  originalSlice: string;
  newSlice: string;
  active: boolean;
  sliceHash?: string; // hash du segment original
}

interface DocumentTextState {
  originalText: string;
  currentText: string;
  htmlContent: string | null;
  patches: TextPatch[];
  lastAppliedRecommendationKey?: string;
  setOriginalText: (text: string) => void;
  setHtmlContent: (html: string | null) => void;
  restoreDocumentState: (state: {
    originalText: string;
    htmlContent: string | null;
    patches: TextPatch[];
  }) => void;
  applyPatch: (
    p: Omit<TextPatch, "id" | "originalSlice" | "active"> & {
      originalSlice?: string;
    },
  ) => void;
  removePatch: (recommendationKey: string) => void;
  resetAll: () => void;
  isApplied: (recommendationKey: string) => boolean;
  rebuild: () => void;
  clearLastApplied: () => void;
  getDiffSegments?: () => DiffSegment[]; // optional to avoid breaking existing consumers
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function rebuildFrom(originalText: string, patches: TextPatch[]): string {
  const active = patches
    .filter((p) => p.active)
    .sort((a, b) => a.startOrig - b.startOrig);
  if (!active.length) return originalText;
  const parts: string[] = [];
  let cursor = 0;
  for (const p of active) {
    if (cursor < p.startOrig)
      parts.push(originalText.slice(cursor, p.startOrig));
    parts.push(p.newSlice);
    cursor = p.endOrig;
  }
  if (cursor < originalText.length) parts.push(originalText.slice(cursor));
  return parts.join("");
}

export const useDocumentTextStore = create<DocumentTextState>((set, get) => ({
  originalText: "",
  currentText: "",
  htmlContent: null,
  patches: [],
  lastAppliedRecommendationKey: undefined,

  setHtmlContent: (html) => set({ htmlContent: html }),

  restoreDocumentState: ({ originalText, htmlContent, patches }) => {
    set({
      originalText,
      currentText: rebuildFrom(originalText, patches),
      htmlContent,
      patches,
      lastAppliedRecommendationKey: undefined,
    });
  },

  setOriginalText: (text) => {
    set({
      originalText: text,
      currentText: text,
      patches: [],
      lastAppliedRecommendationKey: undefined,
    });
    
  },

  applyPatch: ({
    clauseId,
    recommendationKey,
    startOrig,
    endOrig,
    newSlice,
    originalSlice,
  }) => {
    const { patches, originalText } = get();
    if (
      patches.some((p) => p.recommendationKey === recommendationKey && p.active)
    )
      return; // already applied

    // Validation basique des bornes
    if (
      startOrig < 0 ||
      endOrig <= startOrig ||
      endOrig > originalText.length
    ) {
      console.warn("[patch invalid bounds]", {
        recommendationKey,
        startOrig,
        endOrig,
        originalLength: originalText.length,
      });
      return;
    }

    const origSlice = originalSlice ?? originalText.slice(startOrig, endOrig);
    // Sanity check: mismatch -> on continue mais on log, on utilise la tranche réelle pour éviter l'abandon silencieux
    const groundTruth = originalText.slice(startOrig, endOrig);
    if (origSlice !== groundTruth) {
      console.warn(
        "[patch warning] original slice mismatch – correction automatique",
        {
          recommendationKey,
          provided: origSlice.slice(0, 80),
          expected: groundTruth.slice(0, 80),
        },
      );
    }

    // Overlap detection
    const overlap = patches.find(
      (p) => p.active && !(endOrig <= p.startOrig || startOrig >= p.endOrig),
    );
    if (overlap) {
      console.warn("[patch overlap rejected]", {
        recommendationKey,
        overlap: { start: overlap.startOrig, end: overlap.endOrig },
      });
      return;
    }
    const newPatch: TextPatch = {
      id: genId(),
      clauseId,
      recommendationKey,
      startOrig,
      endOrig,
      originalSlice: groundTruth,
      newSlice,
      active: true,
      sliceHash: FEATURE_FLAGS.ENABLE_PATCH_INTEGRITY_CHECKS
        ? fnv1a(groundTruth)
        : undefined,
    };
    console.log("[patch add]", {
      recommendationKey,
      startOrig,
      endOrig,
      originalExcerpt: groundTruth.slice(0, 60),
      newExcerpt: newSlice.slice(0, 60),
    });
    const newPatches = [
      ...patches.filter((p) => p.recommendationKey !== recommendationKey),
      newPatch,
    ];
    const currentText = rebuildFrom(originalText, newPatches);
    set({
      patches: newPatches,
      currentText,
      lastAppliedRecommendationKey: recommendationKey,
    });
  },

  removePatch: (recommendationKey) => {
    const { patches, originalText } = get();
    const newPatches = patches.map((p) =>
      p.recommendationKey === recommendationKey ? { ...p, active: false } : p,
    );
    const currentText = rebuildFrom(originalText, newPatches);
    set({ patches: newPatches, currentText });
  },

  resetAll: () => {
    const { originalText } = get();
    //Ajout du clearAppliedRecommandations dans le resetAll
    useAppliedRecommendationsStore.getState().clearAllAppliedRecommendations();
    set({
      patches: [],
      currentText: originalText,
      lastAppliedRecommendationKey: undefined,
      htmlContent: null,
    });
  },

  isApplied: (recommendationKey) =>
    get().patches.some(
      (p) => p.recommendationKey === recommendationKey && p.active,
    ),

  rebuild: () => {
    const { originalText, patches } = get();
    if (FEATURE_FLAGS.ENABLE_PATCH_INTEGRITY_CHECKS) {
      for (const p of patches) {
        if (!p.active) continue;
        const slice = originalText.slice(p.startOrig, p.endOrig);
        if (p.originalSlice !== slice) {
          console.warn("[patch integrity mismatch slice]", {
            recommendationKey: p.recommendationKey,
          });
        }
        if (p.sliceHash && p.sliceHash !== fnv1a(slice)) {
          console.warn("[patch integrity hash mismatch]", {
            recommendationKey: p.recommendationKey,
          });
        }
      }
    }
    set({ currentText: rebuildFrom(originalText, patches) });
  },

  clearLastApplied: () => set({ lastAppliedRecommendationKey: undefined }),

  getDiffSegments: () => {
    const { originalText, currentText } = get();
    return computeDiff(originalText, currentText);
  },
}));
