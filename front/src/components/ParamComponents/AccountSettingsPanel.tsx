import { FcGoogle } from "react-icons/fc";
import type {
  AccountProfile,
  AccountProvider,
} from "../../types/paramSettings";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/InputGroup";
import { SettingsDisplayField, SettingsField } from "../ui/SettingsField";
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
import { useState, useRef, useEffect } from "react";

import { fetchProxy } from "../../utils/fetchProxy";


type PasswordDialogMode = "change" | "add" | null;

type AccountSettingsPanelProps = {
  profile: AccountProfile;
  password: string;
  setPassword: React.Dispatch<React.SetStateAction<string>>;
  provider: AccountProvider;
  isTwoFactorEnabled: boolean;
  onProfileFieldChange: (
    field: "prenom" | "nom" | "email",
    value: string,
  ) => void;
  onUpdateProfileClick: () => void;
  profileUpdateSuccess: boolean;
  onProfileUpdateSuccessClose: () => void;
  profileUpdateError: boolean;
  onProfileUpdateErrorClose: () => void;
  onPasswordChange: (value: string) => void;
  onPasswordBlur: () => void;
  onCancelProfileEdit: () => void;
  onTwoFactorCheckedChange: (checked: boolean) => void;
  onPasswordAdded: () => void;
  onExportDataClick: () => void;
  onDeleteAccountClick: () => void;
};

