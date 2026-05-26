import { create } from "zustand";
import { fetchProxy } from "../utils/fetchProxy";

interface PreferencesState {
  isDyslexicMode: boolean;
  isEmailNotifications: boolean;
  loadPreferences: () => Promise<void>;
  setDyslexicMode: (value: boolean) => Promise<void>;
  setEmailNotifications: (value: boolean) => Promise<void>;
  reset: () => void;
}

async function updatePreference(accountParameters: {
  dyslexicMode: boolean;
  emailNotifications: boolean;
}) {
  const res = await fetchProxy("/api/user/preferences", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountParameters }),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, data };
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  isDyslexicMode: false,
  isEmailNotifications: true,

  loadPreferences: async () => {
    try {
      const res = await fetchProxy("/api/user/preferences", {
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        const params = data.data?.accountParameters ?? {};
        set({
          isDyslexicMode: Boolean(params.dyslexicMode),
          isEmailNotifications: params.emailNotifications !== false,
        });
      }
    } catch (error) {
      console.log("PREF STORE ERROR :", error);
    }
  },

  setDyslexicMode: async (value: boolean) => {
    const previous = get().isDyslexicMode;
    set({ isDyslexicMode: value });
    const { ok, data } = await updatePreference({
      dyslexicMode: value,
      emailNotifications: get().isEmailNotifications,
    }).catch(() => ({ ok: false, data: null }));
    if (!ok || !data?.success) {
      set({ isDyslexicMode: previous });
    } else {
      set({
        isDyslexicMode: Boolean(data.data?.accountParameters?.dyslexicMode),
      });
    }
  },

  setEmailNotifications: async (value: boolean) => {
    const previous = get().isEmailNotifications;
    set({ isEmailNotifications: value });
    const { ok, data } = await updatePreference({
      dyslexicMode: get().isDyslexicMode,
      emailNotifications: value,
    }).catch(() => ({ ok: false, data: null }));
    if (!ok || !data?.success) {
      set({ isEmailNotifications: previous });
    } else {
      set({
        isEmailNotifications:
          data.data?.accountParameters?.emailNotifications !== false,
      });
    }
  },

  reset: () => set({ isDyslexicMode: false, isEmailNotifications: true }),
}));
