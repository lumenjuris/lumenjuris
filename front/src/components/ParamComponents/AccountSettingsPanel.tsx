import { FcGoogle } from "react-icons/fc";
import { ACCOUNT_PASSWORD_INPUT_ID } from "../../config/paramSettings";
import type {
  AccountProfile,
  AccountProvider,
} from "../../types/paramSettings";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/InputGroup";
import { SettingsField } from "../ui/SettingsField";
import { SettingsToggleRow } from "../ui/SettingsToggleRow";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/Dialog";
import { Field, FieldLabel, FieldError } from "../ui/Field";
import { EyeOffIcon, EyeIcon } from "lucide-react";
import { AlertBanner } from "../common/AlertBanner";

import { useState, useRef } from "react";

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
  setPassword,
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
  const [upddateFirstName, setUpdateFirstName] = useState(profile.prenom);
  const [updateLastName, setUpdateLastName] = useState(profile.nom);
  const [updateEmail, setUpdateEmail] = useState(profile.email);
  const [emailError, setEmailError] = useState("");

  // Le panneau Google décide seul de son affichage à partir du provider reçu.
  const googleConnectionPanelMode =
    provider?.provider === "GOOGLE"
      ? (provider.googleConnectionPanelMode ?? "google_only")
      : "hidden";
  const shouldShowGooglePanel = googleConnectionPanelMode !== "hidden";
  const hasAddedPassword = googleConnectionPanelMode === "google_with_password";

  const passwordErrorTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const handleChangeProfileInfo = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    try {
      const updateProfile = await fetch("/api/user", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: updateEmail,
          nom: updateLastName,
          prenom: upddateFirstName,
        }),
        credentials: "include",
      });

      const updateResponse = await updateProfile.json();
      if (!updateProfile.ok || !updateResponse.success) {
        setServerError(true);
        setServerErrorMessage(updateResponse.message);
        throw new Error(`BackNode Auth Error : ${updateResponse.status}`);
      } else {
        setSubmitSuccess(true);
        setSuccessMessage("Votre profile a bien été mis à jour.");
      }
    } catch (error) {
      setServerError(true);
      setServerErrorMessage(
        "Une erreur s'est produite, nous n'avons pas pu mettre à jour votre profile...",
      );
    }
  };

  const handleSubmitNewPassword = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (confirmPassword != password) {
      setSubmitError(true);
    } else {
      setSubmitLoading(true);
      try {
        const addNewPassword = await fetch("/api/user", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            password: password,
          }),
          credentials: "include",
        });

        const passwordResponse = await addNewPassword.json();
        if (!addNewPassword.ok || !passwordResponse.success) {
          setServerError(true);
          setServerErrorMessage(passwordResponse.message);
          throw new Error(`BackNode Auth Error : ${passwordResponse.status}`);
        } else {
          setSubmitSuccess(true);
          setSuccessMessage("Votre mot de passe à bien été créé.");
          setShowPassword(false);
          setShowConfirmPassword(false);
        }
      } catch (error) {
        setServerError(true);
        setServerErrorMessage(
          "Une erreur s'est produite, nous n'avons pas pu créer votre mot de passe...",
        );
      }
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
      setConfirmPasswordError("Les mots de passes doivent-être identiques !");
    } else if (value.length >= 8 && value === password) {
      setConfirmPasswordError("");
    }
  };

  const handleChangeLastname = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setUpdateLastName(value);
  };

  const handleChangeFirstname = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value.trim();
    setUpdateFirstName(value);
  };

  const handleChangeEmail = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setUpdateEmail(value);
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    if (value.length > 0 && !emailRegex.test(value)) {
      setEmailError("L'adresse email n'est pas valide");
    } else {
      setEmailError("");
    }
  };

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
              onChange={(event) =>
                onProfileFieldChange("nom", event.target.value)
              }
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
          {/* <SettingsField label="Mot de passe">
            <Input
              id={ACCOUNT_PASSWORD_INPUT_ID}
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              onBlur={onPasswordBlur}
            />
          </SettingsField> */}
        </div>

        <section>
          {/* update profile infos */}
          <Dialog>
            <DialogTrigger
              render={
                <Button variant="outline">Mettre à jour mon profile</Button>
              }
            />
            <DialogContent className="sm:max-w-sm">
              <form
                onSubmit={handleChangeProfileInfo}
                className="flex flex-col gap-4"
              >
                <DialogHeader>
                  <DialogTitle>Informations de profile</DialogTitle>
                  <DialogDescription>
                    Vous pouvez mettre à jour vos informations de profile en
                    modifiant les champs ci-dessous.
                  </DialogDescription>
                  {submitError && (
                    <AlertBanner
                      title="Vérifiez vos champs !"
                      variant="error"
                      detail=""
                      onClose={() => setSubmitError(false)}
                    />
                  )}
                  {serverError && (
                    <AlertBanner
                      title="Connexion impossible !"
                      variant="error"
                      detail={serverErrorMessage}
                      onClose={() => {
                        setServerError(false);
                        setSubmitLoading(false);
                      }}
                    />
                  )}
                  {submitSuccess && (
                    <AlertBanner
                      title="Modification réussie !"
                      variant="success"
                      detail={successMessage}
                      duration={6000}
                      onClose={() => {
                        setSubmitLoading(false);
                        setSubmitSuccess(false);
                      }}
                    />
                  )}
                </DialogHeader>

                <Field>
                  <FieldLabel
                    htmlFor="lastname"
                    className="after:text-red-500 after:content-['*']"
                  >
                    Nom
                  </FieldLabel>
                  <Input
                    id="lastname"
                    type="text"
                    placeholder="Dupond"
                    value={updateLastName}
                    onChange={handleChangeLastname}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="firstname">Prénom</FieldLabel>
                  <Input
                    id="firstname"
                    type="text"
                    placeholder="Jenny"
                    value={upddateFirstName}
                    onChange={handleChangeFirstname}
                  />
                </Field>
                <Field>
                  <FieldLabel
                    htmlFor="email"
                    className="after:text-red-500 after:content-['*']"
                  >
                    Email
                  </FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="mail@example.com"
                    value={updateEmail}
                    onChange={handleChangeEmail}
                    className={
                      emailError &&
                      "text-destructive border-destructive focus-visible:border-destructive focus-visible:ring-destructive ring-1 ring-destructive"
                    }
                  />
                  <FieldError
                    errors={emailError ? [{ message: emailError }] : undefined}
                  ></FieldError>
                </Field>

                <DialogFooter>
                  <DialogClose
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setUpdateEmail(profile.email);
                          setUpdateFirstName(profile.prenom);
                          setUpdateLastName(profile.nom);
                        }}
                      >
                        Annuler
                      </Button>
                    }
                  />
                  <Button
                    type="submit"
                    className="text-white"
                    disabled={
                      submitLoading || emailError.length > 0 ? true : false
                    }
                  >
                    Enregistrer
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </section>

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
                    ? "Vous êtes connecté via votre compte Google et vous utilisez un mot de passe dédié."
                    : "Vous êtes actuellement connecté via votre compte Google."}
                </div>
                {!hasAddedPassword ? (
                  <Dialog>
                    <DialogTrigger
                      render={
                        <span className="text-[12px] underline text-lumenjuris hover:cursor-pointer">
                          Ajouter un mot de passe
                        </span>
                      }
                    />
                    <DialogContent className="sm:max-w-sm">
                      <form
                        onSubmit={handleSubmitNewPassword}
                        className="flex flex-col gap-4"
                      >
                        <DialogHeader>
                          <DialogTitle>Nouveau mot de passe</DialogTitle>
                          <DialogDescription>
                            Choisissez un nouveau mot de passe pour vous
                            connecter à l'application lors de l'utilisation de
                            votre adresse email Google.
                          </DialogDescription>
                          {submitError && (
                            <AlertBanner
                              title="Mot de passe invalide !"
                              variant="error"
                              detail="Les deux mots de passe doivent-être identiques !"
                              onClose={() => setSubmitError(false)}
                            />
                          )}
                          {serverError && (
                            <AlertBanner
                              title="Connexion impossible !"
                              variant="error"
                              detail={serverErrorMessage}
                              onClose={() => {
                                setServerError(false);
                                setSubmitLoading(false);
                              }}
                            />
                          )}
                          {submitSuccess && (
                            <AlertBanner
                              title="Modification réussie !"
                              variant="success"
                              detail={successMessage}
                              duration={6000}
                              onClose={() => {
                                setSubmitLoading(false);
                                setSubmitSuccess(false);
                              }}
                            />
                          )}
                        </DialogHeader>
                        <Field className="max-w-sm">
                          <FieldLabel
                            htmlFor="password"
                            className="after:text-red-500 after:content-['*']"
                          >
                            Password
                          </FieldLabel>
                          <InputGroup
                            className={
                              passwordError &&
                              "border-2 border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-2 has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot=input-group-control]:focus-visible]:ring-destructive"
                            }
                          >
                            <InputGroupInput
                              id="password"
                              type={showPassword ? "text" : "password"}
                              placeholder="Choisissez un mot de passe"
                              value={password}
                              onChange={handleChangePassword}
                              className={passwordError && "text-destructive"}
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
                              passwordError
                                ? [{ message: passwordError }]
                                : undefined
                            }
                          ></FieldError>
                        </Field>
                        <Field className="max-w-sm">
                          <FieldLabel
                            htmlFor="confirmpassword"
                            className="after:text-red-500 after:content-['*']"
                          >
                            Confirm password
                          </FieldLabel>
                          <InputGroup
                            className={
                              confirmPasswordError &&
                              "border-2 border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-2 has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot=input-group-control]:focus-visible]:ring-destructive"
                            }
                          >
                            <InputGroupInput
                              id="confirmpassword"
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Confirmez votre mot de passe"
                              value={confirmPassword}
                              onChange={handleChangeConfirmPassword}
                              className={
                                confirmPasswordError && "text-destructive"
                              }
                            />
                            <InputGroupAddon
                              align="inline-end"
                              onClick={() =>
                                setShowConfirmPassword(!showConfirmPassword)
                              }
                              className="hover:cursor-pointer"
                            >
                              {showConfirmPassword ? (
                                <EyeOffIcon />
                              ) : (
                                <EyeIcon />
                              )}
                            </InputGroupAddon>
                          </InputGroup>
                          <FieldError
                            errors={
                              confirmPasswordError
                                ? [{ message: confirmPasswordError }]
                                : undefined
                            }
                          ></FieldError>
                        </Field>
                        <DialogFooter>
                          <DialogClose
                            render={
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  (setPassword(""),
                                    setConfirmPassword(""),
                                    setPasswordError(""),
                                    setConfirmPasswordError(""));
                                }}
                              >
                                Annuler
                              </Button>
                            }
                          />
                          <Button
                            type="submit"
                            className="text-white"
                            disabled={
                              password.length < 8 ||
                              submitLoading ||
                              passwordError.length > 0 ||
                              confirmPasswordError.length > 0
                                ? true
                                : false
                            }
                          >
                            Enregistrer
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                ) : // <button
                //   type="button"
                //   onClick={() => {
                //     const passwordInput = document.getElementById(
                //       ACCOUNT_PASSWORD_INPUT_ID,
                //     );

                //     passwordInput?.scrollIntoView({
                //       behavior: "smooth",
                //       block: "center",
                //     });
                //     (passwordInput as HTMLInputElement | null)?.focus();
                //   }}
                //   className="mt-2 text-xs font-medium text-lumenjuris underline underline-offset-2 transition-colors hover:text-lumenjuris/80"
                // >
                //   Ajouter un mot de passe
                // </button>
                null}
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
