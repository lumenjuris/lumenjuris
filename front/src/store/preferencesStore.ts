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

async function updateAccountParameters(accountParameters: {
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

async function updatePreferenceUI(preferenceUI: { dyslexicMode: boolean }) {
  const res = await fetchProxy("/api/user/preferences/ui", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferenceUI }),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, data };
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  isDyslexicMode: false,
  isEmailNotifications: true,

  loadPreferences: async () => {
    try {
      const [resAccount, resUI] = await Promise.all([
        fetchProxy("/api/user/preferences", { credentials: "include" }),
        fetchProxy("/api/user/preferences/ui", { credentials: "include" }),
      ]);
      const dataAccount = await resAccount.json().catch(() => null);
      const dataUI = await resUI.json().catch(() => null);
      set({
        ...(resAccount.ok && dataAccount?.success
          ? {
              isEmailNotifications:
                dataAccount.data?.accountParameters?.emailNotifications !==
                false,
            }
          : {}),
        ...(resUI.ok && dataUI?.success
          ? {
              isDyslexicMode: Boolean(dataUI.data?.preferenceUI?.dyslexicMode),
            }
          : {}),
      });
    } catch (error) {
      console.log("PREF STORE ERROR :", error);
    }
  },

  setDyslexicMode: async (value: boolean) => {
    const previous = get().isDyslexicMode;
    set({ isDyslexicMode: value });
    const { ok, data } = await updatePreferenceUI({
      dyslexicMode: value,
    }).catch(() => ({ ok: false, data: null }));
    if (!ok || !data?.success) {
      set({ isDyslexicMode: previous });
    } else {
      set({
        isDyslexicMode: Boolean(data.data?.preferenceUI?.dyslexicMode),
      });
    }
  },

  setEmailNotifications: async (value: boolean) => {
    const previous = get().isEmailNotifications;
    set({ isEmailNotifications: value });
    const { ok, data } = await updateAccountParameters({
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