export function AccountSettingsPanel({
  profile,
  password,
  setPassword,
  provider,
  isTwoFactorEnabled,
  onProfileFieldChange,
  onUpdateProfileClick,
  profileUpdateSuccess,
  onProfileUpdateSuccessClose,
  profileUpdateError,
  onProfileUpdateErrorClose,
  onCancelProfileEdit,
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
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  useEffect(() => {
    if (profileUpdateSuccess) setIsEditingProfile(false);
  }, [profileUpdateSuccess]);

  const googleConnectionPanelMode =
    provider?.provider === "GOOGLE"
      ? (provider.googleConnectionPanelMode ?? "google_only")
      : "hidden";
  const shouldShowGooglePanel = googleConnectionPanelMode !== "hidden";
  const hasAddedPassword = googleConnectionPanelMode === "google_with_password";

  const passwordErrorTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const resetPasswordDialog = () => {
    setPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setConfirmPasswordError("");
    setSubmitError(false);
    setSubmitLoading(false);
    setSubmitSuccess(false);
    setServerError(false);
    setServerErrorMessage("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPasswordDialogMode(null);
  };

  const handleSubmitNewPassword = async (
    event: React.FormEvent<HTMLFormElement>,
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
        passwordDialogMode === "change"
          ? "Votre mot de passe a bien été modifié."
          : "Votre mot de passe JustiClause a bien été créé.",
      );
      if (passwordDialogMode === "add") {
        onPasswordAdded();
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

  const passwordDialogTitle =
    passwordDialogMode === "change"
      ? "Changer mon mot de passe"
      : "Définir un mot de passe LumenJuris";

  const passwordDialogDescription =
    passwordDialogMode === "change"
      ? "Saisissez votre nouveau mot de passe de connexion à LumenJuris."
      : "Créez un mot de passe pour vous connecter à LumenJuris directement avec votre adresse email Google, sans passer par la connexion Google.";

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
            title="Echec de la mise à jour !"
            variant="error"
            detail="Vos informations personnelles n'ont pu être mises à jour. Veuillez réessayer."
            duration={7000}
            onClose={onProfileUpdateErrorClose}
          />
        )}

        {isEditingProfile ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SettingsField label="Prénom">
                <Input
                  value={profile.prenom}
                  onChange={(event) =>
                    onProfileFieldChange("prenom", event.target.value)
                  }
                />
              </SettingsField>
              <SettingsField label="Nom">
                <Input
                  value={profile.nom}
                  onChange={(event) =>
                    onProfileFieldChange("nom", event.target.value)
                  }
                />
              </SettingsField>
              <SettingsField label="Email">
                <Input
                  type="email"
                  value={profile.email}
                  onChange={(event) =>
                    onProfileFieldChange("email", event.target.value)
                  }
                />
              </SettingsField>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onCancelProfileEdit();
                  setIsEditingProfile(false);
                }}
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={onUpdateProfileClick}
                className="bg-lumenjuris text-white hover:bg-lumenjuris/90"
              >
                Enregistrer
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SettingsDisplayField label="Prénom" value={profile.prenom} />
              <SettingsDisplayField label="Nom" value={profile.nom} />
              <SettingsDisplayField label="Email" value={profile.email} />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="hover:bg-gray-100"
                onClick={() => setPasswordDialogMode("change")}
              >
                Changer mon mot de passe
              </Button>
              <Button
                type="button"
                onClick={() => setIsEditingProfile(true)}
                className="bg-lumenjuris text-white hover:bg-lumenjuris/90"
              >
                Mettre à jour mon profil
              </Button>
            </div>
          </>
        )}

        {/* Dialog partagé — "Changer" ou "Ajouter" un mot de passe */}
        <Dialog
          open={passwordDialogMode !== null}
          onOpenChange={(open) => {
            if (!open) resetPasswordDialog();
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <form
              onSubmit={handleSubmitNewPassword}
              className="flex flex-col gap-4"
            >
              <DialogHeader>
                <DialogTitle>{passwordDialogTitle}</DialogTitle>
                <DialogDescription>
                  {passwordDialogDescription}
                </DialogDescription>
                {submitError && (
                  <AlertBanner
                    title="Mot de passe invalide !"
                    variant="error"
                    detail="Les deux mots de passe doivent être identiques !"
                    onClose={() => setSubmitError(false)}
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
                {submitSuccess && (
                  <AlertBanner
                    title="Modification réussie !"
                    variant="success"
                    detail={successMessage}
                    duration={6000}
                    onClose={() => setSubmitSuccess(false)}
                  />
                )}
              </DialogHeader>
              <Field className="max-w-sm">
                <FieldLabel
                  htmlFor="password"
                  className="after:text-red-500 after:content-['*']"
                >
                  Nouveau mot de passe
                </FieldLabel>
                <InputGroup
                  className={
                    passwordError
                      ? "border-2 border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-2 has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot=input-group-control]:focus-visible]:ring-destructive"
                      : undefined
                  }
                >
                  <InputGroupInput
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Choisissez un mot de passe"
                    value={password}
                    onChange={handleChangePassword}
                    className={passwordError ? "text-destructive" : undefined}
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
                  htmlFor="confirmpassword"
                  className="after:text-red-500 after:content-['*']"
                >
                  Confirmer le mot de passe
                </FieldLabel>
                <InputGroup
                  className={
                    confirmPasswordError
                      ? "border-2 border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-2 has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot=input-group-control]:focus-visible]:ring-destructive"
                      : undefined
                  }
                >
                  <InputGroupInput
                    id="confirmpassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirmez votre mot de passe"
                    value={confirmPassword}
                    onChange={handleChangeConfirmPassword}
                    className={
                      confirmPasswordError ? "text-destructive" : undefined
                    }
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
                  className="text-white"
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

        <SettingsToggleRow
          label="Authentification à deux facteurs"
          checked={isTwoFactorEnabled}
          onCheckedChange={onTwoFactorCheckedChange}
        />

        {shouldShowGooglePanel && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
            <div className="flex items-start gap-3">
              <FcGoogle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-gray-900">
                  Connexion Google associée
                </p>
                <p className="text-sm text-gray-500">
                  {hasAddedPassword
                    ? "Vous pouvez vous connecter à LumenJuris via Google ou avec votre mot de passe LumenJuris."
                    : "Votre compte LumenJuris est lié à votre compte Google. Vous pouvez également créer un mot de passe propre à LumenJuris — il ne modifie pas votre mot de passe Google."}
                </p>
                {!hasAddedPassword && (
                  <Button
                    className="max-w-64 text-gray-400 bg-lumenjuris-sidebar mt-2 hover:bg-lumenjuris-sidebar/80 hover:text-white"
                    onClick={() => setPasswordDialogMode("add")}
                  >
                    Créer un mot de passe LumenJuris
                  </Button>
                  // <button
                  //   type="button"
                  //   onClick={() => setPasswordDialogMode("add")}
                  //   className="mt-1 w-fit text-xs font-medium text-lumenjuris underline underline-offset-2 transition-colors hover:text-lumenjuris/80"
                  // >
                  //   Créer un mot de passe LumenJuris
                  // </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="hover:bg-gray-100"
          onClick={onExportDataClick}
        >
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
