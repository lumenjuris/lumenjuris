import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Search, AlertCircle, ShieldCheck, Pencil, Trash2, Copy, Check,
  ScrollText, Library,
} from "lucide-react";
import { clauseApi } from "./api";
import type { ClauseFilters } from "./api";
import { ClauseEditor } from "./ClauseEditor";
import { CATEGORY_LABEL, POSITION_LABEL, POSITION_STYLE } from "./types";
import type { Clause, ClauseCategory, ClauseStats } from "./types";
import { useUserStore } from "../../../store/userStore";

/** Bibliothèque de clauses — référentiel réutilisable pour génération & négociation. */
export function ClausesLibrary() {
  const role = useUserStore((s) => s.userData?.profile?.role);
  const canEdit = role === "ADMIN" || role === "JURISTE" || role === "USER";

  const [items, setItems] = useState<Clause[]>([]);
  const [stats, setStats] = useState<ClauseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ClauseFilters>({});
  const [editing, setEditing] = useState<Clause | null | "new">(null);

  const loadData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [list, s] = await Promise.all([clauseApi.list(filters), clauseApi.stats()]);
      setItems(list); setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void loadData(); }, [loadData]);

  // Regroupe les clauses par catégorie pour un affichage structuré.
  const grouped = useMemo(() => {
    const m = new Map<ClauseCategory, Clause[]>();
    for (const c of items) {
      const arr = m.get(c.category) ?? [];
      arr.push(c);
      m.set(c.category, arr);
    }
    return Array.from(m.entries());
  }, [items]);

  async function handleDelete(c: Clause) {
    if (!confirm(`Supprimer définitivement la clause « ${c.title} » ?`)) return;
    setItems((prev) => prev.filter((x) => x.id !== c.id));
    try { await clauseApi.remove(c.id); await loadData(); }
    catch (e) { setError(e instanceof Error ? e.message : "Échec de la suppression"); await loadData(); }
  }

  function patch(p: Partial<ClauseFilters>) { setFilters((f) => ({ ...f, ...p })); }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Bibliothèque de clauses</h1>
          <p className="text-sm text-ink-muted mt-1">
            Référentiel de clauses approuvées, réutilisables pour la génération et la négociation.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setEditing("new")}
            className="flex items-center gap-2 px-5 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-hover transition-all shadow-card shrink-0"
          >
            <Plus className="w-4 h-4" /> Nouvelle clause
          </button>
        )}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard label="Clauses au total" value={stats?.total} icon={Library} accent="#354F99" loading={loading && !stats} />
        <KpiCard label="Approuvées" value={stats?.approved} icon={ShieldCheck} accent="#059669" loading={loading && !stats} />
        <KpiCard
          label="Catégories couvertes"
          value={stats ? Object.keys(stats.byCategory).length : undefined}
          icon={ScrollText}
          accent="#2563eb"
          loading={loading && !stats}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger-dark bg-danger-light border border-danger/20 px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-col md:flex-row gap-2.5">
        <form
          onSubmit={(e) => { e.preventDefault(); patch({ q: search.trim() || undefined }); }}
          className="relative flex-1"
        >
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une clause (intitulé, texte, tag)…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-line rounded-xl text-sm text-ink outline-none focus:border-brand/40 focus:shadow-ring-brand transition-all placeholder:text-ink-placeholder shadow-card"
          />
        </form>
        <select
          value={filters.category ?? ""}
          onChange={(e) => patch({ category: (e.target.value || undefined) as ClauseCategory | undefined })}
          className="bg-white border border-line px-4 py-2.5 rounded-xl text-sm text-ink-secondary outline-none focus:border-brand/40 cursor-pointer shadow-card"
        >
          <option value="">Toutes les catégories</option>
          {(Object.keys(CATEGORY_LABEL) as ClauseCategory[]).map((c) => (
            <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
          ))}
        </select>
        <button
          onClick={() => patch({ onlyApproved: !filters.onlyApproved })}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-card border ${
            filters.onlyApproved
              ? "bg-success-light text-success-dark border-success/30"
              : "bg-white text-ink-secondary border-line hover:bg-surface-subtle"
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Approuvées
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-card bg-surface-muted animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-card border border-line shadow-card">
          <div className="w-14 h-14 rounded-card bg-surface-subtle border border-line flex items-center justify-center">
            <ScrollText className="w-6 h-6 text-ink-subtle stroke-[1.5]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-ink">Aucune clause</p>
            <p className="text-xs text-ink-muted mt-1">
              {canEdit ? "Créez votre première clause pour démarrer votre référentiel." : "Aucune clause disponible."}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setEditing("new")}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-hover transition-all"
            >
              <Plus className="w-4 h-4" /> Nouvelle clause
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([cat, clauses]) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2.5">
                <h2 className="text-xs font-bold text-ink-subtle uppercase tracking-widest">{CATEGORY_LABEL[cat]}</h2>
                <span className="text-[10px] font-semibold text-ink-subtle bg-surface-muted px-1.5 py-0.5 rounded-chip">{clauses.length}</span>
              </div>
              <div className="space-y-2.5">
                {clauses.map((c) => (
                  <ClauseCard
                    key={c.id}
                    clause={c}
                    canEdit={canEdit}
                    onEdit={() => setEditing(c)}
                    onDelete={() => void handleDelete(c)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <ClauseEditor
          clause={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void loadData(); }}
        />
      )}
    </div>
  );
}

