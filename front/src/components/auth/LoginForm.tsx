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
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";

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

const PROXY_URL: string =
  import.meta.env.VITE_URL_PROXY || "http://localhost:3000";

/**
 * Formulaire de connexion gérant trois flux d'authentification distincts :
 *
 * 1. **Email / mot de passe** — appelle `POST /api/user/auth/login`. En cas de
 *    succès, vérifie deux conditions avant de naviguer :
 *    - Le compte doit être vérifié (`isVerified`). Sinon, une alerte invite
 *      l'utilisateur à cliquer sur le lien reçu par email.
 *    - Si le 2FA est activé (`twoFactorRequired`), ouvre `TwoFactorCodeModal`
 *      plutôt que de naviguer immédiatement.
 *
 * 2. **Google OAuth** — redirige `window.location` vers `PROXY_URL/api/google`.
 *    Le proxy gère le callback et pose le cookie JWT, puis redirige vers `/analyzer`.
 *
 * 3. **Mot de passe oublié** — bascule le rendu vers un formulaire minimaliste
 *    (contrôlé par `forgotPassword`) qui appelle `POST /api/user/auth/forgotpassword`.
 *    L'envoi est best-effort : aucune erreur serveur n'est exposée à l'utilisateur
 *    pour ne pas révéler l'existence d'un compte.
 *
 * @param email            Valeur contrôlée du champ email.
 * @param setEmail         Setter du champ email.
 * @param password         Valeur contrôlée du champ mot de passe.
 * @param setPassword      Setter du champ mot de passe.
 * @param forgotPassword   `true` lorsque le formulaire est en mode "mot de passe oublié".
 * @param setForgotPassword Bascule entre le formulaire de connexion et celui de réinitialisation.
 * @param emailSent        `true` après l'envoi de l'email de réinitialisation, affiche une alerte de succès.
 * @param setEmailSent     Setter de l'état `emailSent`.
 */
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
  const [isBanned, setIsBanned] = useState(false);
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
  const [twoFactorEmail, setTwoFactorEmail] = useState("");
  const [verificationError, setVerificationError] = useState(false);
  const verificationErrorMessage =
    "Pour valider votre compte veuillez cliquer sur le lien qui vous a été envoyé par e-mail.";

  const [showRateLimitModal, setShowRateLimitModal] = useState(false);
  const [showRateLimitLogin, setShowRateLimitLogin] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();

  const navigate = useNavigate();
  const { fetchUser } = useUserStore();
  const location = useLocation();
  const locationState = location.state as { plan?: object } | null;

  useEffect(() => {
    setForgotPassword(false);
    setEmailSent(false);

    const errorParam = searchParams.get("error");
    const reasonParam = searchParams.get("reason");

    const isBannedFromUrl = errorParam === "banned" || reasonParam === "banned";

    if ( isBannedFromUrl) {
      setIsBanned(true);

      if (isBannedFromUrl){
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("error");
        newParams.delete("reason");
        setSearchParams(newParams, {replace: true});
      }
    }
  }, [searchParams]);

  //Handle de la connexion d'un user
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

      // Quota de connexion atteint : le serveur repond en texte brut, pas en
      // JSON. Sans ce cas traite avant l'analyse, la lecture echouait et
      // l'utilisateur ne voyait qu'une erreur generique sans savoir qu'il
      // devait simplement patienter.
      if (loginResponse.status === 429) {
        setShowRateLimitLogin(true);
        setSubmitLoading(false);
        return;
      }

      // Une reponse non-JSON (page d'erreur du serveur, coupure du proxy) ne
      // doit pas partir en exception : on affiche un message exploitable.
      const dataResponse = await loginResponse.json().catch(() => null);

      if (!dataResponse) {
        setServerError(true);
        setServerErrorMessage(
          "Le serveur n'a pas répondu correctement. Merci de réessayer dans un instant.",
        );
        setSubmitLoading(false);
        return;
      }

      if (!loginResponse.ok || !dataResponse.success) {
        if (loginResponse.status === 403 && dataResponse.reason === "unverified") {
          setVerificationError(true);
          setSubmitLoading(false);
          return;
        }
        if (loginResponse.status === 403) {
          setIsBanned(true);
          setServerError(false);
          setSubmitLoading(false);
          return;
        }
        setServerError(true);
        setServerErrorMessage(
          dataResponse.message ||
            "Une erreur est survenue, veuillez réessayer...",
        );
        setSubmitLoading(false);
        return;
      }

      if (!dataResponse.data?.isVerified) {
        setVerificationError(true);
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
      locationState?.plan
        ? navigate("/souscription", {
            state: { plan: locationState?.plan || null },
          })
        : navigate("/dashboard");
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

  // Connexion via Google
  const handleSubmitGoogle = () => {
    window.location.href = `${PROXY_URL}/api/user/auth/google`;
  };

  const handleSubmitForgotPassword = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!email) {
      setSubmitForgotError(true);
      return;
    }

    setSubmitLoading(true);
    try {
      const response = await fetchProxy("/api/user/auth/forgotpassword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });

      if (response.status === 429) {
        setShowRateLimitModal(true);
        return;
      }

      // La confirmation ne s'affiche qu'une fois la demande réellement acceptée.
      if (response.ok) {
        setEmailSent(true);
      } else {
        setServerErrorMessage(
          "La demande n'a pas pu aboutir. Merci de réessayer dans un instant.",
        );
        setServerError(true);
      }
    } catch (error) {
      console.error(error);
      setServerErrorMessage(
        "Serveur injoignable. Vérifiez votre connexion et réessayez.",
      );
      setServerError(true);
    } finally {
      // Le bouton redevient actif dans tous les cas.
      setSubmitLoading(false);
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
          detail="Vérifiez votre adresse e-mail et votre mot de passe."
          duration={8000}
          onClose={() => setSubmitError(false)}
        />
      )}
      {submitForgotError && (
        <AlertBanner
          title="E-mail manquant !"
          variant="error"
          detail="Pour réinitialiser votre mot de passe veuillez renseigner votre adresse e-mail."
          duration={8000}
          onClose={() => {
            setForgotPassword(true);
            setSubmitForgotError(false);
          }}
        />
      )}

      {showRateLimitModal && (
        <AlertBanner
          title="Trop de requêtes !"
          variant="error"
          detail="Vous avez demandé à réinitialiser votre mot de passe de trop nombreuses fois, veuillez attendre 15 minutes."
          duration={12000}
          onClose={() => {
            setShowRateLimitModal(false);
          }}
        />
      )}

      {showRateLimitLogin && (
        <AlertBanner
          title="Trop de tentatives de connexion"
          variant="error"
          detail="Par sécurité, les tentatives sont bloquées pendant 15 minutes. Réessayez ensuite, ou utilisez « Mot de passe oublié ? » si vous ne le retrouvez pas."
          duration={15000}
          onClose={() => setShowRateLimitLogin(false)}
        />
      )}

      {isBanned && (
        <AlertBanner 
        title="Votre compte a été bloqué"
        variant="error"
        detail="Votre compte a été bloqué par les services de modération, si vous ne comprenez pas les raisons vous pouvez nous contacter par email à l'adresse contact@lumenjuris.com"
        duration={15000}
        onClose={()=> {
          setIsBanned(false);
        }}
        />
      )

      }

      {serverError && (
        <AlertBanner
          title="Connexion impossible !"
          variant="error"
          detail={serverErrorMessage}
          duration={8000}
          onClose={() => {
            setServerError(false);
            setSubmitLoading(false);
          }}
        />
      )}

      {verificationError && (
        <AlertBanner
          title="Votre compte n'a pas été validé !"
          variant="error"
          detail={verificationErrorMessage}
          duration={10000}
          onClose={() => {
            setVerificationError(false);
            setSubmitLoading(false);
          }}
        />
      )}

      { emailSent &&  (
        <section className="flex flex-col gap-2">
          <AlertBanner
            title="E-mail envoyé !"
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
                  Saisissez l'adresse e-mail associée à votre compte. Vous
                  recevrez un lien pour créer un nouveau mot de passe.
                </FieldDescription>
                <Input
                  id="email"
                  type="email"
                  placeholder="Votre e-mail de connexion"
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
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="Saisissez votre e-mail de connexion"
                  value={email}
                  onChange={handleChangeEmail}
                />
              </Field>
            </div>

            <div className="grid gap-2">
              <Field className="max-w-sm">
                <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
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

            <div className="grid gap-3">
              <Button
                className="text-background border border-lumenjuris"
                disabled={submitLoading || submitError}
                type="submit"
                size="lg"
              >
                <LogInIcon />
                Se connecter
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-full h-px bg-gray-300"></div>
                <span className="text-gray-400">OU</span>
                <div className="w-full h-px bg-gray-300"></div>
              </div>
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
