// UI //
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/InputGroup";
import { Field, FieldLabel, FieldDescription } from "../ui/Field";
import {
  EyeOffIcon,
  EyeIcon,
  SendIcon,
  LogInIcon,
  MailIcon,
  PencilIcon,
} from "lucide-react";

import { AlertBanner, type AlertVariant } from "../common/AlertBanner";
import { TwoFactorCodeModal } from "../ui/TwoFactorCodeModal";
import { useUserStore } from "../../store/userStore";
import type { PresentationPanneau } from "../../store/authPanelStore";
import { consommerDestination } from "../../utils/destinationApresConnexion";

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { fetchProxy } from "../../utils/fetchProxy";
import { ConnectGoogle } from "./ConnectGoogle";
import { ConnectMicrosoft } from "./ConnectMicrosoft";
import { AuthPanelShell } from "./AuthPanelShell";



/** Une bannière du panneau, décrite dans le tableau `alertes` du composant. */
interface Alerte {
  id: string;
  visible: boolean;
  variant: AlertVariant;
  title: string;
  detail: string;
  duration: number;
  onClose: () => void;
  complement?: React.ReactNode;
}

interface LoginFormProps {
  onClose: () => void;
  onSwitchToSignup: () => void;
  presentation: PresentationPanneau;
}

/**
 * Panneau de connexion affiché depuis l'en-tête, au moment où l'utilisateur a
 * besoin d'un compte. Il porte lui-même sa présentation : une carte flottante
 * ancrée sous le bouton « Se connecter », montée via un portail pour ne pas
 * déformer la barre de navigation.
 *
 * La connexion par e-mail se fait en deux étapes : on demande d'abord
 * l'adresse, puis seulement le mot de passe. L'adresse reste affichée à la
 * seconde étape, en lecture seule, avec un bouton « Changer d'email » pour
 * revenir en arrière.
 *
 * Il gère les trois flux d'authentification : e-mail / mot de passe (avec 2FA
 * et compte non vérifié), Google OAuth, et mot de passe oublié. Le bouton
 * Microsoft n'est qu'une maquette, sa route serveur n'existe pas encore.
 */
