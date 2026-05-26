/** Hash utilities: léger (FNV-1a) + SHA-256 asynchrones */
export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return ("00000000" + h.toString(16)).slice(-8);
}

export async function sha256Hex(str: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return fnv1a(str); // fallback
  }
  const enc = new TextEncoder().encode(str);
  const digest = await window.crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function shortHash(str: string): string {
  // combine stable short & length for extra uniqueness
  return fnv1a(str) + "-" + str.length;
}
