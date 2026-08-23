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
import { EyeOffIcon, EyeIcon } from "lucide-react";
import { AlertBanner } from "../common/AlertBanner";
import { useState, useRef } from "react";

import { fetchProxy } from "../../utils/fetchProxy";

type PasswordDialogMode = "add" | null;

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
    <div className="flex flex-1 flex-col space-y-8">
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

      {/* Section 1 : Compte et connexion */}
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-bold text-gray-900">
            Compte et connexion
          </h2>
          <span className="text-xs text-gray-400">
            Informations personnelles du compte
          </span>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <Field>
            <FieldLabel htmlFor="prenom" className="text-xs text-gray-500 font-normal">
              Prénom
            </FieldLabel>
            <Input
              id="prenom"
              value={profile.prenom}
              onChange={(e) => onProfileFieldChange("prenom", e.target.value)}
              className="bg-gray-50/50 border-gray-200"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="nom" className="text-xs text-gray-500 font-normal">
              Nom
            </FieldLabel>
            <Input
              id="nom"
              value={profile.nom}
              onChange={(e) => onProfileFieldChange("nom", e.target.value)}
              className="bg-gray-50/50 border-gray-200"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="email" className="text-xs text-gray-500 font-normal">
              E-mail
            </FieldLabel>
            <Input
              id="email"
              type="email"
              value={profile.email}
              onChange={(e) => onProfileFieldChange("email", e.target.value)}
              className="bg-gray-50/50 border-gray-200"
            />
          </Field>

          <div className="pt-2">
            <Button
              type="button"
              onClick={onUpdateProfileClick}
              className="bg-[#1e3a5f] hover:bg-[#152a45] text-white font-medium px-5 py-2 rounded-lg text-sm"
            >
              Mettre à jour mon profil
            </Button>
          </div>
        </div>
      </div>

      {/* Section 2 : Sécurité */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-gray-900">Sécurité</h2>

        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
          <div className="rounded-lg border border-gray-200 p-4">
            <SettingsToggleRow
              label="Authentification à deux facteurs"
              checked={isTwoFactorEnabled}
              onCheckedChange={onTwoFactorCheckedChange}
            />
          </div>

          {/* Panneau Google */}
          {shouldShowGooglePanel && (
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-col gap-1 max-w-xl">
                  <p className="text-sm font-semibold text-gray-900">
                    Connexion Google associée
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {hasAddedPassword
                      ? "Vous pouvez vous connecter à Lumen Juris via Google ou avec votre mot de passe Lumen Juris."
                      : "Votre compte LumenJuris est lié à votre compte Google. Vous pouvez également créer un mot de passe propre à LumenJuris — Il ne modifie pas votre mot de passe Google."}
                  </p>
                </div>
                {!hasAddedPassword && (
                  <Button
                    type="button"
                    className="bg-[#1e3a5f] hover:bg-[#152a45] text-white text-xs font-medium px-4 py-2.5 rounded-lg shrink-0"
                    onClick={() => setPasswordDialogMode("add")}
                  >
                    Créer un mot de passe LumenJuris
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Formulaire direct de changement de mot de passe */}
          <form
            onSubmit={(e) => handleSubmitPassword(e, false)}
            className="space-y-4 pt-2"
          >
            {submitError && (
              <AlertBanner
                title="Mot de passe invalide !"
                variant="error"
                detail="Les deux mots de passe doivent être identiques !"
                onClose={() => setSubmitError(false)}
              />
            )}

            <Field>
              <FieldLabel
                htmlFor="password"
                className="text-xs text-gray-500 font-normal"
              >
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
                  className="bg-gray-50/50 border-gray-200"
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
                className="text-xs text-gray-500 font-normal"
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
                  className="bg-gray-50/50 border-gray-200"
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

            <div className="pt-2">
              <Button
                type="submit"
                className="bg-[#1e3a5f] hover:bg-[#152a45] text-white font-medium px-5 py-2 rounded-lg text-sm"
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
        </div>
      </div>

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

      {/* Section3 : Préférences */}
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-bold text-gray-900">
            Préférences
          </h2>
          <span className="text-xs text-gray-400">
            Préférences simples du compte utilisateur
          </span>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="rounded-lg border border-gray-200 p-4">
            <SettingsToggleRow
              label="Mode dyslexique"
              checked={isDyslexicModeEnabled}
              onCheckedChange={onDyslexicModeCheckedChange}
            />
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <SettingsToggleRow
              label="Notifications par e-mail"
              checked={isEmailNotificationsEnabled}
              onCheckedChange={onEmailNotificationsCheckedChange}
            />
          </div>
        </div>
      </div>

      {/* PIED DE PAGE : Actions d'exportation et de suppression */}
      <div className="space-y-2">
        <h2 className="text-base font-bold text-gray-900">
          RGPD
        </h2>
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="mt-auto flex flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              className="bg-blue-primary text-white hover:bg-opacity-80"
              onClick={onExportDataClick}
            >
              Exporter mes données
            </Button>
            <Button
              type="button"
              onClick={onDeleteAccountClick}
              className="bg-red-500 text-white hover:bg-red-700"
            >
              Supprimer mon compte
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
