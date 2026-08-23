import { useEffect, useState, useMemo, useCallback } from "react";
import type { ReactNode } from "react";
import {
  Search,
  SlidersHorizontal,
  MessageSquare,
  Calendar,
  User,
  Trash2,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Building2,
  CreditCard,
  FileText,
  Shield,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { fetchProxy } from "../../utils/fetchProxy";

type FeedbackEntry = {
  id: string;
  date: string;
  comment: string;
  context: string;
  page: string;
  userId?: string;
};

type UserDetails = {
  idUser: number;
  email: string;
  nom: string | null;
  prenom: string | null;
  role: string;
  isVerified: boolean;
  twoFactorEnabled: boolean;
  subscription: {
    status: string;
    startAt: string;
    expiresAt: string;
    plan: { name: string; price: number; interval: string; creditIncluded: number };
    totalPaid: number;
    invoiceCount: number;
  } | null;
  enterprise: {
    name: string | null;
    siren: string | null;
    statusJuridique: string | null;
    address: { address: string | null; codePostal: string | null; pays: string | null } | null;
  } | null;
  userCredit: { creditIncluded: number; creditAdded: number } | null;
  _count: { contracts: number; signatureEnvelopes: number; contractHistory: number };
};

type SortOrder = "newest" | "oldest";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    ADMIN: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    JURISTE: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    USER: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    LECTEUR: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  };
  const labels: Record<string, string> = {
    ADMIN: "Admin",
    JURISTE: "Juriste",
    USER: "Utilisateur",
    LECTEUR: "Lecteur",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles[role] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[role] ?? role}
    </span>
  );
}

function SubStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    INACTIVE: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    EXPIRED: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    TRIAL: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  };
  const labels: Record<string, string> = {
    ACTIVE: "Actif",
    INACTIVE: "Inactif",
    CANCELLED: "Annulé",
    EXPIRED: "Expiré",
    TRIAL: "Essai",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function paginationItems(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const nums = new Set(
    [1, total, current, current - 1, current + 1].filter((n) => n >= 1 && n <= total),
  );
  const sorted = [...nums].sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) result.push("…");
    result.push(n);
    prev = n;
  }
  return result;
}

// ─── Main component ────────────────────────────────────────────────────────────

