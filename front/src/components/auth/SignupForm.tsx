// UI //
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/InputGroup";
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
} from "../ui/Field";
import { Separator } from "../ui/Separator";
import { Checkbox } from "../ui/Checkbox";
import { Label } from "../ui/Label";
import { EyeOffIcon, EyeIcon } from "lucide-react";

import { AlertBanner } from "../common/AlertBanner";

import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

interface SignupFormProps {
  lastName: string;
  setLastName: React.Dispatch<React.SetStateAction<string>>;
  firstName: string;
  setFirstName: React.Dispatch<React.SetStateAction<string>>;
  email: string;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
  password: string;
  setPassword: React.Dispatch<React.SetStateAction<string>>;
  siren: string;
  setSiren: React.Dispatch<React.SetStateAction<string>>;
  acceptCgu: boolean;
  setAcceptCgu: React.Dispatch<React.SetStateAction<boolean>>;
}

const SignupForm = ({
  lastName,
  setLastName,
  firstName,
  setFirstName,
  email,
  setEmail,
  password,
  setPassword,
  siren,
  setSiren,
  acceptCgu,
  setAcceptCgu,
}: SignupFormProps) => {
  const [confirmPassword, setConfirmPassword] = useState("");
  const [lastnameError, setLastnameError] = useState("");
  const [firstnameError, setFirstnameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const passwordErrorTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lastName || !firstName || !email || !password) {
      <AlertBanner
        title="Des champs sont manquants"
        variant="error"
        onClose={() => {}}
      />;
    } else if (emailError) {
      <AlertBanner
        title={emailError}
        variant="error"
        onClose={() => {
          setEmailError("");
        }}
      />;
    } else if (passwordError) {
      <AlertBanner
        title={passwordError}
        variant="error"
        onClose={() => {
          setPasswordError("");
        }}
      />;
    } else {
      setSubmitLoading(true);
    }
  };

  const handleChangeLastname = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setLastName(value);
  };

  const handleChangeFirstname = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value;
    setFirstName(value);
  };

  const handleChangeEmail = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setEmail(value);
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    if (value.length > 0 && !emailRegex.test(value)) {
      setEmailError("L'adresse email n'est pas valide");
    } else {
      setEmailError("");
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

  const handleCheckCgu = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.checked;
    setAcceptCgu(value);
  };

  return (
    <div className="w-[420px] border border-border p-4 rounded-xl flex flex-col gap-4 bg-background">
      <section>
        <h2 className="font-semibold text-[18px]">
          Créez un compte et accéder à nos outils
        </h2>
        <p className="text-black/50 ">Complétez les champs suivants</p>
      </section>

      <div className="w-full h-px bg-border"></div>

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-6">
          <div className="grid gap-2">
            <Field>
              <FieldLabel
                htmlFor="lastname"
                className="after:ml-0.5 after:text-red-500 after:content-['*']"
              >
                Nom
              </FieldLabel>
              <Input
                id="lastname"
                type="text"
                placeholder="Dupond"
                required
                onChange={handleChangeLastname}
              />
            </Field>
          </div>

          <div className="grid gap-2">
            <Field>
              <FieldLabel htmlFor="firstname">Prénom</FieldLabel>
              <Input
                id="firstname"
                type="text"
                placeholder="Jenny"
                required
                onChange={handleChangeFirstname}
              />
            </Field>
          </div>

          <div className="grid gap-2">
            <Field>
              <FieldLabel
                htmlFor="email"
                className="after:ml-0.5 after:text-red-500 after:content-['*']"
              >
                Email
              </FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="mail@example.com"
                required
                pattern="/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/"
                onChange={handleChangeEmail}
                className={
                  emailError &&
                  "text-destructive border-destructive focus-visible:border-destructive ring-1 ring-destructive"
                }
              />
              <FieldError
                errors={emailError ? [{ message: emailError }] : undefined}
              ></FieldError>
            </Field>
          </div>

          <div className="grid gap-2">
            <Field className="max-w-sm">
              <FieldLabel
                htmlFor="password"
                className="after:ml-0.5 after:text-red-500 after:content-['*']"
              >
                Password
              </FieldLabel>
              <InputGroup
                className={
                  passwordError &&
                  "border-2 border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-2"
                }
              >
                <InputGroupInput
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Choisissez un mot de passe"
                  required
                  onChange={handleChangePassword}
                  className={passwordError && "text-destructive"}
                />
                <InputGroupAddon
                  align="inline-end"
                  onClick={() => setShowPassword(!showPassword)}
                  className="hover:cursor-pointer"
                >
                  {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                </InputGroupAddon>
              </InputGroup>
              <FieldError
                errors={
                  passwordError ? [{ message: passwordError }] : undefined
                }
              ></FieldError>
            </Field>
          </div>

          <div className="grid gap-2">
            <Field className="max-w-sm">
              <FieldLabel
                htmlFor="confirmpassword"
                className="after:ml-0.5 after:text-red-500 after:content-['*']"
              >
                Confirm password
              </FieldLabel>
              <InputGroup
                className={
                  confirmPasswordError &&
                  "border-2 border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-destructive has-[[data-slot=input-group-control]:focus-visible]:border-2"
                }
              >
                <InputGroupInput
                  id="confirmpassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirmez votre mot de passe"
                  required
                  onChange={handleChangeConfirmPassword}
                  className={confirmPasswordError && "text-destructive"}
                />
                <InputGroupAddon
                  align="inline-end"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="hover:cursor-pointer"
                >
                  {showConfirmPassword ? <EyeIcon /> : <EyeOffIcon />}
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
          </div>

          <div className="grid gap-2">
            <Field>
              <FieldLabel htmlFor="siren">Siren</FieldLabel>
              <FieldDescription className="text-muted_foreground">
                Saisissez le numéro Siren de votre société
              </FieldDescription>
              <Input
                id="siren"
                type="text"
                placeholder="552 178 639"
                required
                onChange={handleChangeFirstname}
              />
            </Field>
          </div>

          <div className="grid gap-2">
            <FieldGroup className="w-72">
              <Field orientation="horizontal">
                <Checkbox
                  id="terms-checkbox-desc"
                  name="terms-checkbox-desc"
                  defaultChecked={false}
                  required
                  onCheckedChange={(checked) => {
                    handleCheckCgu({
                      target: { checked },
                    } as React.ChangeEvent<HTMLInputElement>);
                  }}
                  className="border-ring"
                />
                <FieldContent>
                  <FieldLabel
                    htmlFor="terms-checkbox-desc"
                    className="after:ml-0.5 after:text-red-500 after:content-['*']"
                  >
                    Valider nos{" "}
                    <a
                      href="https://www.lumenjuris.com/conditions-generales-dutilisation/"
                      className="hover:cursor-pointer underline"
                    >
                      CGU
                    </a>
                  </FieldLabel>
                </FieldContent>
              </Field>
            </FieldGroup>
          </div>

          <div className="grid gap-2">
            <span className="before:mr-0.5 before:text-red-500 before:content-['*'] text-[14px] text-muted_foreground">
              Champs obligatoires.
            </span>
          </div>

          <div className="w-full h-px bg-border"></div>
          <div className="grid gap-2">
            {/* <button className="w-full h-7 border-lumenjuris border-2">
              submit
            </button> */}
            <Button
              className="text-background"
              disabled={submitLoading && true}
              type="submit"
            >
              S'inscrire
            </Button>
            <Button
              variant="ghost"
              className="border border-lumenjuris text-lumenjuris"
            >
              Se connecter avec Google
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default SignupForm;
