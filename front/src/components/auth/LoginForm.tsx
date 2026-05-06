// UI //
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/InputGroup";
import { Field, FieldLabel, FieldDescription } from "../ui/Field";
import { EyeOffIcon, EyeIcon, SendIcon, LogInIcon } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

import { AlertBanner } from "../common/AlertBanner";
import { TwoFactorCodeModal } from "../ui/TwoFactorCodeModal";
import { useUserStore } from "../../store/userStore";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";


import { fetchProxy } from "../../utils/fetchProxy";

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
  const [serverErrorMessage, setServerErrorMessage] = useState(
    "Une erreur est survenue, veuillez réessayer...",
  );
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
  const [twoFactorEmail, setTwoFactorEmail] = useState("");

  const navigate = useNavigate();
  const { fetchUser } = useUserStore();

  useEffect(() => {
    setForgotPassword(false);
    setEmailSent(false);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email || !password) {
      setSubmitError(true);
      return;
    }

    setSubmitLoading(true);
    try {
      const loginResponse = await fetchProxy("/api/user/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const dataResponse = await loginResponse.json();
      console.log("▶️▶️ RETOUR SERVEUR CONNEXION :", dataResponse);

      if (!loginResponse.ok || !dataResponse.success) {
        setServerError(true);
        setServerErrorMessage(
          dataResponse.message ||
            "Une erreur est survenue, veuillez réessayer...",
        );
        console.error("🛑🛑🛑 ERREUR CONNEXION", dataResponse);
        setSubmitLoading(false);
        return;
      }

      if (dataResponse.twoFactorRequired) {
        setTwoFactorEmail(dataResponse.data.email);
        setTwoFactorModalOpen(true);
        setSubmitLoading(false);
        return;
      }

      await fetchUser();
      navigate("/dashboard");
    } catch (error) {
      setServerError(true);
      setSubmitLoading(false);
      console.error("🛑🛑🛑 ERREUR SERVEUR CONNEXION", error);
    }
  };

  const handleTwoFactorVerify = async (code: string) => {
    const response = await fetchProxy("/api/user/two-factor/verify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.message ?? "Code invalide. Veuillez réessayer.");
    }

    await fetchUser();
    navigate("/dashboard");
  };

  const handleTwoFactorCancel = async () => {
    setTwoFactorModalOpen(false);
    setSubmitLoading(false);
    await fetchProxy("/api/user/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => null);
  };

  const handleSubmitGoogle = () => {
    window.location.href = "http://localhost:3020/auth/google";
  };

  const handleSubmitForgotPassword = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!email) {
      setSubmitForgotError(true);
    } else {
      setSubmitLoading(true);
      setEmailSent(true);
      try {
        await fetchProxy("/api/auth/forgotpassword", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
          credentials: "include",
        });
      } catch (error) {}
    }
  };

  const handleChangeEmail = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
  };

  const handleChangePassword = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  return (
    <div className="flex flex-col gap-5">
      {submitError && (
        <AlertBanner
          title="Champs manquants !"
          variant="error"
          detail="Vérifiez votre adresse email et votre mot de passe."
          onClose={() => setSubmitError(false)}
        />
      )}
      {submitForgotError && (
        <AlertBanner
          title="Email manquant !"
          variant="error"
          detail="Pour réinitialiser votre mot de passe veuillez renseigner votre adresse email."
          onClose={() => {
            setForgotPassword(true);
            setSubmitForgotError(false);
          }}
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

      {emailSent && (
        <section className="flex flex-col gap-2">
          <AlertBanner
            title="Email envoyé !"
            variant="success"
            detail="Si un compte est associé à cette adresse, vous recevrez un lien de réinitialisation dans quelques instants."
            duration={12000}
            onClose={() => {
              setEmailSent(false);
              setSubmitLoading(false);
            }}
          />
          <p className="text-gray-500 text-[14px]">
            Pensez à vérifier vos spams si vous ne recevez rien dans quelques
            minutes.
          </p>
        </section>
      )}

      {forgotPassword === true ? (
        <div className="flex flex-col gap-6">
          <h2>Réinitialisez votre mot de passe :</h2>
          <form onSubmit={handleSubmitForgotPassword}>
            <section className="flex flex-col gap-6">
              <Field>
                <FieldDescription className="text-gray-500">
                  Saisissez l'adresse email associée à votre compte. Vous
                  recevrez un lien pour créer un nouveau mot de passe.
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
                  disabled={submitLoading || submitForgotError}
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
                disabled={submitLoading || submitError}
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
              <Button variant="ghost" onClick={() => setForgotPassword(true)}>
                Mot de passe oublié ?
              </Button>
            </div>
          </section>
        </form>
      )}

      <TwoFactorCodeModal
        open={twoFactorModalOpen}
        email={twoFactorEmail}
        onVerify={handleTwoFactorVerify}
        onCancel={() => {
          void handleTwoFactorCancel();
        }}
      />
    </div>
  );
};

export default LoginForm;