export function Logger() {
  const [feedbacks, setFeedbacks] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filterPage, setFilterPage] = useState("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [panelUserId, setPanelUserId] = useState<string | null>(null);
  const [panelData, setPanelData] = useState<UserDetails | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  interface MonitoringResponse {
    success: boolean;
    data: {
      front: FeedbackEntry[],
      proxy: FeedbackEntry[],
      back: FeedbackEntry[],
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchProxy("/api/logger/monitoring", { credentials: "include" });
      const data = (await res.json()) as MonitoringResponse;

      if (data.success && data.data) {
        const allLogs = [
          ...(data.data.front || []),
          ...(data.data.proxy || []),
          ...(data.data.back || []),
        ]
        setFeedbacks(allLogs);
      } else {
        setFeedbacks([]);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Reset page + selection on filter changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
    setConfirmingDelete(false);
  }, [search, filterPage, sortOrder, pageSize]);

  const pages = useMemo(() => {
    const seen = new Set<string>();
    feedbacks.forEach((f) => seen.add(f.page));
    return Array.from(seen).sort();
  }, [feedbacks]);

  const filtered = useMemo(() => {
    let list = [...feedbacks];
    if (filterPage !== "all") list = list.filter((f) => f.page === filterPage);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.comment.toLowerCase().includes(q) ||
          f.context.toLowerCase().includes(q) ||
          f.page.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return sortOrder === "newest" ? diff : -diff;
    });
    return list;
  }, [feedbacks, filterPage, search, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allPageSelected = paginated.length > 0 && paginated.every((f) => selectedIds.has(f.id));

  function toggleOne(id: string) {
    setConfirmingDelete(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setConfirmingDelete(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        paginated.forEach((f) => next.delete(f.id));
      } else {
        paginated.forEach((f) => next.add(f.id));
      }
      return next;
    });
  }

  async function executeDelete() {
    const ids = [...selectedIds];
    setDeleting(true);
    try {
      const res = await fetchProxy(`/api/logger/bulk?ids=${encodeURIComponent(ids.join(","))}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ids}),
      });
      const json = await res.json() as { success: boolean; message?: string };
      if (!json.success) throw new Error(json.message ?? "Erreur inconnue");
      setFeedbacks((prev) => prev.filter((f) => !selectedIds.has(f.id)));
      setSelectedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  async function openPanel(userId: string) {
    if (panelUserId === userId) {
      setPanelUserId(null);
      setPanelData(null);
      return;
    }
    setPanelUserId(userId);
    setPanelData(null);
    setPanelError(null);
    setPanelLoading(true);
    try {
      const res = await fetchProxy(`/api/admin/users/${userId}/details`, { credentials: "include" });
      const json = await res.json() as { success: boolean; data?: UserDetails; message?: string };
      if (!json.success) throw new Error(json.message ?? "Erreur inconnue");
      setPanelData(json.data ?? null);
    } catch (e) {
      setPanelError(e instanceof Error ? e.message : String(e));
    } finally {
      setPanelLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher dans les commentaires…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
          />
        </div>

        <div className="flex items-center gap-2 w-full max-w-full min-w-0">
          <SlidersHorizontal className="w-4 h-4 text-gray-400 shrink-0" />
          <select
            value={filterPage}
            onChange={(e) => setFilterPage(e.target.value)}
            className="w-full sm:w-auto min-w-0 truncate text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-indigo-300 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            <option value="all">Toutes les pages</option>
            {pages.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 outline-none focus:border-indigo-300 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          <option value="newest">Plus récents</option>
          <option value="oldest">Plus anciens</option>
        </select>

        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>Afficher</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}
            className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-2 outline-none focus:border-indigo-300 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span>/ page</span>
        </div>
      </div>

      {/* ── Selection action bar ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700">
          {!confirmingDelete ? (
            <>
              <span className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
              </span>
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
              <button
                onClick={() => { setSelectedIds(new Set()); }}
                className="ml-auto text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 transition-colors"
                title="Désélectionner tout"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Supprimer {selectedIds.size} feedback{selectedIds.size > 1 ? "s" : ""} définitivement ?
              </span>
              <button
                onClick={() => void executeDelete()}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {deleting ? "Suppression…" : "Confirmer"}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors"
              >
                Annuler
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Summary + select-all ── */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500 dark:text-gray-400">
          {filtered.length} feedback{filtered.length !== 1 ? "s" : ""}
          {filterPage !== "all" || search.trim() ? " (filtré)" : ""}
        </span>
        {paginated.length > 0 && (
          <button
            onClick={toggleAll}
            className="text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {allPageSelected ? "Désélectionner la page" : "Sélectionner la page"}
          </button>
        )}
      </div>

      {/* ── States + card list ── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 animate-pulse"
            >
              <div className="h-3 w-32 bg-gray-100 dark:bg-gray-700 rounded mb-3" />
              <div className="h-4 w-full bg-gray-100 dark:bg-gray-700 rounded mb-2" />
              <div className="h-4 w-3/4 bg-gray-100 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-sm text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl px-4 py-3">
          Erreur : {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
          <MessageSquare className="w-8 h-8" />
          <p className="text-sm">Aucun feedback trouvé pour ces critères.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginated.map((f) => (
            <div
              key={f.id}
              className={`flex gap-3 border rounded-xl p-4 transition-all ${
                selectedIds.has(f.id)
                  ? "border-indigo-300 dark:border-indigo-600 bg-indigo-50/60 dark:bg-indigo-900/20"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-200 hover:shadow-sm"
              }`}
            >
              {/* Checkbox */}
              <div className="pt-1 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={selectedIds.has(f.id)}
                  onChange={() => toggleOne(f.id)}
                  className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                />
              </div>

              {/* Card body */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDateTime(f.date)}
                  </div>
                </div>

                {/* Bloc de détails structuré */}
                <div className="bg-gray-50 dark:bg-gray-900/60 rounded-lg p-3.5 border border-gray-100 dark:border-gray-700 space-y-2 mb-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-b border-gray-200/60 dark:border-gray-800 pb-2">
                    <div>
                      <span className="font-semibold text-gray-500 dark:text-gray-400">Context : </span>
                      <span className="text-gray-800 dark:text-gray-200 font-medium">{f.context}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-500 dark:text-gray-400">Page : </span>
                      <span className="text-gray-800 dark:text-gray-200 font-medium">{f.page}</span>
                    </div>
                  </div>

                  <div>
                    <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                      Comment / Erreur :
                    </span>
                    <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed whitespace-pre-wrap font-mono bg-white dark:bg-gray-800 p-2.5 rounded border border-gray-200 dark:border-gray-700 break-all sm:break-words overflow-x-auto max-w-full">
                      {f.comment}
                    </p>
                  </div>
                </div>

                {/* Profil Utilisateur */}
                <div className="flex items-center pt-2 border-t border-gray-100 dark:border-gray-700">
                  {f.userId ? (
                    <button
                      onClick={() => void openPanel(f.userId!)}
                      className={`flex items-center gap-1.5 text-xs transition-colors ${
                        panelUserId === f.userId
                          ? "text-indigo-700 dark:text-indigo-300 font-medium"
                          : "text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>User #{f.userId}</span>
                      {panelUserId === f.userId ? (
                        <span className="text-indigo-500 dark:text-indigo-400">· Profil ouvert ↗</span>
                      ) : (
                        <span className="underline decoration-dotted">· Voir le profil</span>
                      )}
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                      <User className="w-3.5 h-3.5" />
                      Anonyme
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {paginationItems(safePage, totalPages).map((item, idx) =>
            item === "…" ? (
              <span key={`e${idx}`} className="px-2 text-gray-400">…</span>
            ) : (
              <button
                key={item}
                onClick={() => setCurrentPage(item)}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                  item === safePage
                    ? "bg-indigo-600 text-white"
                    : "border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                }`}
              >
                {item}
              </button>
            ),
          )}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── User detail slide-over ── */}
      {panelUserId && (
        <>
          <div
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40"
            onClick={() => { setPanelUserId(null); setPanelData(null); }}
          />
          <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Profil utilisateur</h3>
              <button
                onClick={() => { setPanelUserId(null); setPanelData(null); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {panelLoading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                </div>
              ) : panelError ? (
                <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl p-4">
                  {panelError}
                </div>
              ) : panelData ? (
                <UserDetailsPanel data={panelData} />
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── User detail panel ─────────────────────────────────────────────────────────

function UserDetailsPanel({ data }: { data: UserDetails }) {
  const fullName = [data.prenom, data.nom].filter(Boolean).join(" ") || "—";
  const initials =
    [data.prenom?.[0], data.nom?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  return (
    <div className="space-y-4">
      {/* Identity */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-xl font-bold text-indigo-600 dark:text-indigo-300 flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{fullName}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{data.email}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <RoleBadge role={data.role} />
            {data.isVerified ? (
              <span className="flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3" /> Vérifié
              </span>
            ) : (
              <span className="text-xs text-amber-500">Non vérifié</span>
            )}
            {data.twoFactorEnabled && (
              <span className="flex items-center gap-0.5 text-xs text-indigo-600 dark:text-indigo-400">
                <Shield className="w-3 h-3" /> 2FA actif
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Abonnement */}
      <PanelSection icon={<CreditCard className="w-4 h-4" />} title="Abonnement">
        {data.subscription ? (
          <div className="space-y-2 text-sm">
            <Row label="Plan" value={<span className="font-medium text-gray-900 dark:text-gray-100">{data.subscription.plan.name}</span>} />
            <Row label="Statut" value={<SubStatusBadge status={data.subscription.status} />} />
            <Row
              label="Prix"
              value={`${(data.subscription.plan.price / 100).toFixed(2)} € / ${data.subscription.plan.interval === "month" ? "mois" : data.subscription.plan.interval}`}
            />
            <Row
              label="Début"
              value={new Date(data.subscription.startAt).toLocaleDateString("fr-FR")}
            />
            <Row
              label="Expiration"
              value={new Date(data.subscription.expiresAt).toLocaleDateString("fr-FR")}
            />
            <Row
              label="Total payé"
              value={
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {(data.subscription.totalPaid / 100).toFixed(2)} €{" "}
                  <span className="font-normal text-gray-500">({data.subscription.invoiceCount} facture{data.subscription.invoiceCount > 1 ? "s" : ""})</span>
                </span>
              }
            />
            <Row
              label="Crédits inclus"
              value={`${data.subscription.plan.creditIncluded}`}
            />
            {data.userCredit && (
              <Row
                label="Crédits dispo."
                value={`${data.userCredit.creditIncluded + data.userCredit.creditAdded} (+ ${data.userCredit.creditAdded} ajouté${data.userCredit.creditAdded > 1 ? "s" : ""})`}
              />
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">Aucun abonnement actif</p>
        )}
      </PanelSection>

      {/* Entreprise */}
      {data.enterprise && (data.enterprise.name || data.enterprise.siren) && (
        <PanelSection icon={<Building2 className="w-4 h-4" />} title="Entreprise">
          <div className="space-y-2 text-sm">
            {data.enterprise.name && (
              <Row label="Nom" value={<span className="font-medium text-gray-900 dark:text-gray-100 break-words">{data.enterprise.name}</span>} />
            )}
            {data.enterprise.siren && (
              <Row label="SIREN" value={<span className="font-mono text-xs">{data.enterprise.siren}</span>} />
            )}
            {data.enterprise.statusJuridique && (
              <Row label="Forme juridique" value={data.enterprise.statusJuridique} />
            )}
            {data.enterprise.address && (
              <Row
                label="Adresse"
                value={
                  [
                    data.enterprise.address.address,
                    data.enterprise.address.codePostal,
                    data.enterprise.address.pays,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
            )}
          </div>
        </PanelSection>
      )}

      {/* Statistiques */}
      <PanelSection icon={<FileText className="w-4 h-4" />} title="Statistiques">
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Contrats" value={data._count.contracts} />
          <StatTile label="Signatures" value={data._count.signatureEnvelopes} />
          <StatTile label="Analyses" value={data._count.contractHistory} />
        </div>
      </PanelSection>
    </div>
  );
}

function PanelSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
        <span className="text-gray-500 dark:text-gray-400">{icon}</span>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h4>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">{label}</span>
      <span className="text-gray-700 dark:text-gray-300 text-right">{value}</span>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 gap-0.5">
      <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400 text-center leading-tight">{label}</span>
    </div>
  );
}
