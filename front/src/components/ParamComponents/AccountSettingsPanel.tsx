import { FcGoogle } from "react-icons/fc";
import type {
  AccountProfile,
  AccountProvider,
} from "../../types/paramSettings";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/InputGroup";
import { SettingsToggleRow } from "../ui/SettingsToggleRow";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/Dialog";
import { Field, FieldLabel, FieldError } from "../ui/Field";
import {
  Database,
  Download,
  EyeIcon,
  EyeOffIcon,
  KeyRound,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from "lucide-react";
import { AlertBanner } from "../common/AlertBanner";
import { useState, useRef } from "react";
import { SettingsSection } from "./SettingsSection";
import { CurrentPasswordModal } from "./CurrentPasswordModal";

import { fetchProxy } from "../../utils/fetchProxy";

type PasswordDialogMode = "add" | null;

// Classes partagées pour garder un style identique sur tous les champs
const FIELD_LABEL_CLASS = "text-xs font-medium text-gray-600";
const INPUT_CLASS = "bg-gray-50/50 border-gray-200";
const PRIMARY_BUTTON_CLASS =
  "bg-blue-primary hover:bg-blue-primary/90 text-white font-medium px-5 rounded-lg text-sm";

type AccountSettingsPanelProps = {
  profile: AccountProfile;
  password: string;
  setPassword: React.Dispatch<React.SetStateAction<string>>;
  provider: AccountProvider;
  isTwoFactorEnabled: boolean;
  isDyslexicModeEnabled: boolean;
  onDyslexicModeCheckedChange: (checked: boolean) => void;
  isEmailNotificationsEnabled: boolean;
  onEmailNotificationsCheckedChange: (checked: boolean) => void;
  onProfileFieldChange: (
    field: "prenom" | "nom" | "email",
    value: string,
  ) => void;
  onUpdateProfileClick: () => void;
  profileUpdateSuccess: boolean;
  onProfileUpdateSuccessClose: () => void;
  profileUpdateError: boolean;
  onProfileUpdateErrorClose: () => void;
  exportDataSuccess: boolean;
  onExportDataSuccessClose: () => void;
  exportDataError: boolean;
  onExportDataErrorClose: () => void;
  deleteMailSuccess: boolean;
  onDeleteMailSuccessClose: () => void;
  deleteMailError: boolean;
  onDeleteMailErrorClose: () => void;
  onPasswordChange: (value: string) => void;
  onPasswordBlur: () => void;
  onCancelProfileEdit: () => void;
  onTwoFactorCheckedChange: (checked: boolean) => void;
  onPasswordAdded: () => void;
  onExportDataClick: () => void;
  onDeleteAccountClick: () => void;
  confirmPassword: string;
  setConfirmPassword: React.Dispatch<React.SetStateAction<string>>;
};

export function AccountSettingsPanel({
  profile,
  password,
  setPassword,
  provider,
  isTwoFactorEnabled,
  isDyslexicModeEnabled,
  onDyslexicModeCheckedChange,
  isEmailNotificationsEnabled,
  onEmailNotificationsCheckedChange,
  onProfileFieldChange,
  onUpdateProfileClick,
  profileUpdateSuccess,
  onProfileUpdateSuccessClose,
  profileUpdateError,
  onProfileUpdateErrorClose,
  exportDataSuccess,
  onExportDataSuccessClose,
  exportDataError,
  onExportDataErrorClose,
  deleteMailSuccess,
  onDeleteMailSuccessClose,
  deleteMailError,
  onDeleteMailErrorClose,
  onTwoFactorCheckedChange,
  onPasswordAdded,
  onExportDataClick,
  onDeleteAccountClick,
}: AccountSettingsPanelProps) {
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [serverError, setServerError] = useState(false);
  const [serverErrorMessage, setServerErrorMessage] = useState("");
  const [passwordDialogMode, setPasswordDialogMode] =
    useState<PasswordDialogMode>(null);

  // Modale de ré-authentification : ouverte après le clic sur « Enregistrer le
  // mot de passe », elle demande le mot de passe actuel avant d'envoyer la
  // requête qui change réellement le mot de passe.
  const [currentPasswordModalOpen, setCurrentPasswordModalOpen] =
    useState(false);
  const [currentPasswordError, setCurrentPasswordError] = useState<
    string | null
  >(null);

  const googleConnectionPanelMode =
    provider?.provider === "GOOGLE"
      ? (provider.googleConnectionPanelMode ?? "google_only")
      : "hidden";
  const shouldShowGooglePanel = googleConnectionPanelMode !== "hidden";
  const hasAddedPassword = googleConnectionPanelMode === "google_with_password";

  const passwordErrorTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const resetPasswordFields = () => {
    setPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setConfirmPasswordError("");
    setSubmitError(false);
    setSubmitLoading(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const resetPasswordDialog = () => {
    resetPasswordFields();
    setSubmitSuccess(false);
    setServerError(false);
    setServerErrorMessage("");
    setPasswordDialogMode(null);
  };

  const handleSubmitPassword = async (
    event: React.FormEvent<HTMLFormElement>,
    isModal = false,
  ) => {
    event.preventDefault();
    if (confirmPassword !== password) {
      setSubmitError(true);
      return;
    }
    setSubmitLoading(true);
    try {
      const response = await fetchProxy("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "include",
      });
      const passwordResponse = await response.json();
      if (!response.ok || !passwordResponse.success) {
        setServerError(true);
        setServerErrorMessage(passwordResponse.message);
        throw new Error(`BackNode Auth Error : ${passwordResponse.status}`);
      }
      setSubmitSuccess(true);
      setSuccessMessage(
        isModal
          ? "Votre mot de passe Lumen Juris a bien été créé."
          : "Votre mot de passe a bien été modifié.",
      );
      if (isModal) {
        onPasswordAdded();
        setPasswordDialogMode(null);
      } else {
        resetPasswordFields();
      }
    } catch (error) {
      setServerError(true);
      setServerErrorMessage(
        "Une erreur s'est produite, nous n'avons pas pu enregistrer votre mot de passe...",
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  // Étape 1 du changement de mot de passe : on valide que les deux nouveaux
  // mots de passe correspondent, puis on ouvre la modale de ré-authentification.
  // La requête n'est PAS envoyée ici : elle attend le mot de passe actuel.
  const handleRequestPasswordChange = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (confirmPassword !== password) {
      setSubmitError(true);
      return;
    }
    setCurrentPasswordError(null);
    setCurrentPasswordModalOpen(true);
  };

  // Étape 2 : le mot de passe actuel est confirmé, on envoie le changement.
  const handleConfirmPasswordChange = async (currentPassword: string) => {
    setSubmitLoading(true);
    setCurrentPasswordError(null);
    try {
      const response = await fetchProxy("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, currentPassword }),
        credentials: "include",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        // Mot de passe actuel incorrect : on garde la modale ouverte avec le
        // message, l'utilisateur corrige sans tout ressaisir.
        if (payload?.reason === "wrong-current-password") {
          setCurrentPasswordError(
            payload?.message ?? "Le mot de passe actuel est incorrect.",
          );
          setSubmitLoading(false);
          return;
        }
        setServerError(true);
        setServerErrorMessage(
          payload?.message ??
            "Une erreur s'est produite, nous n'avons pas pu enregistrer votre mot de passe...",
        );
        setSubmitLoading(false);
        return;
      }

      setCurrentPasswordModalOpen(false);
      setSubmitSuccess(true);
      setSuccessMessage("Votre mot de passe a bien été modifié.");
      resetPasswordFields();
    } catch (error) {
      setServerError(true);
      setServerErrorMessage(
        "Une erreur s'est produite, nous n'avons pas pu enregistrer votre mot de passe...",
      );
      setSubmitLoading(false);
      console.error(error);
    }
  };

  const handleChangePassword = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setPassword(value);
    setPasswordError("");
    if (passwordErrorTimeout.current)
      clearTimeout(passwordErrorTimeout.current);
    passwordErrorTimeout.current = setTimeout(() => {
      if (value.length > 0 && value.length < 8) {
        setPasswordError("Le mot de passe est trop court");
      } else if (value.length >= 8 && !/[A-Z]/.test(value)) {
        setPasswordError("Le mot de passe doit contenir au moins 1 majuscule");
      } else if (value.length >= 8 && !/[0-9]/.test(value)) {
        setPasswordError("Le mot de passe doit contenir au moins 1 chiffre");
      } else if (value.length >= 8 && !/[^a-zA-Z0-9]/.test(value)) {
        setPasswordError(
          "Le mot de passe doit contenir au moins 1 caractère spécial",
        );
      }
    }, 500);
  };

  const handleChangeConfirmPassword = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value;
    setConfirmPassword(value);
    if (value.length >= 8 && value !== password) {
      setConfirmPasswordError("Les mots de passe doivent être identiques !");
    } else if (value.length >= 8 && value === password) {
      setConfirmPasswordError("");
    }
  };

  return (
    <div className="flex flex-1 flex-col space-y-6">
      {/* Alertes système */}
      {profileUpdateSuccess && (
        <AlertBanner
          title="Profil mis à jour !"
          variant="success"
          detail="Vos informations personnelles ont bien été enregistrées."
          duration={7000}
          onClose={onProfileUpdateSuccessClose}
        />
      )}
      {profileUpdateError && (
        <AlertBanner
          title="Échec de la mise à jour !"
          variant="error"
          detail="Vos informations personnelles n'ont pu être mises à jour. Veuillez réessayer."
          duration={7000}
          onClose={onProfileUpdateErrorClose}
        />
      )}
      {exportDataSuccess && (
        <AlertBanner
          title="Export demandé avec succès !"
          variant="success"
          detail="Un e-mail contenant toutes les informations liées à votre compte vous a été envoyé."
          duration={7000}
          onClose={onExportDataSuccessClose}
        />
      )}
      {exportDataError && (
        <AlertBanner
          title="Échec de l'exportation !"
          variant="error"
          detail="Une erreur est survenue lors de la récupération de vos données. Veuillez réessayer."
          duration={7000}
          onClose={onExportDataErrorClose}
        />
      )}
      {deleteMailSuccess && (
        <AlertBanner
          title="Suppression de compte demandée avec succès !"
          variant="success"
          detail="Un e-mail contenant le lien pour supprimer votre compte vous a été envoyé."
          duration={7000}
          onClose={onDeleteMailSuccessClose}
        />
      )}
      {deleteMailError && (
        <AlertBanner
          title="Échec de la demande de suppression de compte !"
          variant="error"
          detail="Une erreur est survenue lors de l'envoi du lien pour supprimer votre compte. Veuillez réessayer."
          duration={7000}
          onClose={onDeleteMailErrorClose}
        />
      )}
      {submitSuccess && (
        <AlertBanner
          title="Modification réussie !"
          variant="success"
          detail={successMessage}
          duration={6000}
          onClose={() => setSubmitSuccess(false)}
        />
      )}
      {serverError && (
        <AlertBanner
          title="Erreur serveur"
          variant="error"
          detail={serverErrorMessage}
          onClose={() => setServerError(false)}
        />
      )}

      {/* Section 1 : Informations personnelles */}
      <SettingsSection
        icon={<UserRound className="h-5 w-5" />}
        title="Informations personnelles"
        description="Votre identité et l'adresse e-mail associée à votre compte."
      >
        <div className="space-y-4 px-5 py-5 sm:px-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="prenom" className={FIELD_LABEL_CLASS}>
                Prénom
              </FieldLabel>
              <Input
                id="prenom"
                value={profile.prenom}
                onChange={(e) => onProfileFieldChange("prenom", e.target.value)}
                className={INPUT_CLASS}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="nom" className={FIELD_LABEL_CLASS}>
                Nom
              </FieldLabel>
              <Input
                id="nom"
                value={profile.nom}
                onChange={(e) => onProfileFieldChange("nom", e.target.value)}
                className={INPUT_CLASS}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="email" className={FIELD_LABEL_CLASS}>
              E-mail
            </FieldLabel>
            <Input
              id="email"
              type="email"
              value={profile.email}
              onChange={(e) => onProfileFieldChange("email", e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        <div className="flex justify-end px-5 py-4 sm:px-6">
          <Button
            type="button"
            onClick={onUpdateProfileClick}
            className={`${PRIMARY_BUTTON_CLASS} w-full lg:w-auto`}
          >
            Mettre à jour mon profil
          </Button>
        </div>
      </SettingsSection>

      {/* Section 2 : Sécurité */}
      <SettingsSection
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Sécurité"
        description="Protégez l'accès à votre compte."
      >
        {/* Double authentification */}
        <div className="px-5 py-5 sm:px-6">
          <SettingsToggleRow
            label="Authentification à deux facteurs"
            description="Un code de vérification vous est envoyé par e-mail à chaque connexion."
            checked={isTwoFactorEnabled}
            onCheckedChange={onTwoFactorCheckedChange}
          />
        </div>

        {/* Panneau Google */}
        {shouldShowGooglePanel && (
          <div className="px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white">
                  <FcGoogle className="h-5 w-5" />
                </span>
                <div className="flex max-w-xl flex-col gap-1">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Connexion Google associée
                  </h3>
                  <p className="text-xs leading-relaxed text-gray-500">
                    {hasAddedPassword
                      ? "Vous pouvez vous connecter à Lumen Juris via Google ou avec votre mot de passe Lumen Juris."
                      : "Votre compte Lumen Juris est lié à votre compte Google. Vous pouvez également créer un mot de passe propre à Lumen Juris — il ne modifie pas votre mot de passe Google."}
                  </p>
                </div>
              </div>
              {!hasAddedPassword && (
                <Button
                  type="button"
                  className={`${PRIMARY_BUTTON_CLASS} w-full lg:w-auto`}
                  onClick={() => setPasswordDialogMode("add")}
                >
                  Créer un mot de passe Lumen Juris
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Formulaire direct de changement de mot de passe : le clic ouvre la
            modale de ré-authentification, l'envoi se fait après confirmation. */}
        <form
          onSubmit={handleRequestPasswordChange}
          className="space-y-4 px-5 py-5 sm:px-6"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
              <KeyRound className="h-5 w-5" />
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-gray-900">
                Modifier votre mot de passe
              </h3>
              <p className="text-xs leading-relaxed text-gray-500">
                8 caractères minimum, dont une majuscule, un chiffre et un
                caractère spécial.
              </p>
            </div>
          </div>

          {submitError && (
            <AlertBanner
              title="Mot de passe invalide !"
              variant="error"
              detail="Les deux mots de passe doivent être identiques !"
              onClose={() => setSubmitError(false)}
            />
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="password" className={FIELD_LABEL_CLASS}>
                Nouveau mot de passe
              </FieldLabel>
              <InputGroup
                className={
                  passwordError
                    ? "border-2 border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-destructive"
                    : undefined
                }
              >
                <InputGroupInput
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={handleChangePassword}
                  className={INPUT_CLASS}
                />
                <InputGroupAddon
                  align="inline-end"
                  onClick={() => setShowPassword(!showPassword)}
                  className="hover:cursor-pointer"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </InputGroupAddon>
              </InputGroup>
              <FieldError
                errors={
                  passwordError ? [{ message: passwordError }] : undefined
                }
              />
            </Field>

            <Field>
              <FieldLabel
                htmlFor="confirmpassword"
                className={FIELD_LABEL_CLASS}
              >
                Confirmer le mot de passe
              </FieldLabel>
              <InputGroup
                className={
                  confirmPasswordError
                    ? "border-2 border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-destructive"
                    : undefined
                }
              >
                <InputGroupInput
                  id="confirmpassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={handleChangeConfirmPassword}
                  className={INPUT_CLASS}
                />
                <InputGroupAddon
                  align="inline-end"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="hover:cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </InputGroupAddon>
              </InputGroup>
              <FieldError
                errors={
                  confirmPasswordError
                    ? [{ message: confirmPasswordError }]
                    : undefined
                }
              />
            </Field>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              className={`${PRIMARY_BUTTON_CLASS} w-full lg:w-auto`}
              disabled={
                !password ||
                confirmPassword.length < 8 ||
                passwordError.length > 0 ||
                confirmPasswordError.length > 0 ||
                submitLoading
              }
            >
              Enregistrer le mot de passe
            </Button>
          </div>
        </form>
      </SettingsSection>

      {/* Modal Dialog spécifique à la création de mot de passe Google */}
      <Dialog
        open={passwordDialogMode !== null}
        onOpenChange={(open) => {
          if (!open) resetPasswordDialog();
        }}
      >
        <DialogContent className="sm:max-w-sm bg-white">
          <form
            onSubmit={(e) => handleSubmitPassword(e, true)}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>Définir un mot de passe Lumen Juris</DialogTitle>
              <DialogDescription>
                Créez un mot de passe pour vous connecter à Lumen Juris directement avec votre adresse e-mail Google, sans passer par la connexion Google.
              </DialogDescription>
            </DialogHeader>
            <Field className="max-w-sm">
              <FieldLabel
                htmlFor="dialog-password"
                className="after:text-red-500 after:content-['*']"
              >
                Nouveau mot de passe
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="dialog-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Choisissez un mot de passe"
                  value={password}
                  onChange={handleChangePassword}
                />
                <InputGroupAddon
                  align="inline-end"
                  onClick={() => setShowPassword(!showPassword)}
                  className="hover:cursor-pointer"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </InputGroupAddon>
              </InputGroup>
              <FieldError
                errors={
                  passwordError ? [{ message: passwordError }] : undefined
                }
              />
            </Field>
            <Field className="max-w-sm">
              <FieldLabel
                htmlFor="dialog-confirmpassword"
                className="after:text-red-500 after:content-['*']"
              >
                Confirmer le mot de passe
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="dialog-confirmpassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirmez votre mot de passe"
                  value={confirmPassword}
                  onChange={handleChangeConfirmPassword}
                />
                <InputGroupAddon
                  align="inline-end"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="hover:cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </InputGroupAddon>
              </InputGroup>
              <FieldError
                errors={
                  confirmPasswordError
                    ? [{ message: confirmPasswordError }]
                    : undefined
                }
              />
            </Field>
            <DialogFooter>
              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetPasswordDialog}
                  >
                    Annuler
                  </Button>
                }
              />
              <Button
                type="submit"
                className="bg-[#1e3a5f] hover:bg-[#152a45] text-white"
                disabled={
                  confirmPassword.length < 8 ||
                  passwordError.length > 0 ||
                  confirmPasswordError.length > 0 ||
                  submitLoading
                }
              >
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CurrentPasswordModal
        open={currentPasswordModalOpen}
        loading={submitLoading}
        error={currentPasswordError}
        onCancel={() => {
          setCurrentPasswordModalOpen(false);
          setCurrentPasswordError(null);
        }}
        onConfirm={handleConfirmPasswordChange}
      />

      {/* Section 3 : Préférences */}
      <SettingsSection
        icon={<SlidersHorizontal className="h-5 w-5" />}
        title="Préférences"
        description="Adaptez l'affichage et les communications à vos besoins."
      >
        <div className="space-y-3 px-5 py-5 sm:px-6">
          <SettingsToggleRow
            label="Mode dyslexique"
            description="Utilise une police et un espacement adaptés pour faciliter la lecture."
            checked={isDyslexicModeEnabled}
            onCheckedChange={onDyslexicModeCheckedChange}
          />
          <SettingsToggleRow
            label="Notifications par e-mail"
            description="Recevez par e-mail les informations importantes liées à votre compte."
            checked={isEmailNotificationsEnabled}
            onCheckedChange={onEmailNotificationsCheckedChange}
          />
        </div>
      </SettingsSection>

      {/* Section 4 : Données personnelles (RGPD) */}
      <SettingsSection
        icon={<Database className="h-5 w-5" />}
        title="Données personnelles (RGPD)"
        description="Gérez vos données conformément au Règlement général sur la protection des données."
      >
        {/* Export des données */}
        <div className="flex flex-col gap-4 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-gray-900">
              Exporter mes données
            </h3>
            <p className="text-xs leading-relaxed text-gray-500">
              Recevez par e-mail une copie de toutes les informations liées à
              votre compte.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 border-gray-300 px-5 text-gray-900 lg:w-auto"
            onClick={onExportDataClick}
          >
            <Download className="h-4 w-4" />
            Exporter mes données
          </Button>
        </div>

        {/* Zone de danger : suppression du compte */}
        <div className="px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 rounded-lg border border-red-200 bg-red-50/60 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-semibold text-red-700">
                Supprimer mon compte
              </h3>
              <p className="text-xs leading-relaxed text-red-600/90">
                Action définitive : un lien de confirmation vous sera envoyé
                par e-mail avant toute suppression.
              </p>
            </div>
            <Button
              type="button"
              onClick={onDeleteAccountClick}
              className="w-full gap-2 bg-red-600 px-5 text-white hover:bg-red-700 lg:w-auto"
            >
              <Trash2 className="h-4 w-4" />
              Supprimer mon compte
            </Button>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
