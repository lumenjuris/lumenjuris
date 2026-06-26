import { useCallback, useEffect, useState } from "react";
import { Plus, Download, Search, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { KpiBar } from "./KpiBar";
import { ContractTable } from "./ContractTable";
import { contractApi } from "./api";
import { STATUS_LABEL } from "./types";
import { ViewTabs } from "./ViewTabs";
import type { ContrathequeTab } from "./ViewTabs";
import type { ContractStats, ContractListItem, ListFilters, ContractStatus } from "./types";

interface Props {
  onOpen: (id: string) => void;
  onImport: () => void;
  tab: ContrathequeTab;
  onTab: (t: ContrathequeTab) => void;
  canDelete?: boolean;
  refreshKey?: number;
}

const PAGE_SIZE = 25;

/** Écran 1 — vue contrathèque (KPI + filtres + dossiers/tags + tableau). */
export function ContrathequeList({ onOpen, onImport, tab, onTab, canDelete, refreshKey }: Props) {
  const [stats, setStats] = useState<ContractStats | null>(null);
  const [items, setItems] = useState<ContractListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState<ListFilters>({ sortBy: "endDate", sortDir: "asc", page: 1, pageSize: PAGE_SIZE });
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [s, list] = await Promise.all([contractApi.stats(), contractApi.list(filters)]);
      setStats(s); setItems(list.items); setTotal(list.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void loadData(); }, [loadData, refreshKey]);

  function patch(p: Partial<ListFilters>) { setFilters((f) => ({ ...f, ...p, page: p.page ?? 1 })); }

  function toggleSort(key: NonNullable<ListFilters["sortBy"]>) {
    setFilters((f) => ({
      ...f,
      sortBy: key,
      sortDir: f.sortBy === key && f.sortDir === "asc" ? "desc" : "asc",
      page: 1,
    }));
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Supprimer définitivement le contrat « ${title} » ?`)) return;
    // Optimiste : on retire la ligne immédiatement, puis on resynchronise.
    setItems((prev) => prev.filter((c) => c.id !== id));
    try {
      await contractApi.remove(id);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de la suppression");
      await loadData();
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Contrathèque</h1>
          <p className="text-sm text-ink-muted mt-1">Centralisez et suivez le cycle de vie de vos contrats.</p>
          <div className="mt-3"><ViewTabs tab={tab} onTab={onTab} /></div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => contractApi.exportCsv(filters)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-ink-secondary bg-white border border-line rounded-xl hover:bg-surface-subtle transition-colors shadow-card"
          >
            <Download className="w-4 h-4" /> Exporter
          </button>
          <button
            onClick={onImport}
            className="flex items-center gap-2 px-5 py-2 bg-brand text-white text-sm font-semibold rounded-xl hover:bg-brand-hover transition-all shadow-card"
          >
            <Plus className="w-4 h-4" /> Importer un contrat
          </button>
        </div>
      </div>

      <KpiBar stats={stats} loading={loading && !stats} />

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger-dark bg-danger-light border border-danger/20 px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="space-y-4">
          {/* Barre recherche + filtres */}
          <div className="flex flex-col md:flex-row gap-2.5">
            <form
              onSubmit={(e) => { e.preventDefault(); patch({ q: search.trim() || undefined }); }}
              className="relative flex-1"
            >
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un contrat…"
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-line rounded-xl text-sm text-ink outline-none focus:border-brand/40 focus:shadow-ring-brand transition-all placeholder:text-ink-placeholder shadow-card"
              />
            </form>
            <select
              value={filters.status ?? ""}
              onChange={(e) => patch({ status: (e.target.value || undefined) as ContractStatus | undefined })}
              className="bg-white border border-line px-4 py-2.5 rounded-xl text-sm text-ink-secondary outline-none focus:border-brand/40 cursor-pointer shadow-card"
            >
              <option value="">Tous les statuts</option>
              {(Object.keys(STATUS_LABEL) as ContractStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
            <select
              value={filters.isB2C === true ? "b2c" : filters.isB2C === false ? "b2b" : ""}
              onChange={(e) => patch({ isB2C: e.target.value === "b2c" ? true : e.target.value === "b2b" ? false : null })}
              className="bg-white border border-line px-4 py-2.5 rounded-xl text-sm text-ink-secondary outline-none focus:border-brand/40 cursor-pointer shadow-card"
            >
              <option value="">B2B & B2C</option>
              <option value="b2b">B2B</option>
              <option value="b2c">B2C (Chatel)</option>
            </select>
          </div>

          <ContractTable
            items={items}
            loading={loading}
            sortBy={filters.sortBy}
            sortDir={filters.sortDir}
            onSort={toggleSort}
            onOpen={onOpen}
            canDelete={canDelete}
            onDelete={handleDelete}
          />

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span className="font-medium">{total} contrat{total > 1 ? "s" : ""}</span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={(filters.page ?? 1) <= 1}
                  onClick={() => patch({ page: (filters.page ?? 1) - 1 })}
                  className="p-1.5 rounded-lg border border-line shadow-card disabled:opacity-30 hover:bg-surface-subtle transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-medium">
                  Page {filters.page ?? 1} / {pageCount}
                </span>
                <button
                  disabled={(filters.page ?? 1) >= pageCount}
                  onClick={() => patch({ page: (filters.page ?? 1) + 1 })}
                  className="p-1.5 rounded-lg border border-line shadow-card disabled:opacity-30 hover:bg-surface-subtle transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
