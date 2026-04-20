import { FcGoogle } from "react-icons/fc";
import { ACCOUNT_PASSWORD_INPUT_ID } from "../../config/paramSettings";
import type {
  AccountProfile,
  AccountProvider,
} from "../../types/paramSettings";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { SettingsField } from "../ui/SettingsField";
import { SettingsToggleRow } from "../ui/SettingsToggleRow";

type AccountSettingsPanelProps = {
  profile: AccountProfile;
  password: string;
  provider: AccountProvider;
  isTwoFactorEnabled: boolean;
  onProfileFieldChange: (
    field: "prenom" | "nom" | "email",
    value: string,
  ) => void;
  onProfileFieldBlur: () => void;
  onPasswordChange: (value: string) => void;
  onPasswordBlur: () => void;
  onTwoFactorCheckedChange: (checked: boolean) => void;
  onExportDataClick: () => void;
  onDeleteAccountClick: () => void;
};

export function AccountSettingsPanel({
  profile,
  password,
  provider,
  isTwoFactorEnabled,
  onProfileFieldChange,
  onProfileFieldBlur,
  onPasswordChange,
  onPasswordBlur,
  onTwoFactorCheckedChange,
  onExportDataClick,
  onDeleteAccountClick,
}: AccountSettingsPanelProps) {
  // Le panneau Google décide seul de son affichage à partir du provider reçu.
  const googleConnectionPanelMode =
    provider?.provider === "GOOGLE"
      ? (provider.googleConnectionPanelMode ?? "google_only")
      : "hidden";
  const shouldShowGooglePanel = googleConnectionPanelMode !== "hidden";
  const hasAddedPassword =
    googleConnectionPanelMode === "google_with_password";

  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Compte et connexion
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Informations personnelles du compte.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SettingsField label="Prénom">
            <Input
              value={profile.prenom}
              onChange={(event) =>
                onProfileFieldChange("prenom", event.target.value)
              }
              onBlur={onProfileFieldBlur}
            />
          </SettingsField>
          <SettingsField label="Nom">
            <Input
              value={profile.nom}
              onChange={(event) => onProfileFieldChange("nom", event.target.value)}
              onBlur={onProfileFieldBlur}
            />
          </SettingsField>
          <SettingsField label="Email">
            <Input
              type="email"
              value={profile.email}
              onChange={(event) =>
                onProfileFieldChange("email", event.target.value)
              }
              onBlur={onProfileFieldBlur}
            />
          </SettingsField>
          <SettingsField label="Mot de passe">
            <Input
              id={ACCOUNT_PASSWORD_INPUT_ID}
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              onBlur={onPasswordBlur}
            />
          </SettingsField>
        </div>

        <SettingsToggleRow
          label="Authentification à deux facteurs"
          checked={isTwoFactorEnabled}
          onCheckedChange={onTwoFactorCheckedChange}
        />

        {shouldShowGooglePanel ? (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
            <div className="flex items-center gap-3">
              <FcGoogle className="h-6 w-6" />
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Connexion Google
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  {hasAddedPassword
                    ? "Vous êtes connecté via Google. Vous avez ajouté un mot de passe."
                    : "Vous êtes actuellement connecté uniquement via Google."}
                </div>
                {!hasAddedPassword ? (
                  <button
                    type="button"
                    onClick={() => {
                      const passwordInput = document.getElementById(
                        ACCOUNT_PASSWORD_INPUT_ID,
                      );

                      passwordInput?.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                      });
                      (passwordInput as HTMLInputElement | null)?.focus();
                    }}
                    className="mt-2 text-xs font-medium text-lumenjuris underline underline-offset-2 transition-colors hover:text-lumenjuris/80"
                  >
                    Ajouter un mot de passe
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onExportDataClick}>
          Exporter mes données
        </Button>
        <Button
          type="button"
          onClick={onDeleteAccountClick}
          className="bg-red-600 text-white hover:bg-red-700"
        >
          Supprimer mon compte
        </Button>
      </div>
    </div>
  );
}
