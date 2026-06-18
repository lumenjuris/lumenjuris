import { useState } from "react";
import { Sparkles, Loader2, Copy, Check, AlertCircle } from "lucide-react";
import { contractApi } from "./api";

/** Outil IA : reformulation d'une clause (suggestion de rédaction). */
export function ClauseReformulator() {
  const [clause, setClause] = useState("");
  const [instruction, setInstruction] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function run() {
    if (!clause.trim()) { setError("Collez d'abord le texte de la clause à reformuler."); return; }
    setBusy(true); setError(""); setResult("");
    try {
      const out = await contractApi.reformulateClause(clause.trim(), instruction.trim());
      setResult(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la reformulation.");
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    void navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-white rounded-card border border-line shadow-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-brand" />
        <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Reformulation IA d'une clause</p>
      </div>

      <textarea
        value={clause}
        onChange={(e) => setClause(e.target.value)}
        rows={4}
        placeholder="Collez ici la clause à reformuler…"
        className="w-full text-sm px-3 py-2 border border-line rounded-lg outline-none focus:border-brand/40 transition-all resize-y placeholder:text-ink-placeholder mb-2"
      />
      <input
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="Consigne (optionnel) : ex. « plus favorable au prestataire », « limiter la responsabilité »…"
        className="w-full text-sm px-3 py-2 border border-line rounded-lg outline-none focus:border-brand/40 transition-all placeholder:text-ink-placeholder mb-2.5"
      />

      <button
        onClick={() => void run()}
        disabled={busy}
        className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-lg hover:bg-brand-hover transition-all disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {busy ? "Reformulation…" : "Proposer une reformulation"}
      </button>

      {error && (
        <div className="flex items-center gap-2 text-xs text-danger-dark bg-danger-light border border-danger/20 px-3 py-2 rounded-lg mt-3">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      {result && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Proposition</p>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:text-brand-hover transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
          <div className="text-sm text-ink-secondary bg-brand-light/40 border border-brand-muted/40 rounded-panel p-3 whitespace-pre-wrap leading-relaxed">
            {result}
          </div>
          <p className="text-[10px] text-ink-subtle mt-1.5 italic">
            Suggestion générée par IA — à relire et valider par un juriste avant usage.
          </p>
        </div>
      )}
    </div>
  );
}
