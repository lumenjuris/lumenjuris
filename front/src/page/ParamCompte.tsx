import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SETTINGS_TABS } from "../config/paramSettings";
import { useEnterpriseSettings } from "../hooks/useEnterpriseSettings";
import { AccountSettingsPanel } from "../components/ParamComponents/AccountSettingsPanel";
import { EnterpriseSettingsPanel } from "../components/ParamComponents/EnterpriseSettingsPanel";
import { ParamLayout } from "../components/ParamComponents/ParamLayout";
import { SubscriptionSettingsPanel } from "../components/ParamComponents/SubscriptionSettingsPanel";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";
import { CurrentPasswordModal } from "../components/ParamComponents/CurrentPasswordModal";
import { TwoFactorCodeModal } from "../components/ui/TwoFactorCodeModal";
import type {
  AccountConfirmationModal,
  AccountProfile,
  AccountProvider,
  ApiResponse,
  EnterpriseSettings,
  SettingsTab,
} from "../types/paramSettings";
import {
  createEmptyEnterpriseSettings,
  getParamConfirmationModalContent,
  normalizeEnterpriseSettings,
} from "../utils/param/paramSettings";

import { useUserStore } from "../store/userStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { fetchProxy } from "../utils/fetchProxy";

/**
 * Levée quand le serveur exige le mot de passe actuel (changement d'e-mail,
 * désactivation de la 2FA…). Signale à l'appelant qu'il faut ouvrir la modale
 * de ré-authentification plutôt qu'afficher une erreur.
 */
class ReauthRequiredError extends Error {}

const EMPTY_ACCOUNT_PROFILE: AccountProfile = {
  prenom: "",
  nom: "",
  email: "",
  isVerified: false,
  cgu: false,
};

