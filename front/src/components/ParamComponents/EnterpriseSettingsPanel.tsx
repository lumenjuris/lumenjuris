import type { EnterpriseSettings } from "../../types/paramSettings";
import { getSelectedConventionLabel } from "../../utils/param/paramSettings";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { SettingsDisplayField, SettingsField } from "../ui/SettingsField";
import { AlertBanner } from "../common/AlertBanner";

type EnterpriseSettingsPanelProps = {
  enterpriseSettings: EnterpriseSettings;
  enterpriseDraft: EnterpriseSettings;
  isEditingEnterprise: boolean;
  onEditEnterprise: () => void;
  onCancelEnterpriseEdit: () => void;
  onSaveEnterpriseEdit: () => void;
  enterpriseUpdateSuccess: boolean;
  onEnterpriseUpdateSuccessClose: () => void;
  enterpriseUpdateError: boolean;
  onEnterpriseUpdateErrorClose: () => void;
  onEnterpriseFieldChange: (
    field: Exclude<keyof EnterpriseSettings, "address" | "idccSelections">,
    value: string,
  ) => void;
  onEnterpriseAddressFieldChange: (
    field: keyof NonNullable<EnterpriseSettings["address"]>,
    value: string,
  ) => void;
  shouldShowInseePrefill: boolean;
  inseeLookupSiren: string;
  onInseeLookupSirenChange: (value: string) => void;
  canTriggerInseePrefill: boolean;
  isPrefillingFromSiren: boolean;
  inseePrefillError: string | null;
  onPrefillFromSiren: () => void;
};

