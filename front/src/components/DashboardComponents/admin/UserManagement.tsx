import { useCallback, useEffect, useState, useMemo } from "react";
import { Users, AlertCircle, ShieldCheck, Loader2, Check, Search, Ban, ShieldOff } from "lucide-react";
import { fetchProxy } from "../../../utils/fetchProxy";
import { useUserStore } from "../../../store/userStore";
import { PlanName } from "../../../utils/planMapping";
import { UserActivityPanel } from "../../MonitoringComponents/ActivitySection";

type Role = "ADMIN" | "JURISTE" | "USER" | "LECTEUR";

interface AdminUser {
  idUser: number;
  email: string;
  nom: string | null;
  prenom: string | null;
  role: Role;
  plan: PlanName;
  isVerified: boolean;
  isBanned: boolean;
}

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrateur",
  JURISTE: "Juriste",
  USER: "Utilisateur",
  LECTEUR: "Lecteur (lecture seule)",
};

const USER_PLAN: Record<PlanName, string> = {
  Freemium: "Freemium",
  Betatesteur: "Betatesteur",
  Starter_mensuel: "Starter mensuel",
  Starter_annuel: "Starter annuel",
  Pro_mensuel: "Pro mensuel",
  Pro_annuel: "Pro annuel",
}

const ROLE_STYLE: Record<Role, { bg: string; fg: string }> = {
  ADMIN:    { bg: "#ede9fe", fg: "#5b21b6" },
  JURISTE:  { bg: "#dbeafe", fg: "#1e40af" },
  USER:     { bg: "#d1fae5", fg: "#065f46" },
  LECTEUR:  { bg: "#f1f5f9", fg: "#64748b" },
};

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as { success?: boolean; data?: T; message?: string };
  if (!res.ok || data.success === false) throw new Error(data.message || `Erreur ${res.status}`);
  return data.data as T;
}

