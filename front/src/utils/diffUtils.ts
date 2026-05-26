// Small, non-invasive diff utility (line-oriented fallback to character spans)
// Designed to be pure/read-only so it cannot break existing patch system.
import FEATURE_FLAGS from "../config/features";

export interface DiffSegment {
  type: "equal" | "replace";
  origStart: number;
  origEnd: number;
  newStart: number;
  newEnd: number;
  originalText: string;
  newText: string;
}

// Simple LCS-based diff limited to replacements (no explicit insert/delete separate types)
// If feature flag disabled, returns a single replacement covering entire change when texts differ.
export function computeDiff(
  originalText: string,
  modifiedText: string,
): DiffSegment[] {
  if (!FEATURE_FLAGS.ENABLE_PATCH_DIFF_COMPUTE) {
    if (originalText === modifiedText) {
      return [
        {
          type: "equal",
          origStart: 0,
          origEnd: originalText.length,
          newStart: 0,
          newEnd: modifiedText.length,
          originalText,
          newText: modifiedText,
        },
      ];
    }
    return [
      {
        type: "replace",
        origStart: 0,
        origEnd: originalText.length,
        newStart: 0,
        newEnd: modifiedText.length,
        originalText,
        newText: modifiedText,
      },
    ];
  }

  // Fast path identical
  if (originalText === modifiedText) {
    return [
      {
        type: "equal",
        origStart: 0,
        origEnd: originalText.length,
        newStart: 0,
        newEnd: modifiedText.length,
        originalText,
        newText: modifiedText,
      },
    ];
  }

  // Find common prefix
  let prefix = 0;
  const minLen = Math.min(originalText.length, modifiedText.length);
  while (prefix < minLen && originalText[prefix] === modifiedText[prefix])
    prefix++;

  // Find common suffix
  let suffix = 0;
  while (
    suffix < minLen - prefix &&
    originalText[originalText.length - 1 - suffix] ===
      modifiedText[modifiedText.length - 1 - suffix]
  ) {
    suffix++;
  }

  const segs: DiffSegment[] = [];
  if (prefix > 0) {
    segs.push({
      type: "equal",
      origStart: 0,
      origEnd: prefix,
      newStart: 0,
      newEnd: prefix,
      originalText: originalText.slice(0, prefix),
      newText: modifiedText.slice(0, prefix),
    });
  }

  const origChangedStart = prefix;
  const origChangedEnd = originalText.length - suffix;
  const newChangedStart = prefix;
  const newChangedEnd = modifiedText.length - suffix;

  segs.push({
    type: "replace",
    origStart: origChangedStart,
    origEnd: origChangedEnd,
    newStart: newChangedStart,
    newEnd: newChangedEnd,
    originalText: originalText.slice(origChangedStart, origChangedEnd),
    newText: modifiedText.slice(newChangedStart, newChangedEnd),
  });

  if (suffix > 0) {
    segs.push({
      type: "equal",
      origStart: originalText.length - suffix,
      origEnd: originalText.length,
      newStart: modifiedText.length - suffix,
      newEnd: modifiedText.length,
      originalText: originalText.slice(originalText.length - suffix),
      newText: modifiedText.slice(modifiedText.length - suffix),
    });
  }
  return segs;
}

export function summarizeDiff(segs: DiffSegment[]) {
  let replacedChars = 0;
  let equalChars = 0;
  for (const s of segs) {
    if (s.type === "equal") equalChars += s.originalText.length;
    else replacedChars += s.originalText.length + s.newText.length;
  }
  return { segments: segs.length, replacedChars, equalChars };
}
