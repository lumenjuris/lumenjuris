import { useMemo, useState } from "react";
import { GitCompare, CameraIcon, Loader2 } from "lucide-react";
import { contractApi } from "./api";
import type { ContractDetail } from "./types";

interface Props {
  data: ContractDetail;
  canEdit: boolean;
  onChanged: () => void;
}

type DiffLine = { type: "same" | "add" | "del"; text: string };

/** Diff ligne à ligne basé sur la plus longue sous-séquence commune (LCS). */
function diffLines(a: string, b: string): DiffLine[] {
  const aL = a.split("\n");
  const bL = b.split("\n");
  const n = aL.length, m = bL.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i]![j] = aL[i] === bL[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (aL[i] === bL[j]) { out.push({ type: "same", text: aL[i]! }); i++; j++; }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) { out.push({ type: "del", text: aL[i]! }); i++; }
    else { out.push({ type: "add", text: bL[j]! }); j++; }
  }
  while (i < n) { out.push({ type: "del", text: aL[i]! }); i++; }
  while (j < m) { out.push({ type: "add", text: bL[j]! }); j++; }
  return out;
}

/** Comparaison de versions d'un contrat (instantané + diff texte). */
export function VersionCompare({ data, canEdit, onChanged }: Props) {
  // Sources comparables : instantanés de version (avec texte) + texte actuel.
  const sources = useMemo(() => {
    const list: { key: string; label: string; text: string }[] = [];
    for (const v of data.versions) {
      if (v.contentText != null) list.push({ key: `v${v.versionNumber}`, label: `Version ${v.versionNumber}`, text: v.contentText });
    }
    list.push({ key: "current", label: "Texte actuel", text: data.ocrText ?? "" });
    return list;
  }, [data.versions, data.ocrText]);

  const [left, setLeft] = useState(sources[0]?.key ?? "current");
  const [right, setRight] = useState("current");
  const [busy, setBusy] = useState(false);

  const leftSrc = sources.find((s) => s.key === left);
  const rightSrc = sources.find((s) => s.key === right);
  const diff = useMemo(
    () => (leftSrc && rightSrc ? diffLines(leftSrc.text, rightSrc.text) : []),
    [leftSrc, rightSrc],
  );
  const stats = useMemo(() => ({
    added: diff.filter((d) => d.type === "add").length,
    removed: diff.filter((d) => d.type === "del").length,
  }), [diff]);

  async function snapshot() {
    setBusy(true);
    try {
      await contractApi.snapshot(data.id, `Instantané du ${new Date().toLocaleDateString("fr-FR")}`, data.ocrText);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const snapshotCount = sources.length - 1; // hors "texte actuel"

  return (
    <div className="bg-white rounded-card border border-line shadow-card p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-ink-muted" />
          <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Comparaison de versions</p>
        </div>
        {canEdit && (
          <button
            onClick={() => void snapshot()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-ink-secondary bg-white border border-line rounded-lg hover:bg-surface-subtle transition-all disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CameraIcon className="w-3.5 h-3.5" />}
            Enregistrer un instantané
          </button>
        )}
      </div>

      {snapshotCount === 0 ? (
        <p className="text-xs text-ink-muted italic py-4 text-center">
          Aucun instantané enregistré. Cliquez sur « Enregistrer un instantané » pour figer le texte actuel,
          puis comparez après modification.
        </p>
      ) : (
        <>
          {/* Sélecteurs */}
          <div className="flex items-center gap-2 mb-3">
            <select
              value={left}
              onChange={(e) => setLeft(e.target.value)}
              className="flex-1 bg-white border border-line px-2.5 py-1.5 rounded-lg text-xs text-ink-secondary outline-none focus:border-brand/40 cursor-pointer"
            >
              {sources.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <span className="text-ink-subtle text-xs">→</span>
            <select
              value={right}
              onChange={(e) => setRight(e.target.value)}
              className="flex-1 bg-white border border-line px-2.5 py-1.5 rounded-lg text-xs text-ink-secondary outline-none focus:border-brand/40 cursor-pointer"
            >
              {sources.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>

          {/* Résumé */}
          <div className="flex items-center gap-3 text-[11px] mb-2">
            <span className="inline-flex items-center gap-1 text-success-dark font-semibold">+{stats.added} ajout{stats.added > 1 ? "s" : ""}</span>
            <span className="inline-flex items-center gap-1 text-danger-dark font-semibold">−{stats.removed} suppression{stats.removed > 1 ? "s" : ""}</span>
          </div>

          {/* Diff */}
          <div className="rounded-panel border border-line overflow-hidden max-h-80 overflow-y-auto font-mono text-[11px] leading-relaxed">
            {diff.map((d, i) => (
              <div
                key={i}
                className={
                  d.type === "add" ? "bg-success-light/60 text-success-dark px-2 py-0.5"
                  : d.type === "del" ? "bg-danger-light/60 text-danger-dark px-2 py-0.5 line-through decoration-danger/40"
                  : "text-ink-secondary px-2 py-0.5"
                }
              >
                <span className="select-none text-ink-subtle mr-2">{d.type === "add" ? "+" : d.type === "del" ? "−" : " "}</span>
                {d.text || " "}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