export function ParamCompte() {
  const location = useLocation();
  const navigate = useNavigate();

  // Paramètres d'URL posés par le portail Stripe à son retour
  // (return_url = /mon-compte?tab=subscription&from=portal).
  const urlParams = new URLSearchParams(location.search);

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const state = location.state as {
      tab?: SettingsTab;
      origin?: string;
    } | null;
    if (state?.tab) return state.tab;
    if (state?.origin === "header-alert") return "enterprise";
    if (urlParams.get("tab") === "subscription") return "subscription";
    return "account";
  });
  // Mémorisé au premier rendu, car l'URL est nettoyée juste après
  const [isBackFromBillingPortal] = useState(
    () => urlParams.get("from") === "portal",
  );
  const [panelMinHeight, setPanelMinHeight] = useState<number | null>(null);
  const [accountProfile, setAccountProfile] = useState<AccountProfile>(
    EMPTY_ACCOUNT_PROFILE,
  );
  const [accountPassword, setAccountPassword] = useState("");
  const  [confirmPassword, setConfirmPassword] = useState("");
  const [accountProvider, setAccountProvider] = useState<AccountProvider>(null);
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);
  const [isTwoFactorCodeModalOpen, setIsTwoFactorCodeModalOpen] =
    useState(false);
  const [activeConfirmationModal, setActiveConfirmationModal] =
    useState<AccountConfirmationModal | null>(null);

  // Modale de ré-authentification, partagée par les actions sensibles de cette
  // page (changement d'e-mail, désactivation de la 2FA). L'action à rejouer une
  // fois le mot de passe saisi est gardée dans une ref.
  const [reauthModalOpen, setReauthModalOpen] = useState(false);
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);
  const reauthActionRef = useRef<
    ((currentPassword: string) => Promise<void>) | null
  >(null);
  const isDyslexicModeEnabled = usePreferencesStore(
    (state) => state.isDyslexicMode,
  );
  const setDyslexicMode = usePreferencesStore((state) => state.setDyslexicMode);
  const isEmailNotificationsEnabled = usePreferencesStore(
    (state) => state.isEmailNotifications,
  );
  const setEmailNotifications = usePreferencesStore(
    (state) => state.setEmailNotifications,
  );
  const [profileUpdateSuccess, setProfileUpdateSuccess] = useState(false);
  const [profileUpdateError, setProfileUpdateError] = useState(false);
  const [enterpriseUpdateSuccess, setEnterpriseUpdateSuccess] = useState(false);
  const [enterpriseUpdateError, setEnterpriseUpdateError] = useState(false);
  const [enterpriseInitialSettings, setEnterpriseInitialSettings] =
    useState<EnterpriseSettings>(createEmptyEnterpriseSettings());
  const enterprise = useEnterpriseSettings(enterpriseInitialSettings);
  const [exportDataSuccess, setExportDataSuccess] = useState(false);
  const [exportDataError, setExportDataError] = useState(false);
  const [deleteMailSuccess, setDeleteMailSuccess] = useState(false);
  const [deleteMailError, setDeleteMailError] = useState(false);

  useEffect(() => {
    if (location.state || location.search) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accountMeasureRef = useRef<HTMLElement>(null);
  const enterpriseMeasureRef = useRef<HTMLElement>(null);
  const preferenceMeasureRef = useRef<HTMLElement>(null);
  const subscriptionMeasureRef = useRef<HTMLElement>(null);

  const { userData, fetchUser } = useUserStore();

  useEffect(() => {
    if (!userData) return;

    const provider = userData.provider as { provider?: string };
    setAccountProfile({
      prenom: userData.profile.prenom ?? "",
      nom: userData.profile.nom ?? "",
      email: userData.profile.email,
      isVerified: userData.profile.isVerified,
      cgu: false,
    });
    setAccountProvider(
      provider?.provider === "GOOGLE"
        ? {
          provider: "GOOGLE",
          googleConnectionPanelMode:
            (
              provider as {
                googleConnectionPanelMode?:
                | "google_only"
                | "google_with_password";
              }
            ).googleConnectionPanelMode ?? "google_only",
        }
        : null,
    );
    setEnterpriseInitialSettings(
      normalizeEnterpriseSettings(
        userData.enterprise as Partial<EnterpriseSettings> | null,
      ),
    );
    setIsTwoFactorEnabled(Boolean(userData.profile.twoFactorEnabled));
  }, [userData]);

  useLayoutEffect(() => {
    const measurePanels = () => {
      if (window.innerWidth < 768) {
        setPanelMinHeight((current) => (current === null ? current : null));
        return;
      }

      const heights = [
        accountMeasureRef.current?.offsetHeight ?? 0,
        enterpriseMeasureRef.current?.offsetHeight ?? 0,
        preferenceMeasureRef.current?.offsetHeight ?? 0,
      ];
      const nextHeight = Math.max(...heights);

      setPanelMinHeight((current) =>
        current === nextHeight ? current : nextHeight,
      );
    };

    measurePanels();
    window.addEventListener("resize", measurePanels);

    return () => {
      window.removeEventListener("resize", measurePanels);
    };
  }, [
    accountPassword,
    accountProfile,
    accountProvider,
    enterprise.enterpriseDraft,
    enterprise.enterpriseSettings,
    enterprise.inseeLookupSiren,
    enterprise.inseePrefillError,
    enterprise.isEditingEnterprise,
    enterprise.isPrefillingFromSiren,
    isDyslexicModeEnabled,
    isTwoFactorEnabled,
  ]);

  const handleProfileFieldChange = (
    field: "prenom" | "nom" | "email",
    value: string,
  ) => {
    setAccountProfile((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleCancelProfileEdit = () => {
    if (!userData) return;
    setAccountProfile({
      prenom: userData.profile.prenom ?? "",
      nom: userData.profile.nom ?? "",
      email: userData.profile.email,
      isVerified: userData.profile.isVerified,
      cgu: false,
    });
  };

  const handleDyslexicModeCheckedChange = (checked: boolean) => {
  void setDyslexicMode(checked);
};

  const persistAccountSettings = async ({
    includePassword = false,
    currentPassword,
  }: {
    includePassword?: boolean;
    /** Mot de passe actuel, requis par le serveur pour un changement d'e-mail. */
    currentPassword?: string;
  } = {}) => {
    const nextPassword = accountPassword.trim();

    if (includePassword && !nextPassword) {
      return;
    }

    const response = await fetchProxy("/api/user", {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prenom: accountProfile.prenom,
        nom: accountProfile.nom,
        email: accountProfile.email,
        ...(includePassword ? { password: nextPassword } : {}),
        ...(currentPassword ? { currentPassword } : {}),
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | (ApiResponse<{
          profile: AccountProfile;
          provider: AccountProvider;
        }> & { reason?: string })
      | null;

    if (!response.ok || !payload?.success || !payload.data) {
      // Le serveur réclame le mot de passe actuel (e-mail modifié) : on remonte
      // une erreur typée pour ouvrir la modale de ré-authentification, sans
      // afficher la bannière d'erreur générique.
      if (payload?.reason === "wrong-current-password") {
        throw new ReauthRequiredError(payload.message);
      }
      setProfileUpdateError(true);
      throw new Error(
        payload?.message ||
        "Impossible de mettre à jour les informations du compte.",
      );
    }

    setAccountProfile({
      prenom: payload.data.profile.prenom ?? "",
      nom: payload.data.profile.nom ?? "",
      email: payload.data.profile.email ?? "",
      isVerified: Boolean(payload.data.profile.isVerified),
      cgu: Boolean(payload.data.profile.cgu),
    });
    setAccountProvider(payload.data.provider ?? null);

    if (includePassword) {
      setAccountPassword("");
    }
  };

  // Ouvre la modale de ré-authentification pour une action sensible : l'action
  // reçoit le mot de passe actuel saisi et doit lever une erreur si le serveur
  // le refuse (la modale reste alors ouverte avec le message).
  const demanderMotDePasseActuel = (
    action: (currentPassword: string) => Promise<void>,
  ) => {
    reauthActionRef.current = action;
    setReauthError(null);
    setReauthModalOpen(true);
  };

  const handleReauthConfirm = async (currentPassword: string) => {
    if (!reauthActionRef.current) return;
    setReauthLoading(true);
    setReauthError(null);
    try {
      await reauthActionRef.current(currentPassword);
      setReauthModalOpen(false);
      reauthActionRef.current = null;
    } catch (error) {
      setReauthError(
        error instanceof Error
          ? error.message
          : "Le mot de passe actuel est incorrect.",
      );
    } finally {
      setReauthLoading(false);
    }
  };

  // Désactivation de la 2FA : le serveur exige le mot de passe actuel, on le
  // demande avant d'envoyer.
  const disableTwoFactor = async (currentPassword: string) => {
    const response = await fetchProxy("/api/user", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ twoFactorEnabled: false, currentPassword }),
    });
    const payload = (await response.json().catch(() => null)) as
      | (ApiResponse<unknown> & { reason?: string })
      | null;

    if (!response.ok || !payload?.success) {
      throw new Error(
        payload?.message ?? "Le mot de passe actuel est incorrect.",
      );
    }
    setIsTwoFactorEnabled(false);
  };

  const handlePasswordBlur = () => {
    if (!accountPassword.trim()) {
      return;
    }

    setActiveConfirmationModal("password_change");
  };

  const handleTwoFactorCodeVerify = async (code: string) => {
    const response = await fetchProxy("/api/user/two-factor/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const payload = (await response
      .json()
      .catch(() => null)) as ApiResponse<unknown> | null;

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.message ?? "Code invalide. Veuillez réessayer.");
    }

    setIsTwoFactorEnabled(true);
    setIsTwoFactorCodeModalOpen(false);
  };

  const handleTwoFactorCheckedChange = async (checked: boolean) => {
    if (checked) {
      setActiveConfirmationModal("two_factor");
      return;
    }
    // Désactivation : action sensible, on confirme par le mot de passe actuel.
    demanderMotDePasseActuel(disableTwoFactor);
  };

  const handleResendTwoFactorCode = async () => {
    const response = await fetchProxy("/api/user/two-factor",{ 
      method: "POST",
      credentials: "include",
    })
    const payload = (await response.json().catch(() => null)) as ApiResponse<unknown> | null;
    if (!response.ok || !payload?.success) {
      throw new Error(
        payload?.message || "Impossible d'envoyer le code de vérification"
      );
    }
  };



  const handleEmailNotificationsCheckedChange = (checked: boolean) => {
    void setEmailNotifications(checked);
  };

  const handleTabChange = (nextTab: SettingsTab) => {
    if (nextTab === activeTab) {
      return;
    }

    if (
      activeTab === "enterprise" &&
      nextTab !== "enterprise" &&
      enterprise.isEditingEnterprise
    ) {
      enterprise.handleCancelEnterpriseEdit();
    };

    setActiveConfirmationModal(null);
    setActiveTab(nextTab);
  };

  const confirmationModalContent = getParamConfirmationModalContent({
    activeConfirmationModal,
    onClose: () => setActiveConfirmationModal(null),
    onTwoFactorConfirm: () => {
      void fetchProxy("/api/user/two-factor", {
        method: "POST",
        credentials: "include",
      })
        .then(async (response) => {
          const payload = (await response
            .json()
            .catch(() => null)) as ApiResponse<unknown> | null;

          if (!response.ok || !payload?.success) {
            throw new Error(
              payload?.message ||
              "Impossible d'envoyer le code de vérification.",
            );
          }

          setActiveConfirmationModal(null);
          setIsTwoFactorCodeModalOpen(true);
        })
        .catch((error) => {
          console.error(error);
        });
    },

    onPasswordConfirm: () => {
      void persistAccountSettings({ includePassword: true }).catch((error) => {
        console.error(error);
      });
    },

    onProfileUpdateConfirm: () => {
      void persistAccountSettings()
        .then(() => setProfileUpdateSuccess(true))
        .catch((error) => {
          // E-mail modifié : le serveur réclame le mot de passe actuel. On
          // ouvre la modale et on rejoue la mise à jour avec ce mot de passe.
          if (error instanceof ReauthRequiredError) {
            demanderMotDePasseActuel(async (currentPassword) => {
              await persistAccountSettings({ currentPassword });
              setProfileUpdateSuccess(true);
            });
            return;
          }
          setProfileUpdateError(true);
          console.error(error);
        });
    },

    onExportDataConfirm: () => {
      void fetchProxy("/api/user/export-data", {
        method: "POST",
        credentials: "include",
        // headers: { "Content-Type": "application/json" },
        // body: token ? JSON.stringify({ token }) : undefined,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Erreur lors de la récupération des données");
          }
          const result = await response.json();
          if (!result.success) {
            throw new Error(result.message || "L'export a échoué");
          }

          setActiveConfirmationModal(null);
          setExportDataSuccess(true);
        })
        .catch((error) => {
          console.error("Erreur d'export des données :", error);
          setExportDataError(true);
        });
    },

    onSendMailDeleteAccountConfirm: () => {
      void fetchProxy("/api/user/account", {
        method: "POST",
        credentials: "include",
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(
              "Erreur lors de la demande de suppression de compte",
            );
          }

          const result = await response.json();

          if (!result.success) {
            throw new Error(
              result.message || "La demande de suppression de compte a échoué",
            );
          }
          setActiveConfirmationModal(null);
          setDeleteMailSuccess(true);
        })
        .catch((error) => {
          console.error("Erreur demande de suppression de compte : ", error);
          setDeleteMailError(true);
        });
    },

    onDeleteAccountConfirm: () => {},
  });

  const onEnterpriseUpdateConfirm = () => {
    void enterprise
      .handleSaveEnterpriseEdit()
      .then(() => {
        setEnterpriseUpdateSuccess(true);
        void fetchUser();
      })
      .catch((error) => {
        setEnterpriseUpdateError(true);
        console.error(error);
      });
  };

  const accountPanel = (
    <AccountSettingsPanel
      profile={accountProfile}
      password={accountPassword}
      setPassword={setAccountPassword}
      confirmPassword={confirmPassword}
      setConfirmPassword={setConfirmPassword}
      provider={accountProvider}
      isTwoFactorEnabled={isTwoFactorEnabled}
      isDyslexicModeEnabled={isDyslexicModeEnabled}
      onDyslexicModeCheckedChange={handleDyslexicModeCheckedChange}
      isEmailNotificationsEnabled={isEmailNotificationsEnabled}
      onEmailNotificationsCheckedChange={handleEmailNotificationsCheckedChange}
      onProfileFieldChange={handleProfileFieldChange}
      onCancelProfileEdit={handleCancelProfileEdit}
      onUpdateProfileClick={() => setActiveConfirmationModal("profile_update")}
      profileUpdateSuccess={profileUpdateSuccess}
      onProfileUpdateSuccessClose={() => setProfileUpdateSuccess(false)}
      profileUpdateError={profileUpdateError}
      onProfileUpdateErrorClose={() => {
        setProfileUpdateError(false);
      }}
      onPasswordChange={setAccountPassword}
      onPasswordBlur={handlePasswordBlur}
      onTwoFactorCheckedChange={handleTwoFactorCheckedChange}
      onPasswordAdded={() => void fetchUser()}
      exportDataSuccess={exportDataSuccess}
      onExportDataSuccessClose={() => setExportDataSuccess(false)}
      exportDataError={exportDataError}
      onExportDataErrorClose={() => setExportDataError(false)}
      deleteMailSuccess={deleteMailSuccess}
      onDeleteMailSuccessClose={() => setDeleteMailSuccess(false)}
      deleteMailError={deleteMailError}
      onDeleteMailErrorClose={() => setDeleteMailError(false)}
      onExportDataClick={() => setActiveConfirmationModal("export_data")}
      onDeleteAccountClick={() =>
        setActiveConfirmationModal("delete_account_mail")
      }
    />
  );

  const enterprisePanel = (
    <EnterpriseSettingsPanel
      enterpriseSettings={enterprise.enterpriseSettings}
      enterpriseDraft={enterprise.enterpriseDraft}
      isEditingEnterprise={enterprise.isEditingEnterprise}
      onEditEnterprise={enterprise.handleEditEnterprise}
      onCancelEnterpriseEdit={enterprise.handleCancelEnterpriseEdit}
      onSaveEnterpriseEdit={onEnterpriseUpdateConfirm}
      enterpriseUpdateSuccess={enterpriseUpdateSuccess}
      onEnterpriseUpdateSuccessClose={() => setEnterpriseUpdateSuccess(false)}
      enterpriseUpdateError={enterpriseUpdateError}
      onEnterpriseUpdateErrorClose={() => setEnterpriseUpdateError(false)}
      onEnterpriseFieldChange={enterprise.handleEnterpriseFieldChange}
      onEnterpriseAddressFieldChange={
        enterprise.handleEnterpriseAddressFieldChange
      }
      shouldShowInseePrefill={enterprise.shouldShowInseePrefill}
      inseeLookupSiren={enterprise.inseeLookupSiren}
      onInseeLookupSirenChange={enterprise.handleInseeLookupSirenChange}
      canTriggerInseePrefill={enterprise.canTriggerInseePrefill}
      isPrefillingFromSiren={enterprise.isPrefillingFromSiren}
      inseePrefillError={enterprise.inseePrefillError}
      onPrefillFromSiren={enterprise.handlePrefillFromSiren}
    />
  );


  const subscriptionPanel = (
    <SubscriptionSettingsPanel
      shouldRefreshAfterPortal={isBackFromBillingPortal}
    />
  );

  return (
    <>
      <ParamLayout
        title="Mes Paramètres"
        tabs={SETTINGS_TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        panelMinHeight={panelMinHeight}
        accountMeasureRef={accountMeasureRef}
        enterpriseMeasureRef={enterpriseMeasureRef}
        subscriptionMeasureRef={subscriptionMeasureRef}
        accountMeasurePanel={accountPanel}
        enterpriseMeasurePanel={enterprisePanel}
        preferenceSubscriptionPanel={subscriptionPanel}
      >
        {activeTab === "account"
          ? accountPanel
          : activeTab === "enterprise"
            ? enterprisePanel
            : subscriptionPanel}
      </ParamLayout>

      {confirmationModalContent ? (
        <ConfirmationModal
          open
          title={confirmationModalContent.title}
          description={confirmationModalContent.description}
          confirmLabel={confirmationModalContent.confirmLabel}
          confirmClassName={confirmationModalContent.confirmClassName}
          onCancel={() => setActiveConfirmationModal(null)}
          onConfirm={confirmationModalContent.onConfirm}
        />
      ) : null}

      <TwoFactorCodeModal
        open={isTwoFactorCodeModalOpen}
        email={accountProfile.email}
        onCancel={() => {
          setIsTwoFactorCodeModalOpen(false);
          setIsTwoFactorEnabled(false);
        }}
        onVerify={handleTwoFactorCodeVerify}
        onResendMail={handleResendTwoFactorCode}
      />

      <CurrentPasswordModal
        open={reauthModalOpen}
        loading={reauthLoading}
        error={reauthError}
        onCancel={() => {
          setReauthModalOpen(false);
          setReauthError(null);
          reauthActionRef.current = null;
        }}
        onConfirm={handleReauthConfirm}
      />
    </>
  );
}