export const LoginForm = ({
  onClose,
  onSwitchToSignup,
  presentation,
}: LoginFormProps) => {

  const [showPassword, setShowPassword] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [submitForgotError, setSubmitForgotError] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [serverErrorMessage, setServerErrorMessage] = useState("Une erreur est survenue, veuillez réessayer...");
  const [isBanned, setIsBanned] = useState(false);
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
  const [twoFactorEmail, setTwoFactorEmail] = useState("");
  const [verificationError, setVerificationError] = useState(false);
  const verificationErrorMessage = "Pour valider votre compte veuillez cliquer sur le lien qui vous a été envoyé par e-mail.";

  const [showRateLimitModal, setShowRateLimitModal] = useState(false);
  const [showRateLimitLogin, setShowRateLimitLogin] = useState(false);

  const navigate = useNavigate();
  const { fetchUser } = useUserStore();
  const location = useLocation();
  const locationState = location.state as { plan?: object } | null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotPassword, setForgotPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // La connexion se fait en deux temps : on demande l'adresse, puis seulement
  // le mot de passe. L'adresse reste affichée à la seconde étape, en lecture,
  // pour que l'utilisateur voie sous quel compte il se connecte.
  const [etape, setEtape] = useState<"email" | "motDePasse">("email");


  // Retour à la saisie de l'adresse : on repose le curseur dans le champ, sans
  // quoi l'utilisateur devrait cliquer dedans pour corriger. Le champ est
  // retrouvé par son id : le composant Input partagé n'est pas un forwardRef,
  // une ref React ne l'atteindrait pas.
  useEffect(() => {
    if (etape === "email" && email) {
      document.getElementById("email")?.focus();
    }
  }, [etape]);




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
      // La destination est lue avant la fermeture : `onClose` l'efface, pour
      // qu'un abandon ne détourne pas la connexion suivante.
      const destination = consommerDestination();
      onClose();
      if (locationState?.plan) {
        navigate("/souscription", { state: { plan: locationState.plan } });
      } else {
        navigate(destination ?? "/dashboard");
      }
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
    const destination = consommerDestination();
    onClose();
    navigate(destination ?? "/dashboard");
  };

  const handleTwoFactorCancel = async () => {
    setTwoFactorModalOpen(false);
    setSubmitLoading(false);
    await fetchProxy("/api/user/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => null);
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

  /**
   * Un seul bouton de soumission pour les deux étapes : à la première il fait
   * avancer vers le mot de passe, à la seconde il lance la connexion.
   */
  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (etape === "motDePasse") {
      void handleSubmit(event);
      return;
    }

    event.preventDefault();
    if (!email) {
      setSubmitError(true);
      return;
    }
    setEtape("motDePasse");
  };



  /** Retour à la saisie de l'adresse : le mot de passe déjà tapé n'a plus lieu d'être. */
  const handleChangerEmail = () => {
    setPassword("");
    setShowPassword(false);
    setEtape("email");
  };

  const handleChangeEmail = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
  };

  const handleChangePassword = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  // Toutes les bannières du panneau sont décrites ici plutôt que répétées dans
  // le JSX : elles ne diffèrent que par leur condition d'affichage, leur texte
  // et ce qu'il faut remettre à zéro en les fermant. L'ordre du tableau est
  // celui de l'affichage.
  const alertes: Alerte[] = [
    {
      id: "champsManquants",
      visible: submitError,
      variant: "error",
      title: "Champs manquants !",
      detail: "Vérifiez votre adresse e-mail et votre mot de passe.",
      duration: 8000,
      onClose: () => setSubmitError(false),
    },
    {
      id: "emailManquant",
      visible: submitForgotError,
      variant: "error",
      title: "E-mail manquant !",
      detail:
        "Pour réinitialiser votre mot de passe veuillez renseigner votre adresse e-mail.",
      duration: 8000,
      onClose: () => {
        setForgotPassword(true);
        setSubmitForgotError(false);
      },
    },
    {
      id: "tropDeDemandesReinitialisation",
      visible: showRateLimitModal,
      variant: "error",
      title: "Trop de requêtes !",
      detail:
        "Vous avez demandé à réinitialiser votre mot de passe de trop nombreuses fois, veuillez attendre 15 minutes.",
      duration: 12000,
      onClose: () => setShowRateLimitModal(false),
    },
    {
      id: "tropDeTentativesConnexion",
      visible: showRateLimitLogin,
      variant: "error",
      title: "Trop de tentatives de connexion",
      detail:
        "Par sécurité, les tentatives sont bloquées pendant 15 minutes. Réessayez ensuite, ou utilisez « Mot de passe oublié ? » si vous ne le retrouvez pas.",
      duration: 15000,
      onClose: () => setShowRateLimitLogin(false),
    },
    {
      id: "compteBloque",
      visible: isBanned,
      variant: "error",
      title: "Votre compte a été bloqué",
      detail:
        "Votre compte a été bloqué par les services de modération, si vous ne comprenez pas les raisons vous pouvez nous contacter par email à l'adresse contact@lumenjuris.com",
      duration: 15000,
      onClose: () => setIsBanned(false),
    },
    {
      id: "erreurServeur",
      visible: serverError,
      variant: "error",
      title: "Connexion impossible !",
      detail: serverErrorMessage,
      duration: 8000,
      onClose: () => {
        setServerError(false);
        setSubmitLoading(false);
      },
    },
    {
      id: "compteNonValide",
      visible: verificationError,
      variant: "error",
      title: "Votre compte n'a pas été validé !",
      detail: verificationErrorMessage,
      duration: 10000,
      onClose: () => {
        setVerificationError(false);
        setSubmitLoading(false);
      },
    },
    {
      id: "emailReinitialisationEnvoye",
      visible: emailSent,
      variant: "success",
      title: "E-mail envoyé !",
      detail:
        "Si un compte est associé à cette adresse, vous recevrez un lien de réinitialisation dans quelques instants.",
      duration: 12000,
      onClose: () => {
        setEmailSent(false);
        setSubmitLoading(false);
      },
      complement: (
        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          Pensez à vérifier vos spams si vous ne recevez rien dans quelques
          minutes.
        </p>
      ),
    },
  ];



  return (
    <>
      <AuthPanelShell
        id="login-panel-title"
        titre={forgotPassword ? "Mot de passe oublié" : "Connexion"}
        presentation={presentation}
        onClose={onClose}
        largeur={360}
      >
        <div className="flex flex-col gap-4">
          {alertes
            .filter((alerte) => alerte.visible)
            .map(({ id, visible: _visible, complement, ...proprietes }) => (
              <section key={id} className="flex flex-col gap-4">
                <AlertBanner {...proprietes} />
                {complement}
              </section>
            ))}

          {forgotPassword ? (
            <form
              onSubmit={handleSubmitForgotPassword}
              className="flex flex-col gap-2"
            >
              <Field>
                <FieldDescription className="text-[12.5px] leading-relaxed text-ink-muted">
                  Saisissez l'adresse e-mail associée à votre compte. Vous
                  recevrez un lien pour créer un nouveau mot de passe.
                </FieldDescription>
                <Input
                  id="forgot-email"
                  type="email"
                  autoFocus
                  placeholder="Votre e-mail de connexion"
                  value={email}
                  onChange={handleChangeEmail}
                />
              </Field>

              <Button
                className="w-full text-background border border-lumenjuris"
                disabled={submitLoading || submitForgotError}
                type="submit"
                size="lg"
              >
                <SendIcon className="h-4 w-4" />
                Envoyer
              </Button>

              <button
                type="button"
                className="w-fit self-center text-[12.5px] text-ink-muted underline-offset-2 transition-colors hover:text-brand hover:underline"
                onClick={() => setForgotPassword(false)}
              >
                Revenir à la connexion
              </button>
            </form>
          ) : (
            <form onSubmit={handleFormSubmit} className="flex flex-col gap-2">

              <ConnectGoogle />
              <ConnectMicrosoft />
              <div className="flex items-center gap-2">
                <div className="h-px w-full bg-line" />                
              </div>
              {etape === "email" && (
                <>
                  <Field>
                    <FieldLabel htmlFor="email" className="text-[13px]">
                      E-mail
                    </FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      autoFocus
                      autoComplete="email"
                      placeholder="Saisissez votre e-mail de connexion"
                      value={email}
                      onChange={handleChangeEmail}
                    />
                  </Field>

                  <Button
                    className="w-full text-background border border-lumenjuris"
                    disabled={submitLoading || !email}
                    type="submit"
                    size="lg"
                  >
                    <MailIcon className="h-4 w-4" />
                    Continuer avec l'email
                  </Button>
                </>
              )}

              {/* Le mot de passe n'apparaît qu'une fois l'adresse validée. */}
              {etape === "motDePasse" && (
                <>
                  <Field>
                    <FieldLabel htmlFor="password" className="text-[13px]">
                      Mot de passe
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoFocus
                        placeholder="Saisissez votre mot de passe"
                        value={password}
                        onChange={handleChangePassword}
                      />
                      <InputGroupAddon
                        align="inline-end"
                        onClick={() => setShowPassword(!showPassword)}
                        className="hover:cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOffIcon className="h-4 w-4" />
                        ) : (
                          <EyeIcon className="h-4 w-4" />
                        )}
                      </InputGroupAddon>
                    </InputGroup>
                  </Field>

                  <Button
                    className="w-full text-background border border-lumenjuris"
                    disabled={submitLoading || submitError || !password}
                    type="submit"
                    size="lg"
                  >
                    <LogInIcon className="h-4 w-4" />
                    Se connecter
                  </Button>

                                  <div className="flex items-center gap-2 rounded-xl border border-line-subtle bg-surface-subtle px-3 py-2">
                  <MailIcon className="h-4 w-4 shrink-0 text-ink-subtle" />
                  <span className="flex-1 truncate text-[13px] font-medium text-ink" title={email}>
                    {email}
                  </span>
                  <button
                    type="button"
                    onClick={handleChangerEmail}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-brand transition-colors hover:bg-white"
                  >
                    <PencilIcon className="h-3 w-3" />
                    Changer d'email
                  </button>
                </div>
                </>
              )}




              {/* CTA  forgotpassword && signup*/}
              <button
                type="button"
                className="w-fit self-center text-[12.5px] text-ink-muted underline-offset-2 transition-colors hover:text-brand hover:underline"
                onClick={() => setForgotPassword(true)}
              >
                Mot de passe oublié ?
              </button>

              <p className="text-center text-[12.5px] text-ink-muted">
                Pas encore de compte ?{" "}
                <button
                  type="button"
                  onClick={onSwitchToSignup}
                  className="font-semibold text-brand underline-offset-2 transition-colors hover:underline"
                >
                  Inscrivez-vous
                </button>
              </p>
            </form>
          )}
        </div>
      </AuthPanelShell>


      <TwoFactorCodeModal
        open={twoFactorModalOpen}
        email={twoFactorEmail}
        onVerify={handleTwoFactorVerify}
        onCancel={() => {
          void handleTwoFactorCancel();
        }}
      />
    </>
  );
};
