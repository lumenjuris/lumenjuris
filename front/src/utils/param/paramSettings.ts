import type {
  AccountConfirmationModal,
  ConfirmationModalContent,
  EnterpriseSettings,
} from "../../types/paramSettings";

export function createEmptyEnterpriseSettings(): EnterpriseSettings {
  return {
    name: "",
    siren: "",
    codeNaf: "",
    intituleNaf: "",
    statusJuridiqueCode: "",
    statusJuridique: "",
    selectedIdccKey: null,
    idccSelections: [],
    address: {
      address: "",
      codePostal: "",
      pays: "",
    },
  };
}

export function normalizeEnterpriseSettings(
  enterprise?: Partial<EnterpriseSettings> | null,
): EnterpriseSettings {
  return {
    name: enterprise?.name ?? "",
    siren: enterprise?.siren ?? "",
    codeNaf: enterprise?.codeNaf ?? "",
    intituleNaf: enterprise?.intituleNaf ?? "",
    statusJuridiqueCode: enterprise?.statusJuridiqueCode ?? "",
    statusJuridique: enterprise?.statusJuridique ?? "",
    selectedIdccKey: enterprise?.selectedIdccKey ?? null,
    idccSelections:
      enterprise?.idccSelections?.map((selection) => ({ ...selection })) ?? [],
    address: {
      address: enterprise?.address?.address ?? "",
      codePostal: enterprise?.address?.codePostal ?? "",
      pays: enterprise?.address?.pays ?? "",
    },
  };
}

export function cloneEnterpriseSettings(
  enterprise: EnterpriseSettings,
): EnterpriseSettings {
  return normalizeEnterpriseSettings(enterprise);
}

export function getSelectedConventionLabel(enterprise: EnterpriseSettings) {
  const selectedConvention = enterprise.idccSelections.find(
    (selection) => selection.key === enterprise.selectedIdccKey,
  );

  if (!selectedConvention) {
    return "—";
  }

  return `${selectedConvention.name}${
    selectedConvention.idccCode ? ` - IDCC ${selectedConvention.idccCode}` : ""
  }${selectedConvention.source === "custom" ? " (custom)" : ""}`;
}

export function hasEnterpriseDisplayData(enterprise: EnterpriseSettings) {
  return Boolean(
    enterprise.name?.trim() ||
    enterprise.siren?.trim() ||
    enterprise.codeNaf?.trim() ||
    enterprise.intituleNaf?.trim() ||
    enterprise.statusJuridiqueCode?.trim() ||
    enterprise.statusJuridique?.trim() ||
    enterprise.address?.address?.trim() ||
    enterprise.address?.codePostal?.trim() ||
    enterprise.address?.pays?.trim(),
  );
}

export function getParamConfirmationModalContent({
  activeConfirmationModal,
  onClose,
  onTwoFactorConfirm,
  onPasswordConfirm,
  onProfileUpdateConfirm,
  onExportDataConfirm,
  onDeleteAccountConfirm,
}: {
  activeConfirmationModal: AccountConfirmationModal | null;
  onClose: () => void;
  onTwoFactorConfirm: () => void;
  onPasswordConfirm: () => void;
  onProfileUpdateConfirm: () => void;
  onExportDataConfirm: () => void;
  onDeleteAccountConfirm: () => void;
}): ConfirmationModalContent | null {
  switch (activeConfirmationModal) {
    case "profile_update":
      return {
        title: "Mettre à jour le profil",
        description:
          "Voulez-vous enregistrer les modifications de votre profil ?",
        confirmLabel: "Enregistrer",
        confirmClassName: "bg-lumenjuris text-white hover:bg-lumenjuris/90",
        onConfirm: () => {
          onProfileUpdateConfirm();
          onClose();
        },
      };
    case "two_factor":
      return {
        title: "Authentification à deux facteurs",
        description:
          "À chaque connexion, vous recevrez un code par email que vous devrez renseigner pour accéder à votre compte.",
        confirmLabel: "Confirmer",
        confirmClassName: "bg-lumenjuris text-white hover:bg-lumenjuris/90",
        onConfirm: () => {
          onTwoFactorConfirm();
          onClose();
        },
      };
    case "password_change":
      return {
        title: "Modifier le mot de passe",
        description:
          "Voulez-vous enregistrer ce nouveau mot de passe pour votre compte ?",
        confirmLabel: "Enregistrer le mot de passe",
        confirmClassName: "bg-lumenjuris text-white hover:bg-lumenjuris/90",
        onConfirm: () => {
          onPasswordConfirm();
          onClose();
        },
      };
    case "export_data":
      return {
        title: "Exporter mes données",
        description:
          "Vous recevrez prochainement un email contenant toutes les informations liées à votre compte.",
        confirmLabel: "Exporter mes données",
        confirmClassName: "bg-lumenjuris text-white hover:bg-lumenjuris/90",
        onConfirm: () => {
          onExportDataConfirm();
          onClose();
        },
      };
    case "delete_account":
      return {
        title: "Supprimer mon compte",
        description:
          "Vous recevrez un email de confirmation et cette action entraînera la suppression de toutes vos données.",
        confirmLabel: "Supprimer mon compte",
        confirmClassName: "bg-red-600 text-white hover:bg-red-700",
        onConfirm: () => {
          onDeleteAccountConfirm();
          onClose();
        },
      };
    default:
      return null;
  }
}
