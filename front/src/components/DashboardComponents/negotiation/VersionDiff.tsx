import { useEffect, useMemo, useState } from "react";
import { GitCompare, Loader2, FilePlus2, CheckCircle2 } from "lucide-react";
import { negotiationApi } from "./api";
import type { NegotiationDetail, DiffResult, DiffClause } from "./types";

interface Props {
  data: NegotiationDetail;
  canEdit: boolean;
  onChanged: () => void;
}

const CLAUSE_STATUS: Record<DiffClause["status"], { label: string; bg: string; fg: string }> = {
  unchanged: { label: "Inchangée", bg: "#f1f5f9", fg: "#64748b" },
  modified: { label: "Modifiée", bg: "#fef3c7", fg: "#92400e" },
  added: { label: "Ajoutée", bg: "#d1fae5", fg: "#065f46" },
  removed: { label: "Supprimée", bg: "#fee2e2", fg: "#991b1b" },
};

/** Comparaison de deux versions : sélection + diff structuré (Python). */
export function VersionDiff({ data, canEdit, onChanged }: Props) {
  const versions = data.versions;
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Nouvelle version
  const [newText, setNewText] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);

  // Défauts : avant-dernière vs dernière
  useEffect(() => {
    if (versions.length >= 2) {
      setLeft(versions[versions.length - 2]!.id);
      setRight(versions[versions.length - 1]!.id);
    } else if (versions.length === 1) {
      setLeft(versions[0]!.id); setRight(versions[0]!.id);
    }
  }, [versions.length]);

  const leftV = useMemo(() => versions.find((v) => v.id === left), [versions, left]);
  const rightV = useMemo(() => versions.find((v) => v.id === right), [versions, right]);

  async function runDiff() {
    if (!leftV || !rightV) return;
    setLoading(true); setError(""); setDiff(null);
    try {
      setDiff(await negotiationApi.diff(leftV.contentText, rightV.contentText));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la comparaison");
    } finally {
      setLoading(false);
    }
  }

  async function createVersion() {
    if (!newText.trim()) return;
    setCreating(true);
    try {
      await negotiationApi.createVersion(data.id, newText, newLabel.trim() || undefined);
      setNewText(""); setNewLabel("");
      onChanged();
    } finally { setCreating(false); }
  }

  async function validate(versionId: string) {
    if (!confirm("Valider cette version comme version finale (prête pour signature) ?")) return;
    await negotiationApi.validateVersion(data.id, versionId);
    onChanged();
  }

  return (
    <div className="bg-white rounded-card border border-line shadow-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <GitCompare className="w-4 h-4 text-ink-muted" />
        <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Versions & comparaison</p>
        <span className="text-[10px] font-semibold text-ink-subtle bg-surface-muted px-1.5 py-0.5 rounded-chip">{versions.length}</span>
      </div>

      {/* Créer une version (round de négo) */}
      {canEdit && (
        <div className="rounded-panel border border-line p-3 space-y-2">
          <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-wide">Nouveau round (version immuable)</p>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Libellé (ex. « Retour contrepartie »)"
            className="w-full text-sm px-3 py-1.5 border border-line rounded-lg outline-none focus:border-brand/40 placeholder:text-ink-placeholder"
          />
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            rows={4}
            placeholder="Collez le texte du contrat pour cette version…"
            className="w-full text-sm px-3 py-2 border border-line rounded-lg outline-none focus:border-brand/40 resize-y placeholder:text-ink-placeholder font-mono leading-relaxed"
          />
          <button
            onClick={() => void createVersion()}
            disabled={creating || !newText.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-hover transition-all disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FilePlus2 className="w-3.5 h-3.5" />}
            Enregistrer la version {versions.length + 1}
          </button>
        </div>
      )}

      {versions.length === 0 ? (
        <p className="text-xs text-ink-muted italic py-3 text-center">Aucune version. Créez le premier round ci-dessus.</p>
      ) : (
        <>
          {/* Liste des versions + validation */}
          <div className="space-y-1.5">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-lg bg-surface-subtle">
                <span className="font-medium text-ink">
                  v{v.versionNumber}{v.label ? ` · ${v.label}` : ""}
                  {v.isFinal && <span className="ml-2 text-[9px] font-bold text-success-dark bg-success-light px-1.5 py-0.5 rounded-chip">FINALE</span>}
                </span>
                {canEdit && !v.isFinal && (
                  <button
                    onClick={() => void validate(v.id)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-success-dark hover:underline"
                    title="Valider comme version finale"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Valider
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Sélecteurs + diff */}
          {versions.length >= 1 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <select value={left} onChange={(e) => setLeft(e.target.value)} className="flex-1 bg-white border border-line px-2.5 py-1.5 rounded-lg text-xs text-ink-secondary outline-none focus:border-brand/40 cursor-pointer">
                  {versions.map((v) => <option key={v.id} value={v.id}>v{v.versionNumber}{v.label ? ` · ${v.label}` : ""}</option>)}
                </select>
                <span className="text-ink-subtle text-xs">→</span>
                <select value={right} onChange={(e) => setRight(e.target.value)} className="flex-1 bg-white border border-line px-2.5 py-1.5 rounded-lg text-xs text-ink-secondary outline-none focus:border-brand/40 cursor-pointer">
                  {versions.map((v) => <option key={v.id} value={v.id}>v{v.versionNumber}{v.label ? ` · ${v.label}` : ""}</option>)}
                </select>
                <button onClick={() => void runDiff()} disabled={loading || !leftV || !rightV} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-hover transition-all disabled:opacity-50">
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitCompare className="w-3.5 h-3.5" />}
                  Comparer
                </button>
              </div>

              {error && <p className="text-xs text-danger-dark bg-danger-light border border-danger/20 px-3 py-2 rounded-lg">{error}</p>}

              {diff && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-[11px] font-semibold">
                    <span className="text-success-dark">+{diff.stats.added} ajoutée(s)</span>
                    <span className="text-warning-dark">~{diff.stats.modified} modifiée(s)</span>
                    <span className="text-danger-dark">−{diff.stats.removed} supprimée(s)</span>
                    <span className="text-ink-subtle">={diff.stats.unchanged} inchangée(s)</span>
                  </div>
                  {diff.clauses.filter((c) => c.status !== "unchanged").map((c, i) => {
                    const st = CLAUSE_STATUS[c.status];
                    return (
                      <div key={i} className="rounded-panel border border-line overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-surface-subtle">
                          <span className="text-xs font-semibold text-ink truncate">{c.title}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-chip" style={{ backgroundColor: st.bg, color: st.fg }}>{st.label}</span>
                        </div>
                        {c.lines.length > 0 && (
                          <div className="font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto">
                            {c.lines.map((l, j) => (
                              <div key={j} className={
                                l.type === "added" ? "bg-success-light/60 text-success-dark px-3 py-0.5"
                                : l.type === "removed" ? "bg-danger-light/60 text-danger-dark px-3 py-0.5 line-through decoration-danger/40"
                                : "text-ink-secondary px-3 py-0.5"
                              }>
                                <span className="select-none text-ink-subtle mr-2">{l.type === "added" ? "+" : l.type === "removed" ? "−" : " "}</span>
                                {l.text || " "}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {diff.clauses.every((c) => c.status === "unchanged") && (
                    <p className="text-xs text-ink-muted italic">Aucune différence entre ces deux versions.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
