// Vue invité du mode « complétion guidée » : le document s'affiche en lecture
// seule, seuls les champs assignés à l'invité sont éditables (surlignés).
// Progression, enregistrement, puis « J'ai terminé » → contrôle des champs
// requis et bascule vers la signature.
import { useMemo, useState } from "react";
import {
  Check, Loader2, Save, CheckCircle2, AlertCircle, ChevronRight,
} from "lucide-react";
import { guestApi } from "./api";
import type { GuestNegotiation, NegoField } from "./types";

interface Props {
  token: string;
  data: GuestNegotiation;
  onChanged: () => Promise<void> | void;
}

type Segment = { kind: "text"; text: string } | { kind: "field"; field: NegoField };

/** Découpe le texte sur les marqueurs {{variableId}} et les résout en champs. */
function segments(text: string, fields: NegoField[]): Segment[] {
  const byVar = new Map(fields.map((f) => [f.variableId, f]));
  const out: Segment[] = [];
  const re = /\{\{([a-zA-Z0-9_.-]+)\}\}/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    const field = byVar.get(m[1]!);
    if (field) out.push({ kind: "field", field });
    else out.push({ kind: "text", text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

const INPUT_TYPE: Record<string, string> = { date: "date", email: "email", number: "text", iban: "text", text: "text" };

export function CompletionGuestForm({ token, data, onChanged }: Props) {
  const side = data.guest.fillSide;
  const latest = data.versions[data.versions.length - 1];
  const mine = useMemo(
    () => data.fields.filter((f) => f.side === side).sort((a, b) => a.position - b.position),
    [data.fields, side],
  );
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(mine.map((f) => [f.id, f.value ?? ""])),
  );
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [finished, setFinished] = useState<{ autoToSignature: boolean } | null>(null);

  const filled = mine.filter((f) => (values[f.id] ?? "").trim()).length;
  const dirty = mine.some((f) => (values[f.id] ?? "") !== (f.value ?? ""));

  const segs = useMemo(
    () => segments(latest?.contentText ?? "", data.fields),
    [latest?.contentText, data.fields],
  );

  async function save(): Promise<boolean> {
    setSaving(true); setError("");
    try {
      const r = await guestApi.saveFields(token, values);
      if (r.invalid.length > 0) {
        setMissing(r.invalid);
        setError("Certaines valeurs semblent invalides (format attendu : date, e-mail…).");
        return false;
      }
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
      await onChanged();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
      return false;
    } finally { setSaving(false); }
  }

  async function finish() {
    setFinishing(true); setError(""); setMissing([]);
    try {
      if (dirty && !(await save())) return;
      const r = await guestApi.complete(token);
      if (!r.done) {
        setMissing((r.missing ?? []).map((m) => m.id));
        setError("Complétez les champs requis signalés avant de valider.");
        return;
      }
      setFinished({ autoToSignature: Boolean(r.autoToSignature) });
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation impossible.");
    } finally { setFinishing(false); }
  }

  if (finished) {
    return (
      <div className="bg-white rounded-card border border-line shadow-card px-6 py-14 flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="w-10 h-10 text-success" />
        <p className="text-base font-bold text-ink">Merci, vos informations sont enregistrées.</p>
        <p className="text-sm text-ink-muted max-w-md">
          {finished.autoToSignature
            ? "Le document est prêt : vous recevrez très prochainement le lien de signature électronique par e-mail."
            : `${"Votre interlocuteur va vérifier les informations saisies, puis vous recevrez le lien de signature électronique."}`}
        </p>
      </div>
    );
  }

  const fieldInput = (f: NegoField, inline: boolean) => {
    const invalid = missing.includes(f.id);
    const v = values[f.id] ?? "";
    return (
      <input
        key={inline ? `doc-${f.id}` : `list-${f.id}`}
        type={INPUT_TYPE[f.type] ?? "text"}
        value={v}
        onChange={(e) => setValues((m) => ({ ...m, [f.id]: e.target.value }))}
        placeholder={f.label}
        title={f.label}
        data-field={f.id}
        size={inline ? Math.max(8, (v || f.label).length) : undefined}
        className={`${inline ? "mx-0.5 inline max-w-full rounded-chip px-1.5 py-[1px] text-[13px]" : "w-full rounded-lg px-3 py-2 text-sm"} font-medium outline-none transition border ${
          invalid
            ? "bg-danger-light text-danger-dark border-danger/40"
            : v.trim()
              ? "bg-brand-light text-brand border-brand/20 focus:ring-2 focus:ring-brand/25"
              : "bg-amber-50 text-amber-900 border-amber-300/80 focus:ring-2 focus:ring-amber-300/60"
        }`}
      />
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_18rem] gap-5 items-start">
      {/* Document : lecture seule + champs de l'invité éditables en ligne */}
      <div className="relative bg-white rounded-card border border-line shadow-card overflow-hidden">
        {/* Filigrane avant signature */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          <span className="rotate-[-28deg] text-5xl font-black tracking-widest text-ink/[0.05] select-none whitespace-nowrap">
            PROJET — AVANT SIGNATURE
          </span>
        </div>
        <div className="relative z-10 px-4 py-5 sm:px-8 sm:py-7 text-[13.5px] break-words leading-relaxed text-ink-secondary whitespace-pre-wrap">
          {segs.map((s, i) =>
            s.kind === "text" ? (
              <span key={i}>{s.text}</span>
            ) : s.field.side === side ? (
              fieldInput(s.field, true)
            ) : (
              <span
                key={i}
                title={`À compléter par ${s.field.side === "OWNER" ? "votre interlocuteur" : "une autre partie"}`}
                className="mx-0.5 inline rounded-chip bg-surface-muted px-1.5 py-[1px] text-[12px] text-ink-subtle italic"
              >
                {(s.field.value ?? "").trim() || s.field.label}
              </span>
            ),
          )}
        </div>
      </div>

      {/* Panneau latéral : progression + actions */}
      <aside className="space-y-3 lg:sticky lg:top-4">
        <div className="bg-white rounded-card border border-line shadow-card p-4 space-y-3">
          <p className="text-[10px] font-bold text-ink-subtle uppercase tracking-widest">Vos informations</p>
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-ink-secondary mb-1.5">
              <span>{filled}/{mine.length} champs remplis</span>
              {filled === mine.length && <Check className="w-3.5 h-3.5 text-success" />}
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-muted overflow-hidden">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${mine.length ? Math.round((filled / mine.length) * 100) : 0}%` }} />
            </div>
          </div>
          <ul className="space-y-1 max-h-52 overflow-y-auto">
            {mine.map((f) => {
              const done = (values[f.id] ?? "").trim().length > 0;
              return (
                <li key={f.id}>
                  <button
                    onClick={() => {
                      const el = document.querySelector<HTMLInputElement>(`input[data-field="${f.id}"]`);
                      el?.scrollIntoView({ behavior: "smooth", block: "center" });
                      el?.focus({ preventScroll: true });
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${done ? "text-ink" : "text-ink-secondary hover:bg-surface-subtle"} ${missing.includes(f.id) ? "bg-danger-light" : done ? "bg-brand-light/60" : ""}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{f.label}{f.required ? "" : " (facultatif)"}</span>
                    {done ? <Check className="w-3.5 h-3.5 shrink-0 text-brand" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-ink-subtle" />}
                  </button>
                </li>
              );
            })}
          </ul>

          {error && (
            <p className="flex items-start gap-1.5 text-xs text-danger"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}</p>
          )}

          <div className="space-y-2 pt-1">
            <button onClick={() => void save()} disabled={saving || !dirty} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-ink-secondary bg-white border border-line rounded-lg hover:bg-surface-subtle transition disabled:opacity-40">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : savedFlash ? <Check className="w-3.5 h-3.5 text-success" /> : <Save className="w-3.5 h-3.5" />}
              {savedFlash ? "Enregistré" : "Enregistrer (finir plus tard)"}
            </button>
            <button onClick={() => void finish()} disabled={finishing} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-white bg-brand rounded-lg hover:bg-brand-hover transition disabled:opacity-50">
              {finishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              J’ai terminé — valider mes informations
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
