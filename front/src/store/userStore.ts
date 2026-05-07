import { create } from 'zustand';
import { UserData } from '../types/userData';
import { fetchProxy } from '../utils/fetchProxy';


interface UserState {
  userData: UserData | null;
  isConnected: boolean;
  userAvatarUrl: string | null;
  userInfoError: string | null;
  fetchUser: () => Promise<void>;
  logoutUser: () => Promise<boolean>;
  reset: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  userData: null,
  isConnected: false,
  userAvatarUrl: null,
  userInfoError: null,

  fetchUser: async () => {
    try {
      const response = await fetchProxy('/api/user/get', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: "include"
      });
      
      const dataResponse = await response.json();
      console.log("Resultat du get data user", dataResponse)
      if (!dataResponse.success) {
        set({ userInfoError: dataResponse.message });
      } else if (dataResponse.data.profile.isVerified) {
        const provider = dataResponse.data.provider as { avatarUrl?: string };
        set({
          isConnected: true,
          userData: dataResponse.data,
          userAvatarUrl: provider?.avatarUrl ?? null,
          userInfoError: null,
        });
      }
    } catch (error) {
      console.error("🛑🛑🛑 ERREUR SERVEUR GET USER", error);
      set({
        userInfoError: "Un problème est survenu, veuillez vous reconnecter.",
      });
    }
  },

  logoutUser: async () => {
    try {
      const response = await fetchProxy('/api/user/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const logoutResponse = await response.json();
      if (logoutResponse.success) {
        set({
          isConnected: false,
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
      userAvatarUrl: null,
      userInfoError: null,
    }),
}));
