import { Building2, Settings, User, CreditCard } from "lucide-react";
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
    label: "Préférences",
    icon: Settings,
    description: "",
  },
  {
    id: "subscription",
    label: "Mon abonnement",
    icon: CreditCard,
    description: "",
  },
];


export const CONTRACT_GENERATING_TABS:SettingsTabItem[] = [
  {
    id : "static",
    label : "Contrat statique",
    icon : Settings,
    description : ""
  },
    {
    id : "your_models",
    label : "Contrat depuis vos modèles",
    icon : Settings,
    description : ""
  },
    {
    id : "enhanced_generating",
    label : "Génération dynamique",
    icon : Settings,
    description : ""
  }
]

export const ACCOUNT_PASSWORD_INPUT_ID = "account-password";
