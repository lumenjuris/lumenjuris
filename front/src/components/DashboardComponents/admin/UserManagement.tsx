import { useCallback, useEffect, useState } from "react";
import { Users, AlertCircle, ShieldCheck, Loader2, Check } from "lucide-react";
import { fetchProxy } from "../../../utils/fetchProxy";
import { useUserStore } from "../../../store/userStore";

type Role = "ADMIN" | "JURISTE" | "USER" | "LECTEUR";

interface AdminUser {
  idUser: number;
  email: string;
  nom: string | null;
  prenom: string | null;
  role: Role;
  isVerified: boolean;
}

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrateur",
  JURISTE: "Juriste",
  USER: "Utilisateur",
  LECTEUR: "Lecteur (lecture seule)",
};

const ROLE_STYLE: Record<Role, { bg: string; fg: string }> = {
  ADMIN: { bg: "#ede9fe", fg: "#5b21b6" },
  JURISTE: { bg: "#dbeafe", fg: "#1e40af" },
  USER: { bg: "#d1fae5", fg: "#065f46" },
  LECTEUR: { bg: "#f1f5f9", fg: "#64748b" },
};

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json()) as { success?: boolean; data?: T; message?: string };
  if (!res.ok || data.success === false) throw new Error(data.message || `Erreur ${res.status}`);
  return data.data as T;
}

/** Gestion des utilisateurs et des rôles (réservé aux administrateurs). */
export function UserManagement() {
  const role = useUserStore((s) => s.userData?.profile?.role);
  const myId = useUserStore((s) => s.userData?.profile?.idUser);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

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

  async function changeRole(u: AdminUser, newRole: Role) {
    if (newRole === u.role) return;
    setSavingId(u.idUser); setError("");
    // Optimiste
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
      await load(); // resync sur erreur
    } finally {
      setSavingId(null);
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
        <p className="text-sm text-ink-muted mt-1">Attribuez les rôles et droits d'accès de votre équipe.</p>
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
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-surface-subtle border-b border-line text-ink-subtle text-[10px] uppercase tracking-widest font-semibold">
              <tr>
                <th className="px-4 py-3">Utilisateur</th>
                <th className="px-4 py-3">Rôle actuel</th>
                <th className="px-4 py-3">Modifier le rôle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {users.map((u) => {
                const initials = `${u.prenom?.[0] ?? ""}${u.nom?.[0] ?? ""}`.toUpperCase() || u.email[0]?.toUpperCase() || "?";
                const name = [u.prenom, u.nom].filter(Boolean).join(" ") || u.email.split("@")[0];
                const isSelf = u.idUser === myId;
                return (
                  <tr key={u.idUser} className="hover:bg-surface-subtle/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-brand-light text-brand flex items-center justify-center text-xs font-bold shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">
                            {name}
                            {isSelf && <span className="text-[10px] text-ink-subtle font-normal ml-1.5">(vous)</span>}
                          </p>
                          <p className="text-xs text-ink-muted truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-chip tracking-wide"
                        style={{ backgroundColor: ROLE_STYLE[u.role].bg, color: ROLE_STYLE[u.role].fg }}
                      >
                        {ROLE_LABEL[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={u.role}
                          disabled={savingId === u.idUser || isSelf}
                          onChange={(e) => void changeRole(u, e.target.value as Role)}
                          className="bg-white border border-line px-3 py-1.5 rounded-lg text-sm text-ink-secondary outline-none focus:border-brand/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          title={isSelf ? "Vous ne pouvez pas modifier votre propre rôle" : undefined}
                        >
                          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                          ))}
                        </select>
                        {savingId === u.idUser && <Loader2 className="w-4 h-4 animate-spin text-ink-subtle" />}
                        {savedId === u.idUser && <Check className="w-4 h-4 text-success" />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
        <Users className="w-3.5 h-3.5" />
        {loading ? "Chargement…" : `${users.length} utilisateur${users.length > 1 ? "s" : ""}`}
      </p>
    </div>
  );
}
