import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { SETTINGS_TABS } from "../config/paramSettings";
import { useEnterpriseSettings } from "../hooks/useEnterpriseSettings";
import { AccountSettingsPanel } from "../components/ParamComponents/AccountSettingsPanel";
import { EnterpriseSettingsPanel } from "../components/ParamComponents/EnterpriseSettingsPanel";
import { ParamLayout } from "../components/ParamComponents/ParamLayout";
import { PreferenceSettingsPanel } from "../components/ParamComponents/PreferenceSettingsPanel";
import { SubscriptionSettingsPanel } from "../components/ParamComponents/SubscriptionSettingsPanel";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";
import { TwoFactorCodeModal } from "../components/ui/TwoFactorCodeModal";
import type {
  AccountConfirmationModal,
  AccountProfile,
  AccountProvider,
  ApiResponse,
  EnterpriseSettings,
  SettingsTab,
  UserPreferenceSettings,
} from "../types/paramSettings";
import {
  createEmptyEnterpriseSettings,
  getParamConfirmationModalContent,
  normalizeEnterpriseSettings,
} from "../utils/param/paramSettings";

import { useUserStore } from "../store/userStore";
import { fetchProxy } from "../utils/fetchProxy";


const EMPTY_ACCOUNT_PROFILE: AccountProfile = {
  prenom: "",
  nom: "",
  email: "",
  isVerified: false,
  cgu: false,
};

export function ParamCompte() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [panelMinHeight, setPanelMinHeight] = useState<number | null>(null);
  const [accountProfile, setAccountProfile] = useState<AccountProfile>(
    EMPTY_ACCOUNT_PROFILE,
  );
  const [accountPassword, setAccountPassword] = useState("");
  const [accountProvider, setAccountProvider] = useState<AccountProvider>(null);
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);
  const [isTwoFactorCodeModalOpen, setIsTwoFactorCodeModalOpen] =
    useState(false);
  const [activeConfirmationModal, setActiveConfirmationModal] =
    useState<AccountConfirmationModal | null>(null);
  const [isDyslexicModeEnabled, setIsDyslexicModeEnabled] = useState(false);
  const [profileUpdateSuccess, setProfileUpdateSuccess] = useState(false);
  const [profileUpdateError, setProfileUpdateError] = useState(false);
  const [enterpriseUpdateSuccess, setEnterpriseUpdateSuccess] = useState(false);
  const [enterpriseUpdateError, setEnterpriseUpdateError] = useState(false);
  const [enterpriseInitialSettings, setEnterpriseInitialSettings] =
    useState<EnterpriseSettings>(createEmptyEnterpriseSettings());

  const enterprise = useEnterpriseSettings(enterpriseInitialSettings);

  const accountMeasureRef = useRef<HTMLElement>(null);
  const enterpriseMeasureRef = useRef<HTMLElement>(null);
  const preferenceMeasureRef = useRef<HTMLElement>(null);
  const subscriptionMeasureRef = useRef<HTMLElement>(null);

  const { isConnected: userConnected, userData, fetchUser } = useUserStore();

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

  useEffect(() => {
    let isCancelled = false;

    const loadPreferences = async () => {
      try {
        const preferenceResponse = await fetchProxy("/api/user/preferences", {
          credentials: "include",
        });
        const preferencePayload = (await preferenceResponse
          .json()
          .catch(() => null)) as ApiResponse<UserPreferenceSettings> | null;

        if (
          preferenceResponse.ok &&
          preferencePayload?.success &&
          preferencePayload.data &&
          !isCancelled
        ) {
          setIsDyslexicModeEnabled(
            Boolean(preferencePayload.data.preferenceUI.dyslexicMode),
          );
        }
      } catch (error) {
        console.error(
          "Impossible de charger les préférences utilisateur.",
          error,
        );
      }
    };

    void loadPreferences();

    return () => {
      isCancelled = true;
    };
  }, []);

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

  const persistAccountSettings = async ({
    includePassword = false,
  }: {
    includePassword?: boolean;
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
      }),
    });
    const payload = (await response.json().catch(() => null)) as ApiResponse<{
      profile: AccountProfile;
      provider: AccountProvider;
    }> | null;

    if (!response.ok || !payload?.success || !payload.data) {
      setProfileUpdateError(true);
      throw new Error(
        payload?.message ||
          "Impossible de mettre a jour les informations du compte.",
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
    } else if (!checked) {
      try {
        const response = await fetchProxy("/api/user", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ twoFactorEnabled: false }),
        });
        const confirmResponse = await response.json();
        if (response.ok || confirmResponse.success) {
          setIsTwoFactorEnabled(false);
        }
      } catch (error) {
        console.log("TWO FACTOR DISABLED ERROR :", error);
      }
    }
  };

  const handlePreferenceCheckedChange = (checked: boolean) => {
    const previousValue = isDyslexicModeEnabled;
    setIsDyslexicModeEnabled(checked);

    void fetchProxy("/api/user/preferences", {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        preferenceUI: {
          dyslexicMode: checked,
        },
      }),
    })
      .then(async (response) => {
        const payload = (await response
          .json()
          .catch(() => null)) as ApiResponse<{
          preferenceUI: {
            dyslexicMode: boolean;
          };
        }> | null;

        if (!response.ok || !payload?.success || !payload.data) {
          throw new Error(
            payload?.message ||
              "Impossible de mettre a jour les preferences utilisateur.",
          );
        }

        setIsDyslexicModeEnabled(
          Boolean(payload.data.preferenceUI.dyslexicMode),
        );
      })
      .catch((error) => {
        console.error(error);
        setIsDyslexicModeEnabled(previousValue);
      });
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
    }

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
          setProfileUpdateError(true);
          console.error(error);
        });
    },

    onExportDataConfirm: () => {
      void fetchProxy("/api/user/export-data", {
        method: "POST",
        credentials: "include",
      }).catch((error) => {
        console.error(error);
      });
    },

    onDeleteAccountConfirm: () => {
      void fetchProxy("/api/user/account", {
        method: "DELETE",
        credentials: "include",
      }).catch((error) => {
        console.error(error);
      });
    },
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
      provider={accountProvider}
      isTwoFactorEnabled={isTwoFactorEnabled}
      onProfileFieldChange={handleProfileFieldChange}
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
      onExportDataClick={() => setActiveConfirmationModal("export_data")}
      onDeleteAccountClick={() => setActiveConfirmationModal("delete_account")}
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

  const preferencePanel = (
    <PreferenceSettingsPanel
      isDyslexicModeEnabled={isDyslexicModeEnabled}
      onDyslexicModeCheckedChange={handlePreferenceCheckedChange}
    />
  );

  const subscriptionPanel = <SubscriptionSettingsPanel />;

  return !userConnected ? (
    <Navigate to="/inscription" />
  ) : (
    <>
      <ParamLayout
        title="Mes Paramètres"
        tabs={SETTINGS_TABS}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        panelMinHeight={panelMinHeight}
        accountMeasureRef={accountMeasureRef}
        enterpriseMeasureRef={enterpriseMeasureRef}
        preferenceMeasureRef={preferenceMeasureRef}
        subscriptionMeasureRef={subscriptionMeasureRef}
        accountMeasurePanel={accountPanel}
        enterpriseMeasurePanel={enterprisePanel}
        preferenceMeasurePanel={preferencePanel}
        preferenceSubscriptionPanel={subscriptionPanel}
      >
        {activeTab === "account"
          ? accountPanel
          : activeTab === "enterprise"
            ? enterprisePanel
            : activeTab === "preferences"
              ? preferencePanel
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
      />
    </>
  );
}
