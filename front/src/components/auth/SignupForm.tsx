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
  acceptCgu: boolean;
  setAcceptCgu: React.Dispatch<React.SetStateAction<boolean>>;
  confirmPassword: string;
  setConfirmPassword: React.Dispatch<React.SetStateAction<string>>;
  /** Compte créé et e-mail de vérification parti : la page affiche l'écran « Vérifiez votre boîte mail ». */
  onInscrit?: (email: string) => void;
}

const PROXY_URL: string =
  import.meta.env.VITE_URL_PROXY || "http://localhost:3000";

/**
 * Formulaire d'inscription gérant deux flux de création de compte :
 *
 * 1. **Email / mot de passe** — `POST /api/user/signup` avec nom, prénom, email,
 *    mot de passe et CGU. Les données entreprise ne sont plus demandées ici :
 *    elles sont renseignées depuis le profil une fois le compte actif.
 *    En cas de succès, affiche une alerte de confirmation avec l'adresse email
 *    utilisée, puis remet tous les champs à zéro.
 *
 * 2. **Google OAuth** — redirige `window.location` vers `PROXY_URL/api/google`.
 *
 * @param lastName     Valeur contrôlée du champ nom (obligatoire).
 * @param setLastName  Setter du champ nom.
 * @param firstName    Valeur contrôlée du champ prénom (optionnel).
 * @param setFirstName Setter du champ prénom.
 * @param email        Valeur contrôlée du champ email (obligatoire).
 * @param setEmail     Setter du champ email.
 * @param password     Valeur contrôlée du champ mot de passe (obligatoire).
 * @param setPassword  Setter du champ mot de passe.
 * @param acceptCgu    `true` si l'utilisateur a coché les CGU (obligatoire pour soumettre).
 * @param setAcceptCgu Setter de l'état d'acceptation des CGU.
 */
const SignupForm = ({
  lastName,
  setLastName,
  firstName,
  setFirstName,
  email,
  setEmail,
  password,
  setPassword,
  acceptCgu,
  setAcceptCgu,
  confirmPassword,
  setConfirmPassword,
  onInscrit,
}: SignupFormProps) => {
 

  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [submitError, setSubmitError] = useState(false);
  const [submitCguError, setSubmitCguError] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [serverError, setServerError] = useState(false);
  const [serverErrorMessage, setServerErrorMessage] = useState("");

  const passwordErrorTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Les messages sont rendus sous le bouton d'inscription : on amene ce bloc
  // dans le champ de vision plutot que le haut du formulaire, sinon la reponse
  // s'affiche hors ecran juste apres le clic.
  const feedbackRef = useRef<HTMLDivElement>(null);
  const scrollToFeedback = () => {
    // Laisse React peindre l'alerte avant de la faire defiler.
    requestAnimationFrame(() => {
      feedbackRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!lastName || !email || !password) {
      setSubmitError(true);
      scrollToFeedback();
      return;
    }
    if (acceptCgu === false) {
      setSubmitCguError(true);
      scrollToFeedback();
      return;
    }

    if (password !== confirmPassword) {
        setConfirmPasswordError("Les mots de passe doivent être identiques");
        return;
    }

    if (passwordError) {
      return;
    }

    setSubmitLoading(true);
    setSubmitPending(true);
    scrollToFeedback();
    const trimedLastName = lastName.trim();
    const trimedFirstName = firstName.trim();

    try {
      const signupResponse = await fetchProxy("/api/user/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          nom: trimedLastName,
          prenom: trimedFirstName,
          password,
          cgu: acceptCgu,
        }),
        credentials: "include",
      });

      // Une reponse non-JSON (page d'erreur, proxy coupe) ne doit pas partir en
      // exception : sans ce garde-fou l'utilisateur ne voyait qu'un message
      // generique de creation impossible.
      const data = await signupResponse.json().catch(() => null);

      if (!signupResponse.ok) {
        setSubmitPending(false);
        setServerError(true);
        // Le limiteur d'inscriptions repond dans "error", les autres routes
        // dans "message" : sans les deux, la banniere s'affichait vide.
        setServerErrorMessage(
          data?.message ||
            data?.error ||
            (signupResponse.status === 429
              ? "Trop de tentatives d'inscription. Réessayez dans une heure."
              : "Une erreur s'est produite, nous n'avons pas pu créer votre compte..."),
        );
        // Le bouton doit redevenir cliquable : l'utilisateur a une correction a
        // faire (adresse deja prise, mot de passe trop court) et doit pouvoir
        // resoumettre sans avoir a fermer la banniere au prealable.
        setSubmitLoading(false);
        scrollToFeedback();
        return;
      }

      if (data?.mailSent === false) {
        // Compte créé mais e-mail non parti : on affiche le message du serveur
        // plutôt qu'une confirmation d'envoi, pour que l'utilisateur sache
        // qu'il doit passer par le renvoi.
        setSubmitPending(false);
        setServerError(true);
        setServerErrorMessage(data.message);
        setSubmitLoading(false);
      } else if (onInscrit) {
        setSubmitPending(false);
        setSubmitLoading(false);
        onInscrit(email);
        return;
      } else {
        setSubmitPending(false);
        setSubmitSuccess(true);
        // Le serveur distingue l'envoi confirme de l'envoi encore en cours :
        // on reprend son message plutot que d'affirmer un envoi abouti.
        setSuccessMessage(
          data?.message ||
            `Votre compte a été créé. Un email de vérification a été envoyé à ${email}. Veuillez vérifier votre boîte de réception et vos spams.`,
        );
      }
      scrollToFeedback();
    } catch (error) {
      setSubmitPending(false);
      setSubmitLoading(false);
      setServerError(true);
      setServerErrorMessage(
        "Une erreur s'est produite, nous n'avons pas pu créer votre compte...",
      );
      console.error("🛑🛑🛑 ERREUR SERVEUR INSCRIPTION", error);
    }
  };





  // Inscription via Google
  const handleSubmitGoogle = async() => {
    await fetchProxy(`${PROXY_URL}/api/user/auth/google`);
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
      setEmailError("L'adresse e-mail n'est pas valide");
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
      setConfirmPasswordError("Les mots de passe doivent être identiques !");
    } else if (value.length >= 8 && value === password) {
      setConfirmPasswordError("");
    }
  };

  const handleCheckCgu = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.checked;
    setAcceptCgu(value);
  };

  // Bloc de retour affiche sous le bouton d'inscription (voir plus bas dans le
  // formulaire) : la reponse apparait la ou l'utilisateur vient de cliquer.
  const feedback = (
    <div ref={feedbackRef} className="flex flex-col gap-3 empty:hidden">
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
          detail="Vous devez accepter nos CGU."
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
      {submitPending && (
        <AlertBanner
          title="Inscription en cours…"
          variant="info"
          detail={`Création de votre compte et envoi de l'email de vérification à ${email}.`}
          duration={0}
          onClose={() => setSubmitPending(false)}
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
            setAcceptCgu(false);
          }}
        />
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
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
                    target="_blank"
                    rel="noopener noreferrer"
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

          <div className="grid gap-3">
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

            {feedback}

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
              S'inscrire avec Google
            </button>
          </div>
        </section>
      </form>
    </div>
  );
};

export default SignupForm;
