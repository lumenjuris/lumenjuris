import { create } from "zustand";
import { fetchProxy } from "../utils/fetchProxy";

interface PreferencesState {
  isDyslexicMode: boolean;
  isEmailNotifications: boolean;
  /** Téléphone professionnel, repris pour préremplir les contrats. */
  telephone: string | null;
  loadPreferences: () => Promise<void>;
  setDyslexicMode: (value: boolean) => Promise<void>;
  setEmailNotifications: (value: boolean) => Promise<void>;
  setTelephone: (value: string) => Promise<boolean>;
  reset: () => void;
}

/** Le serveur fusionne avec l'existant : on n'envoie que ce qui change. */
async function updateAccountParameters(accountParameters: Partial<{
  emailNotifications: boolean;
  telephone: string | null;
}>) {
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

/**
 * Store Zustand des préférences utilisateur enregistrées en BDD.
 * Les préférences sont réparties sur deux endpoints distincts :
 *
 * - **`/api/user/preferences`** (`accountParameters`) — paramètres de compte :
 *   notifications email, téléphone professionnel.
 * - **`/api/user/preferences/ui`** (`preferenceUI`) — préférences d'interface :
 *   mode dyslexique.
 *
 * **Chargement** : `loadPreferences` lance les deux requêtes en parallèle
 * (`Promise.all`) et applique chaque résultat indépendamment — une erreur sur
 * l'un n'empêche pas l'autre de s'appliquer.
 *
 * **Mise à jour optimiste** : `setDyslexicMode` et `setEmailNotifications`
 * appliquent la valeur localement avant la réponse serveur, puis la restaurent
 * à la valeur précédente si la requête échoue. La valeur finale est ensuite
 * synchronisée depuis la réponse serveur pour garantir la cohérence.
 *
 * **`reset`** : remet les valeurs aux défauts applicatifs.
 * À appeler à la déconnexion pour ne pas exposer les préférences d'un autre compte.
 *
 * @example
 * ```ts
 * const { isDyslexicMode, setDyslexicMode } = usePreferencesStore();
 * await setDyslexicMode(true); // appliqué localement, persisté, rollback auto si erreur
 * ```
 */
export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  isDyslexicMode: false,
  isEmailNotifications: true,
  telephone: null,

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
              telephone: dataAccount.data?.accountParameters?.telephone ?? null,
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

  setTelephone: async (value: string) => {
    const previous = get().telephone;
    set({ telephone: value.trim() || null });
    const { ok, data } = await updateAccountParameters({
      telephone: value,
    }).catch(() => ({ ok: false, data: null }));
    if (!ok || !data?.success) {
      set({ telephone: previous });
      return false;
    }
    set({ telephone: data.data?.accountParameters?.telephone ?? null });
    return true;
  },

  reset: () => set({ isDyslexicMode: false, isEmailNotifications: true, telephone: null }),
}));
