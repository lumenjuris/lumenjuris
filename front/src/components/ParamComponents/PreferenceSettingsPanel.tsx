import { SettingsToggleRow } from "../ui/SettingsToggleRow";

type PreferenceSettingsPanelProps = {
  isDyslexicModeEnabled: boolean;
  onDyslexicModeCheckedChange: (checked: boolean) => void;
};

export function PreferenceSettingsPanel({
  isDyslexicModeEnabled,
  onDyslexicModeCheckedChange,
}: PreferenceSettingsPanelProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Paramètres de compte
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Préférences simples du compte utilisateur.
        </p>
      </div>

      <SettingsToggleRow
        label="Mode dyslexique"
        checked={isDyslexicModeEnabled}
        onCheckedChange={onDyslexicModeCheckedChange}
      />
    </div>
  );
}