export function EnterpriseSettingsPanel({
  enterpriseSettings,
  enterpriseDraft,
  isEditingEnterprise,
  onEditEnterprise,
  onCancelEnterpriseEdit,
  onSaveEnterpriseEdit,
  enterpriseUpdateSuccess,
  onEnterpriseUpdateSuccessClose,
  enterpriseUpdateError,
  onEnterpriseUpdateErrorClose,
  onEnterpriseFieldChange,
  onEnterpriseAddressFieldChange,
  shouldShowInseePrefill,
  inseeLookupSiren,
  onInseeLookupSirenChange,
  canTriggerInseePrefill,
  isPrefillingFromSiren,
  inseePrefillError,
  onPrefillFromSiren,
}: EnterpriseSettingsPanelProps) {
  const currentEnterprise = isEditingEnterprise
    ? enterpriseDraft
    : enterpriseSettings;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Mon entreprise</h2>
        <p className="mt-1 text-sm text-gray-500">
          Informations éditables de l’entreprise et de son adresse.
        </p>
      </div>

      {enterpriseUpdateSuccess && (
        <AlertBanner
          title="Entreprise mise à jour !"
          variant="success"
          detail="Les informations de votre entreprise ont bien été enregistrées."
          duration={6000}
          onClose={onEnterpriseUpdateSuccessClose}
        />
      )}
      {enterpriseUpdateError && (
        <AlertBanner
          title="Echec de la mise à jour !"
          variant="error"
          detail="Les informations de l'entreprise n'ont pu être mises à jour. Veuillez réessayer."
          duration={6000}
          onClose={onEnterpriseUpdateErrorClose}
        />
      )}

      {shouldShowInseePrefill ? (
        <div className="space-y-3 rounded-xl border border-gray-300 bg-gray-50 px-4 py-4">
          <div>
            <p className="text-sm font-medium text-gray-900">
              Pré-remplissage via les données publiques
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Renseignez un numéro SIREN pour récupérer automatiquement les
              informations de l’entreprise.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <SettingsField label="Numéro SIREN">
                <Input
                  value={inseeLookupSiren}
                  onChange={(event) =>
                    onInseeLookupSirenChange(event.target.value)
                  }
                  placeholder="Ex. 940468606"
                  inputMode="numeric"
                />
              </SettingsField>
            </div>

            <Button
              type="button"
              onClick={onPrefillFromSiren}
              disabled={!canTriggerInseePrefill || isPrefillingFromSiren}
              className="bg-lumenjuris text-white hover:bg-lumenjuris/90 disabled:bg-lumenjuris/60"
            >
              {isPrefillingFromSiren ? "Pré-remplissage..." : "Pré-remplir"}
            </Button>
          </div>

          {!canTriggerInseePrefill ? (
            <p className="text-xs text-gray-500">
              Le SIREN doit contenir 9 chiffres.
            </p>
          ) : null}
          {inseePrefillError ? (
            <p className="text-xs text-red-600">{inseePrefillError}</p>
          ) : null}
        </div>
      ) : null}

      {isEditingEnterprise ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SettingsField label="Nom entreprise">
              <Input
                value={enterpriseDraft.name ?? ""}
                onChange={(event) =>
                  onEnterpriseFieldChange("name", event.target.value)
                }
              />
            </SettingsField>
            <SettingsField label="SIREN">
              <Input
                value={enterpriseDraft.siren ?? ""}
                onChange={(event) =>
                  onEnterpriseFieldChange("siren", event.target.value)
                }
              />
            </SettingsField>
            <SettingsField label="Code NAF">
              <Input
                value={enterpriseDraft.codeNaf ?? ""}
                onChange={(event) =>
                  onEnterpriseFieldChange("codeNaf", event.target.value)
                }
              />
            </SettingsField>
            <SettingsField label="Intitulé NAF">
              <Input
                value={enterpriseDraft.intituleNaf ?? ""}
                onChange={(event) =>
                  onEnterpriseFieldChange("intituleNaf", event.target.value)
                }
              />
            </SettingsField>
            <SettingsField label="Code statut juridique">
              <Input
                value={enterpriseDraft.statusJuridiqueCode ?? ""}
                onChange={(event) =>
                  onEnterpriseFieldChange(
                    "statusJuridiqueCode",
                    event.target.value,
                  )
                }
              />
            </SettingsField>
            <SettingsField label="Statut juridique">
              <Input
                value={enterpriseDraft.statusJuridique ?? ""}
                onChange={(event) =>
                  onEnterpriseFieldChange("statusJuridique", event.target.value)
                }
              />
            </SettingsField>
          </div>

          <SettingsField label="Adresse">
            <Input
              value={enterpriseDraft.address?.address ?? ""}
              onChange={(event) =>
                onEnterpriseAddressFieldChange("address", event.target.value)
              }
            />
          </SettingsField>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SettingsField label="Code postal">
              <Input
                value={enterpriseDraft.address?.codePostal ?? ""}
                onChange={(event) =>
                  onEnterpriseAddressFieldChange(
                    "codePostal",
                    event.target.value,
                  )
                }
              />
            </SettingsField>
            <SettingsField label="Pays">
              <Input
                value={enterpriseDraft.address?.pays ?? ""}
                onChange={(event) =>
                  onEnterpriseAddressFieldChange("pays", event.target.value)
                }
              />
            </SettingsField>
          </div>

          <SettingsField label="Convention Collective sélectionnée">
            <select
              value={enterpriseDraft.selectedIdccKey ?? ""}
              onChange={(event) =>
                onEnterpriseFieldChange("selectedIdccKey", event.target.value)
              }
              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none focus:border-lumenjuris"
            >
              {enterpriseSettings.idccSelections.map((selection) => (
                <option key={selection.key} value={selection.key}>
                  {selection.name}
                  {selection.idccCode ? ` - IDCC ${selection.idccCode}` : ""}
                  {selection.source === "custom" ? " (custom)" : ""}
                </option>
              ))}
            </select>
          </SettingsField>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              className="hover:bg-gray-100"
              onClick={onCancelEnterpriseEdit}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={onSaveEnterpriseEdit}
              className="bg-lumenjuris text-white hover:bg-lumenjuris/90"
            >
              Valider
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SettingsDisplayField
              label="Nom entreprise"
              value={currentEnterprise.name}
            />
            <SettingsDisplayField
              label="SIREN"
              value={currentEnterprise.siren}
            />
            <SettingsDisplayField
              label="Code NAF"
              value={currentEnterprise.codeNaf}
            />
            <SettingsDisplayField
              label="Intitulé NAF"
              value={currentEnterprise.intituleNaf}
            />
            <SettingsDisplayField
              label="Code statut juridique"
              value={currentEnterprise.statusJuridiqueCode}
            />
            <SettingsDisplayField
              label="Statut juridique"
              value={currentEnterprise.statusJuridique}
            />
          </div>

          <SettingsDisplayField
            label="Adresse"
            value={currentEnterprise.address?.address}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SettingsDisplayField
              label="Code postal"
              value={currentEnterprise.address?.codePostal}
            />
            <SettingsDisplayField
              label="Pays"
              value={currentEnterprise.address?.pays}
            />
          </div>

          <SettingsDisplayField
            label="Convention Collective sélectionnée"
            value={getSelectedConventionLabel(currentEnterprise)}
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onEditEnterprise}
              className="text-[14px] border border-gray-400 h-9 rounded-md px-2 font-semibold bg-lumenjuris text-white transition-colors hover:bg-lumenjuris/90"
            >
              Modifier les informations de mon entreprise
            </button>
          </div>
        </>
      )}
    </div>
  );
}
