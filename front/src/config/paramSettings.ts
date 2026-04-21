import { Building2, Settings, User } from "lucide-react";
import type { SettingsTabItem } from "../types/paramSettings";

// Navigation statique du panneau paramètres.
export const SETTINGS_TABS: SettingsTabItem[] = [
  {
    id: "account",
    label: "Compte et connexion",
    icon: User,
    description: "",
  },
  {
    id: "enterprise",
    label: "Mon entreprise",
    icon: Building2,
    description: "",
  },
  {
    id: "preferences",
    label: "Paramètres de compte",
    icon: Settings,
    description: "",
  },
];

export const ACCOUNT_PASSWORD_INPUT_ID = "account-password";