/** Gestion des utilisateurs et des rôles (réservé aux administrateurs). */
export function UserManagement() {
  const role = useUserStore((s) => s.userData?.profile?.role);
  const myId = useUserStore((s) => s.userData?.profile?.id);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [savingPlanId, setSavingPlanId] = useState<number | null>(null);
  const [savedPlanId, setSavedPlanId] = useState<number | null>(null);
  const [banningId, setBanningId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const list = await fetchProxy("/api/admin/users", { credentials: "include" }).then(json<AdminUser[]>);
      setUsers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.nom ?? "").toLowerCase().includes(q) ||
        (u.prenom ?? "").toLowerCase().includes(q),
    );
  }, [users, search]);

  async function changeRole(u: AdminUser, newRole: Role) {
    if (newRole === u.role) return;
    setSavingId(u.idUser); setError("");
    setUsers((prev) => prev.map((x) => (x.idUser === u.idUser ? { ...x, role: newRole } : x)));
    try {
      await fetchProxy(`/api/admin/users/${u.idUser}/role`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      }).then(json<unknown>);
      setSavedId(u.idUser);
      setTimeout(() => setSavedId(null), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec du changement de rôle");
      await load();
    } finally {
      setSavingId(null);
    }
  }

  async function changePlan(u: AdminUser, newPlan: PlanName) {
    if (newPlan === u.plan) return;
    setSavingPlanId(u.idUser);
    setError("");
    setUsers((prev) => prev.map((x) => (x.idUser === u.idUser ? {...x, plan: newPlan } : x)));
    try {
      await fetchProxy(`/api/admin/users/${u.idUser}/plan`, {
        method: "PATCH", credentials: "include",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({plan: newPlan}),
      }).then(json<unknown>);
      setSavedPlanId(u.idUser);
      setTimeout(() => setSavedPlanId(null), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Echec du changement de plan");
      await load();
    } finally {
      setSavingPlanId(null);
    }
  }

  async function toggleBan(u: AdminUser) {
    const newBanned = !u.isBanned;
    setBanningId(u.idUser); setError("");
    setUsers((prev) => prev.map((x) => (x.idUser === u.idUser ? { ...x, isBanned: newBanned } : x)));
    try {
      await fetchProxy(`/api/admin/users/${u.idUser}/ban`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned: newBanned }),
      }).then(json<unknown>);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec du bannissement");
      await load();
    } finally {
      setBanningId(null);
    }
  }

  if (role !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <ShieldCheck className="w-10 h-10 text-ink-subtle" />
        <p className="text-sm font-semibold text-ink">Accès réservé aux administrateurs</p>
        <p className="text-xs text-ink-muted">Vous n'avez pas les droits pour gérer les utilisateurs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink tracking-tight">Gestion des utilisateurs</h1>
        <p className="text-sm text-ink-muted mt-1">Attribuez les rôles, droits d'accès et gérez les suspensions.</p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher par nom ou email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-line rounded-lg outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 bg-white"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger-dark bg-danger-light border border-danger/20 px-4 py-3 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Tableau */}
      <div className="bg-white rounded-card border border-line shadow-card overflow-hidden">
        {loading ? (
          <div className="divide-y divide-line-subtle">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
                <div className="w-9 h-9 rounded-lg bg-surface-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-40 rounded bg-surface-muted" />
                  <div className="h-3 w-56 rounded bg-surface-muted" />
                </div>
                <div className="h-8 w-44 rounded-lg bg-surface-muted" />
                <div className="h-8 w-28 rounded-lg bg-surface-muted" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-ink-muted gap-2">
            <Users className="w-7 h-7" />
            <p className="text-sm">Aucun utilisateur trouvé.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-surface-subtle border-b border-line text-ink-subtle text-[10px] uppercase tracking-widest font-semibold">
              <tr>
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3">Rôle actuel</th>
                <th className="px-4 py-3">Modifier le rôle</th>
                <th className="px-4 py-3">Modifier le plan</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {filtered.map((u) => {
                const initials =
                  `${u.prenom?.[0] ?? ""}${u.nom?.[0] ?? ""}`.toUpperCase() ||
                  u.email[0]?.toUpperCase() ||
                  "?";
                const name =
                  [u.prenom, u.nom].filter(Boolean).join(" ") || u.email.split("@")[0];
                const isSelf = u.idUser === Number(myId);
                const isSaving = savingId === u.idUser;
                const isSavingPlan = savingPlanId === u.idUser;
                const isBanning = banningId === u.idUser;

                return (
                  <tr
                    key={u.idUser}
                    onClick={() => setSelectedUserId(u.idUser)}
                    className={`transition-colors ${
                      u.isBanned
                        ? "bg-red-50/40 hover:bg-red-50/70"
                        : "hover:bg-surface-subtle/50"
                    }`}
                  >
                    {/* Identité */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            u.isBanned
                              ? "bg-red-100 text-red-500"
                              : "bg-brand-light text-brand"
                          }`}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">
                            {name}
                            {isSelf && (
                              <span className="text-[10px] text-ink-subtle font-normal ml-1.5">(vous)</span>
                            )}
                            {u.isBanned && (
                              <span className="text-[10px] text-red-500 font-semibold ml-1.5">· SUSPENDU</span>
                            )}
                          </p>
                          <p className="text-xs text-ink-muted truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Rôle badge */}
                    <td className="px-4 py-3">
                      <span
                        className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-chip tracking-wide"
                        style={{ backgroundColor: ROLE_STYLE[u.role].bg, color: ROLE_STYLE[u.role].fg }}
                      >
                        {ROLE_LABEL[u.role]}
                      </span>
                    </td>

                    {/* Modifier le rôle */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <select
                          value={u.role}
                          disabled={isSaving || isSelf || u.isBanned}
                          onChange={(e) => void changeRole(u, e.target.value as Role)}
                          className="bg-white border border-line px-3 py-1.5 rounded-lg text-sm text-ink-secondary outline-none focus:border-brand/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            isSelf
                              ? "Vous ne pouvez pas modifier votre propre rôle"
                              : u.isBanned
                              ? "Débannissez l'utilisateur pour modifier son rôle"
                              : undefined
                          }
                        >
                          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                          ))}
                        </select>
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin text-ink-subtle" />}
                        {savedId === u.idUser && <Check className="w-4 h-4 text-success" />}
                      </div>
                    </td>

                    {/* Modifier le plan */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <select
                          value={u.plan}
                          disabled={isSavingPlan || isSelf || u.isBanned}
                          onChange={(e) => void changePlan(u, e.target.value as PlanName)}
                          className="bg-white border border-line px-3 py-1.5 rounded-lg text-sm text-ink-secondary outline-none focus:border-brand/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            isSelf
                              ? "Vous ne pouvez pas modifier votre propre plan"
                              : u.isBanned
                              ? "Débannissez l'utilisateur pour modifier son rôle"
                              : undefined
                          }
                        >
                          {(Object.keys(USER_PLAN) as PlanName[]).map((p) => (
                            <option key={p} value={p}>{USER_PLAN[p]}</option>
                          ))}
                        </select>
                        {isSavingPlan && <Loader2 className="w-4 h-4 animate-spin text-ink-subtle" />}
                        {savedPlanId === u.idUser && <Check className="w-4 h-4 text-success" />}
                      </div>
                    </td>

                    {/* Ban / Unban */}
                    <td className="px-4 py-3">
                      {isSelf ? (
                        <span className="text-xs text-ink-subtle italic">—</span>
                      ) : (
                        <button
                          onClick={() => void toggleBan(u)}
                          disabled={isBanning}
                          title={u.isBanned ? "Débloquer l'utilisateur" : "Suspendre l'utilisateur"}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                            u.isBanned
                              ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                              : "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                          }`}
                        >
                          {isBanning ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : u.isBanned ? (
                            <ShieldOff className="w-3.5 h-3.5" />
                          ) : (
                            <Ban className="w-3.5 h-3.5" />
                          )}
                          {u.isBanned ? "Débloquer" : "Suspendre"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selectedUserId !== null && (
        <UserActivityPanel 
          userId={selectedUserId}
          days={30}
          onClose={() => setSelectedUserId(null)}
        />
      )}

      <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
        <Users className="w-3.5 h-3.5" />
        {loading
          ? "Chargement…"
          : `${filtered.length} utilisateur${filtered.length > 1 ? "s" : ""}${
              search.trim() ? ` (filtré sur ${users.length})` : ""
            } — ${users.filter((u) => u.isBanned).length} suspendu${users.filter((u) => u.isBanned).length > 1 ? "s" : ""}`}
      </p>
    </div>
  );
}
