import { create } from "zustand";
import { UserData } from "../types/userData";
import { fetchProxy } from "../utils/fetchProxy";

/**
 * Cycle de vie de l'authentification :
 * - `"idle"`            — état initial, `fetchUser` n'a pas encore été appelé.
 * - `"loading"`         — vérification du cookie JWT en cours.
 * - `"authenticated"`   — utilisateur connecté et vérifié.
 * - `"unauthenticated"` — pas de session valide (cookie absent, expiré ou compte non vérifié).
 */
export type AuthStatus =
  | "idle"
  | "loading"
  | "authenticated"
  | "unauthenticated";

interface UserState {
  userData: UserData | null;
  isConnected: boolean;
  authStatus: AuthStatus;
  userAvatarUrl: string | null;
  userInfoError: string | null;
  fetchUser: () => Promise<void>;
  logoutUser: () => Promise<boolean>;
  reset: () => void;
}

/**
 * Store Zustand de la session utilisateur.
 * Fournit l'identité et le statut d'authentification dans toute l'application.
 *
 * ---
 *
 * **`fetchUser`** — appelle `GET /api/user/get` et met à jour le store selon
 * la réponse :
 * - Succès + `isVerified` → `authStatus: "authenticated"`, `userData` renseigné,
 *   `userAvatarUrl` extrait du provider OAuth si disponible.
 * - Succès mais non vérifié → `authStatus: "unauthenticated"` (le compte existe
 *   mais l'email n'a pas été confirmé — traité comme non connecté).
 * - Erreur réseau / serveur → `authStatus: "unauthenticated"`, `userInfoError` renseigné.
 *
 * **`logoutUser`** — appelle `POST /api/user/auth/logout` pour invalider le cookie
 * JWT côté serveur, puis remet le store à zéro. Retourne `true` si la déconnexion
 * a réussi, `false` sinon (l'appelant peut décider de ne pas naviguer).
 *
 * **`reset`** — remet le store à l'état "non connecté" sans appel réseau.
 * Utile pour nettoyer l'état après expiration de session détectée localement.
 *
 * @example
 * ```ts
 * const { authStatus, fetchUser, logoutUser } = useUserStore();
 *
 * // Vérification de session au démarrage
 * useEffect(() => { if (authStatus === "idle") void fetchUser(); }, [authStatus]);
 *
 * // Déconnexion avec redirection conditionnelle
 * const success = await logoutUser();
 * if (success) navigate("/");
 * ```
 */
export const useUserStore = create<UserState>((set) => ({
  userData: null,
  isConnected: false,
  authStatus: "idle",
  userAvatarUrl: null,
  userInfoError: null,

  fetchUser: async () => {
    set({ authStatus: "loading" });
    try {
      const response = await fetchProxy("/api/user/get", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const dataResponse = await response.json();
      if (dataResponse.success && dataResponse.data?.profile?.isVerified) {
        const provider = dataResponse.data.provider as { avatarUrl?: string };
        set({
          isConnected: true,
          authStatus: "authenticated",
          userData: dataResponse.data,
          userAvatarUrl: provider?.avatarUrl ?? null,
          userInfoError: null,
        });
      } else {
        set({
          isConnected: false,
          authStatus: "unauthenticated",
          userData: null,
          userAvatarUrl: null,
          userInfoError: dataResponse.success ? null : dataResponse.message,
        });
      }
    } catch (error) {
      console.error("🛑🛑🛑 ERREUR SERVEUR GET USER", error);
      set({
        isConnected: false,
        authStatus: "unauthenticated",
        userInfoError: "Un problème est survenu, veuillez vous reconnecter.",
      });
    }
  },

  logoutUser: async () => {
    try {
      const response = await fetchProxy("/api/user/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const logoutResponse = await response.json();
      if (logoutResponse.success) {
        set({
          isConnected: false,
          authStatus: "unauthenticated",
          userData: null,
          userAvatarUrl: null,
          userInfoError: null,
        });
        return true;
      }
      set({ userInfoError: logoutResponse.message });
      return false;
    } catch (error) {
      set({
        userInfoError:
          "Une erreur s'est produite, vous n'avez pas été déconnecté...",
      });
      console.error(error);
      return false;
    }
  },

  reset: () =>
    set({
      userData: null,
      isConnected: false,
      authStatus: "unauthenticated",
      userAvatarUrl: null,
      userInfoError: null,
    }),
}));
