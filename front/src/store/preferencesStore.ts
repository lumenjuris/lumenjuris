import { create } from "zustand";
import { fetchProxy } from "../utils/fetchProxy";

interface PreferencesState {
  isDyslexicMode: boolean;
  loadPreferences: () => Promise<void>;
  setDyslexicMode: (value: boolean) => Promise<void>;
  reset: () => void;
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  isDyslexicMode: false,

  loadPreferences: async () => {
    try {
      const res = await fetchProxy("/api/user/preferences", {
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        set({ isDyslexicMode: Boolean(data.data?.dyslexicMode) });
      }
    } catch (error) {
      console.log("PREF STORE ERROR :", error);
    }
  },

  setDyslexicMode: async (value: boolean) => {
    const previous = get().isDyslexicMode;
    set({ isDyslexicMode: value });

    try {
      const res = await fetchProxy("/api/user/preferences", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dyslexicMode: value }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        set({ isDyslexicMode: previous });
      } else {
        set({ isDyslexicMode: Boolean(data.data?.dyslexicMode) });
      }
    } catch {
      set({ isDyslexicMode: previous });
    }
  },

  reset: () => set({ isDyslexicMode: false }),
}));