/** Carte d'une clause individuelle. */
function ClauseCard({
  clause, canEdit, onEdit, onDelete,
}: {
  clause: Clause;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const pos = POSITION_STYLE[clause.position];

  function copy() {
    void navigator.clipboard.writeText(clause.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-white rounded-card border border-line shadow-card p-4 group hover:border-line-emphasis transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-ink">{clause.title}</span>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-chip tracking-wide"
              style={{ backgroundColor: pos.bg, color: pos.fg }}
            >
              {POSITION_LABEL[clause.position]}
            </span>
            {clause.isApproved && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-success-dark bg-success-light px-1.5 py-0.5 rounded-chip">
                <ShieldCheck className="w-2.5 h-2.5" /> Approuvée
              </span>
            )}
          </div>
          <p className="text-sm text-ink-secondary mt-1.5 leading-relaxed line-clamp-3 whitespace-pre-wrap">{clause.body}</p>
          {clause.notes && (
            <p className="text-xs text-ink-muted mt-2 italic">{clause.notes}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {clause.tags.map((t) => (
              <span key={t} className="text-[9px] font-semibold text-brand bg-brand-light px-1.5 py-0.5 rounded-chip">{t}</span>
            ))}
            {clause.usageCount > 0 && (
              <span className="text-[9px] text-ink-subtle">Utilisée {clause.usageCount}×</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={copy}
            className="p-1.5 rounded-lg text-ink-subtle hover:text-brand hover:bg-brand-light transition-all"
            title="Copier le texte de la clause"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          {canEdit && (
            <>
              <button
                onClick={onEdit}
                className="p-1.5 rounded-lg text-ink-subtle hover:text-brand hover:bg-brand-light transition-all"
                title="Modifier"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onDelete}
                className="p-1.5 rounded-lg text-ink-subtle hover:text-danger hover:bg-danger-light transition-all opacity-0 group-hover:opacity-100"
                title="Supprimer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Petite carte KPI. */
function KpiCard({
  label, value, icon: Icon, accent, loading,
}: {
  label: string;
  value: number | undefined;
  icon: React.ElementType;
  accent: string;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-card border border-line shadow-card p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-panel flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "18" }}>
        <Icon className="w-5 h-5" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        {loading ? (
          <>
            <div className="h-6 w-10 rounded-md bg-surface-muted animate-pulse mb-1.5" />
            <div className="h-3 w-24 rounded bg-surface-muted animate-pulse" />
          </>
        ) : (
          <>
            <p className="text-2xl font-bold tracking-tight text-ink">{value ?? 0}</p>
            <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest leading-tight mt-0.5">{label}</p>
          </>
        )}
      </div>
    </div>
  );
}
