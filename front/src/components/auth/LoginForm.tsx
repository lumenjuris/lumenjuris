// UI //
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/InputGroup";
import { Field, FieldLabel, FieldDescription } from "../ui/Field";
import { EyeOffIcon, EyeIcon, SendIcon, LogInIcon } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

import { AlertBanner } from "../common/AlertBanner";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

interface LoginFormProps {
  email: string;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
  password: string;
  setPassword: React.Dispatch<React.SetStateAction<string>>;
  forgotPassword: boolean;
  setForgotPassword: React.Dispatch<React.SetStateAction<boolean>>;
  emailSent: boolean;
  setEmailSent: React.Dispatch<React.SetStateAction<boolean>>;
}

const LoginForm = ({
  email,
  setEmail,
  password,
  setPassword,
  forgotPassword,
  setForgotPassword,
  emailSent,
  setEmailSent,
}: LoginFormProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [submitForgotError, setSubmitForgotError] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [serverErrorMessage, setServerErrorMessage] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    setForgotPassword(false);
    setEmailSent(false);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email || !password) {
      setSubmitError(true);
    } else {
      setSubmitLoading(true);
      try {
        const loginResponse = await fetch("/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
          credentials: "include",
        });

        const data = await loginResponse.json();
        console.log("▶️▶️ RETOUR SERVEUR CONNEXION :", data);

        if (!loginResponse.ok) {
          setServerError(true);
          setServerErrorMessage(data.message);
          throw new Error(`BackNode Auth Error : ${loginResponse.status}`);
        } else {
          setSubmitSuccess(true);
          setSuccessMessage(data.message);
          navigate("/dashboard");
        }
      } catch (error) {
        setServerError(true);
        console.error("🛑🛑🛑 ERREUR SERVEUR CONNEXION", error);
      }
    }
  };

  const handleSubmitGoogle = () => {
    window.location.href = "http://localhost:3020/auth/google";
  };

  const handleSubmitForgotPassword = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!email) {
      setSubmitForgotError(true);
    } else {
      setEmailSent(true);
      setForgotPassword(false);
    }
  };

  const handleChangeEmail = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setEmail(value);
  };

  const handleChangePassword = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setPassword(value);
  };

  return (
    <div className="flex flex-col gap-5">
      {submitError && (
        <AlertBanner
          title="Champs manquants !"
          variant="error"
          detail="Vérifiez votre adresse email et votre mot de passe."
          onClose={() => {
            setSubmitError(false);
          }}
        />
      )}
      {submitForgotError && (
        <AlertBanner
          title="Email manquant !"
          variant="error"
          detail="Pour réinitialiser votre mot de passe veuillez renseigner votre adresse email."
          onClose={() => {
            setSubmitForgotError(false);
            setForgotPassword(true);
          }}
        />
      )}

      {serverError && (
        <AlertBanner
          title="Erreur serveur !"
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
          title="Connexion réussie !"
          variant="success"
          detail={successMessage}
          onClose={() => {
            setSubmitSuccess(false);
            setSubmitLoading(false);
            setSuccessMessage("");
            setEmail("");
            setPassword("");
            navigate("/dashboard");
          }}
        />
      )}

      {emailSent === true ? (
        <AlertBanner
          title="Votre demande est prise en compte"
          variant="success"
          detail="Si un compte associé à cette adresse email existe vous allez recevoir un lien pour réinitialiser votre mot de passe"
          duration={9000}
          onClose={() => {
            setEmailSent(false);
          }}
        />
      ) : (
        <></>
      )}

      {forgotPassword === true ? (
        <div className="flex flex-col gap-6">
          <h2>
            Renseignez votre email de connexion pour réinitialiser votre mot de
            passe :
          </h2>
          <form onSubmit={handleSubmitForgotPassword}>
            <section className="flex flex-col gap-6">
              <Field>
                {/* <FieldLabel htmlFor="email">Email</FieldLabel> */}
                <FieldDescription className="text-gray-500">
                  Un lien de réinitialisation vous sera envoyer à cette adresse
                </FieldDescription>
                <Input
                  id="email"
                  type="email"
                  placeholder="Votre email de connexion"
                  value={email}
                  onChange={handleChangeEmail}
                />
              </Field>

              <div className="w-full h-px bg-border"></div>

              <div className="grid gap-2">
                <Button
                  className="text-background border border-lumenjuris"
                  disabled={
                    submitLoading ? true : submitForgotError ? true : false
                  }
                  type="submit"
                  size="lg"
                >
                  Envoyer
                  <SendIcon />
                </Button>
              </div>
            </section>
          </form>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <section className="flex flex-col gap-6">
            <div className="grid gap-2">
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="Saisissez votre email de connexion"
                  value={email}
                  onChange={handleChangeEmail}
                />
              </Field>
            </div>

            <div className="grid gap-2">
              <Field className="max-w-sm">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Saisissez votre mot de passe"
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
              </Field>
            </div>

            <div className="w-full h-px bg-border"></div>

            <div className="grid gap-2">
              <Button
                className="text-background border border-lumenjuris"
                disabled={submitLoading ? true : submitError ? true : false}
                type="submit"
                size="lg"
              >
                <LogInIcon />
                Se connecter
              </Button>
              <button
                className="w-full h-10 border border-lumenjuris text-sm font-medium inline-flex justify-center items-center gap-2 rounded-md text-lumenjuris hover:bg-lumenjuris-background"
                type="button"
                onClick={handleSubmitGoogle}
              >
                <FcGoogle className="text-[20px]" />
                Se connecter avec Google
              </button>
              <Button
                variant="ghost"
                onClick={() => {
                  setForgotPassword(true);
                }}
              >
                Mot de passe oublié ?
              </Button>
            </div>
          </section>
        </form>
      )}
    </div>
  );
};

export default LoginForm;
