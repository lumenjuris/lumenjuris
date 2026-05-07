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
} from "../ui/Field";
import { Checkbox } from "../ui/Checkbox";
import { EyeOffIcon, EyeIcon, PenBoxIcon } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

import { AlertBanner } from "../common/AlertBanner";

import { useRef, useState } from "react";
import { fetchProxy } from "../../utils/fetchProxy";

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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [submitError, setSubmitError] = useState(false);
  const [submitCguError, setSubmitCguError] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [serverError, setServerError] = useState(false);
  const [serverErrorMessage, setServerErrorMessage] = useState("");

  const passwordErrorTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const topRef = useRef<HTMLDivElement>(null);
  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    scrollToTop();

    if (!lastName || !email || !password) {
      setSubmitError(true);
    } else if (acceptCgu === false) {
      setSubmitCguError(true);
    } else {
      setSubmitLoading(true);
      const trimedLastName = lastName.trim();
      const trimedFirstName = firstName.trim();
      try {
        const signupResponse = await fetchProxy("/api/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email,
            nom: trimedLastName,
            prenom: trimedFirstName,
            password: password,
            cgu: acceptCgu,
          }),
          credentials: "include",
        });

        const data = await signupResponse.json();
        console.log("▶️▶️ RETOUR PROXY INSCRIPTION :", data);

        if (!signupResponse.ok) {
          setServerError(true);
          setServerErrorMessage(data.message);
          throw new Error(`BackNode Auth Error : ${signupResponse.status}`);
        } else {
          setSubmitSuccess(true);
          setSuccessMessage(data.message);
        }
      } catch (error) {
        setServerError(true);
        setServerErrorMessage(
          "Une erreur s'est produite, nous n'avons pas pu créer votre compte...",
        );
        console.error("🛑🛑🛑 ERREUR SERVEUR INSCRIPTION", error);
      }
    }

    if (siren) {
      const trimedSiren = siren.trim();
      try {
        const sirenResponse = await fetchProxy(`/api/insee/${trimedSiren}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (!sirenResponse.ok) {
          console.log("SIREN RESPONSE ERROR :", sirenResponse.status);
        } else {
          console.log("SIREN RESPONSE :", sirenResponse.status);
        }
      } catch (error) {
        console.log("SIREN RESPONSE ERROR :", error);
      }
    }
  };

  const handleSubmitGoogle = () => {
    window.location.href = "/api/google";
  };

  const handleChangeLastname = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setLastName(value);
  };

  const handleChangeFirstname = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value.trim();
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

  const handleChangeSiren = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSiren(value);
  };

  const handleCheckCgu = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.checked;
    setAcceptCgu(value);
  };

  return (
    <div ref={topRef} className="flex flex-col gap-5">
      {submitError && (
        <AlertBanner
          title="Champs manquants !"
          variant="error"
          detail="Certains champs obligatoires sont manquants."
          onClose={() => {
            setSubmitError(false);
          }}
        />
      )}
      {submitCguError && (
        <AlertBanner
          title="CGU !"
          variant="error"
          detail="Vous devez acceptez nos CGU."
          onClose={() => {
            setSubmitCguError(false);
          }}
        />
      )}

      {serverError && (
        <AlertBanner
          title="Une erreur est survenue"
          variant="error"
          detail={serverErrorMessage}
          onClose={() => {
            setServerError(false);
            setSubmitLoading(false);
            setServerErrorMessage("");
          }}
        />
      )}
      {submitSuccess && (
        <AlertBanner
          title="Inscription réussie !"
          variant="success"
          detail={successMessage}
          duration={9000}
          onClose={() => {
            setSubmitSuccess(false);
            setSubmitLoading(false);
            setSuccessMessage("");
            setLastName("");
            setFirstName("");
            setEmail("");
            setPassword("");
            setConfirmPassword("");
            setSiren("");
            setAcceptCgu(false);
          }}
        />
      )}

      <form onSubmit={handleSubmit}>
        <section className="flex flex-col gap-6">
          <div className="grid gap-2">
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
                value={lastName}
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
                value={firstName}
                onChange={handleChangeFirstname}
              />
            </Field>
          </div>

          <div className="grid gap-2">
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
                value={email}
                // pattern="/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/"
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
          </div>

          <div className="grid gap-2">
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
                  passwordError ? [{ message: passwordError }] : undefined
                }
              ></FieldError>
            </Field>
          </div>

          <div className="grid gap-2">
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
                  className={confirmPasswordError && "text-destructive"}
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
              ></FieldError>
            </Field>
          </div>

          <div className="grid gap-2">
            <Field>
              <FieldLabel htmlFor="siren">Siren</FieldLabel>
              <FieldDescription className="text-gray-500">
                Saisissez le numéro Siren de votre société
              </FieldDescription>
              <Input
                id="siren"
                type="text"
                placeholder="552 178 639"
                value={siren}
                onChange={handleChangeSiren}
              />
            </Field>
          </div>

          <div className="grid gap-2">
            <FieldGroup className="w-72">
              <Field orientation="horizontal">
                <Checkbox
                  id="terms-checkbox-desc"
                  name="terms-checkbox-desc"
                  checked={acceptCgu}
                  defaultChecked={false}
                  onCheckedChange={(checked) => {
                    handleCheckCgu({
                      target: { checked },
                    } as React.ChangeEvent<HTMLInputElement>);
                  }}
                  className="border-ring"
                />
                <FieldDescription className="after:ml-1 after:text-red-500 after:content-['*']">
                  Accepter nos{" "}
                  <a
                    href="https://www.lumenjuris.com/conditions-generales-dutilisation/"
                    className="hover:cursor-pointer underline"
                  >
                    <span>CGU</span>
                  </a>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </div>

          <div className="grid gap-2">
            <span className="before:mr-1 before:text-red-500 before:content-['*'] text-[14px] text-gray-500">
              Champs obligatoires.
            </span>
          </div>

          <div className="w-full h-px bg-border"></div>

          <div className="grid gap-2">
            <Button
              className="text-background border border-lumenjuris"
              disabled={
                submitLoading
                  ? true
                  : submitError
                    ? true
                    : submitCguError
                      ? true
                      : false
              }
              type="submit"
              size="lg"
            >
              <PenBoxIcon />
              S'inscrire
            </Button>
            <button
              className="w-full h-10 border border-lumenjuris text-sm font-medium inline-flex justify-center items-center gap-2 rounded-md text-lumenjuris hover:bg-lumenjuris-background"
              type="button"
              onClick={handleSubmitGoogle}
            >
              <FcGoogle className="text-[20px]" />
              Se connecter avec Google
            </button>
          </div>
        </section>
      </form>
    </div>
  );
};

export default SignupForm;
