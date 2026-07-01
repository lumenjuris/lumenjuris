/** Découpe un contenu de bloc en segments texte / variables inline. */
export type Segment =
  | { type: "text"; text: string }
  | { type: "var"; name: string };

export function splitSegments(content: string): Segment[] {
  const out: Segment[] = [];
  const re = /\{\{([a-zA-Z0-9_]+)\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) out.push({ type: "text", text: content.slice(last, m.index) });
    out.push({ type: "var", name: m[1] });
    last = m.index + m[0].length;
  }
  if (last < content.length) out.push({ type: "text", text: content.slice(last) });
  return out;
}
