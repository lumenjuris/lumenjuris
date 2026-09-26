// UI //
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/InputGroup";
import { Field, FieldLabel } from "../ui/Field";
import { Checkbox } from "../ui/Checkbox";
import { CheckIcon, EyeOffIcon, EyeIcon, Loader2, PenBoxIcon } from "lucide-react";

import { AlertBanner } from "../common/AlertBanner";

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { AuthPanelShell } from "./AuthPanelShell";
import { ConnectGoogle } from "./ConnectGoogle";
import { ConnectMicrosoft } from "./ConnectMicrosoft";
import { ActivationParCode } from "./ActivationParCode";
import type { PresentationPanneau } from "../../store/authPanelStore";
import { useUserStore } from "../../store/userStore";
import { consommerDestination } from "../../utils/destinationApresConnexion";
import { fetchProxy } from "../../utils/fetchProxy";

const REGEX_EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

interface SignupFormProps {
  /** Referme le panneau : croix, clic à côté, touche Échap. */
  onClose: () => void;
  /** Bascule sur le panneau de connexion, depuis le pied du formulaire ou
   *  l'écran d'activation (compte déjà activé). */
  onSwitchToLogin: () => void;
  /** Carte sous le bouton de l'en-tête, ou fenêtre centrée sur fond flouté. */
  presentation: PresentationPanneau;
}

/**
 * Panneau de création de compte.
 *
 * Il met les connexions par fournisseur en premier — c'est le chemin le plus
 * court pour la plupart des gens — et ne déroule le formulaire qu'ensuite.
 *
 * Les règles du mot de passe sont montrées sous forme de liste qui se coche au
 * fil de la frappe, plutôt qu'en message d'erreur : l'utilisateur voit ce qui
 * lui reste à faire au lieu de découvrir un refus après coup.
 *
 * Une fois le compte créé, le formulaire cède la place à la saisie du code
 * d'activation reçu par e-mail, dans le même panneau. À la validation du code,
 * la session s'ouvre et l'utilisateur poursuit sa navigation.
 */
export const SignupForm = ({
  onClose,
  onSwitchToLogin,
  presentation,
}: SignupFormProps) => {
  // Adresse à laquelle le code d'activation vient de partir : tant qu'elle est
  // renseignée, l'écran de saisie du code remplace le formulaire.
  const [emailAVerifier, setEmailAVerifier] = useState<string | null>(null);

  const fetchUser = useUserStore((state) => state.fetchUser);
  const navigate = useNavigate();

  // Compte activé et session ouverte par /verify-code : on recharge l'utilisateur,
  // on ferme le panneau et on l'emmène là où il voulait aller (ou l'accueil).
  const handleCompteActive = async () => {
    await fetchUser();
    const destination = consommerDestination();
    onClose();
    navigate(destination ?? "/dashboard");
  };

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptCgu, setAcceptCgu] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [submitCguError, setSubmitCguError] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [serverErrorMessage, setServerErrorMessage] = useState("");

  // Tout ce qui se déduit de la saisie est calculé ici plutôt que gardé en
  // état : une seule source de vérité, et l'affichage suit la frappe sans
  // temporisation.
  const emailValide = REGEX_EMAIL.test(email);
  const criteresMotDePasse = [
    { libelle: "8 caractères minimum", rempli: password.length >= 8 },
    { libelle: "Une majuscule", rempli: /[A-Z]/.test(password) },
    { libelle: "Un chiffre", rempli: /[0-9]/.test(password) },
    { libelle: "Un caractère spécial", rempli: /[^a-zA-Z0-9]/.test(password) },
  ];
  const motDePasseValide = criteresMotDePasse.every((critere) => critere.rempli);
  const confirmationCorrespond = confirmPassword === password;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!lastName || !email || !password || !confirmPassword) {
      setSubmitError(true);
      return;
    }

    if (!acceptCgu) {
      setSubmitCguError(true);
      return;
    }

    // Adresse mal formée, mot de passe trop faible ou confirmation différente :
    // le défaut est déjà signalé sous le champ concerné, inutile d'ajouter une
    // bannière par-dessus.
    if (!emailValide || !motDePasseValide || !confirmationCorrespond) return;

    setSubmitLoading(true);
    setSubmitPending(true);
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
        return;
      }

      // Compte créé et e-mail parti : le panneau bascule sur l'écran de
      // vérification, qui dit où chercher le lien et permet de le renvoyer.
      setSubmitPending(false);
      setSubmitLoading(false);
      setEmailAVerifier(email);
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

  const feedback = (
    <div className="flex flex-col gap-3 empty:hidden">
      {submitError && (
        <AlertBanner
          title="Champs manquants !"
          variant="error"
          detail="Certains champs obligatoires sont manquants."
          onClose={() => setSubmitError(false)}
        />
      )}

      {submitCguError && (
        <AlertBanner
          title="CGU !"
          variant="error"
          detail="Vous devez accepter nos CGU."
          onClose={() => setSubmitCguError(false)}
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
    </div>
  );

  return (
    <AuthPanelShell
      id="signup-panel-title"
      titre={emailAVerifier ? "Activez votre compte" : "Créer un compte"}
      presentation={presentation}
      onClose={onClose}
      largeur={400}
    >
      {emailAVerifier ? (
        <ActivationParCode
          email={emailAVerifier}
          onModifier={() => setEmailAVerifier(null)}
          onActive={handleCompteActive}
          onSeConnecter={onSwitchToLogin}
        />
      ) : (
        <div className="flex flex-col gap-4">

          {/* Les messages (erreurs, envoi en cours) sont en tête du panneau :
              toujours visibles, sans pousser le bas du formulaire ni forcer un
              défilement. */}
          {feedback}

          {/* Le chemin le plus court d'abord : la plupart des gens s'arrêtent ici. */}
          <div className="flex flex-col gap-2">
            <ConnectGoogle />
            <ConnectMicrosoft />
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px w-full bg-line" />
            <span className="text-[11px] font-medium tracking-wide text-ink-subtle">
              OU
            </span>
            <div className="h-px w-full bg-line" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Nom et prénom tiennent sur une ligne : deux champs courts
                empilés allongeaient le formulaire pour rien. */}
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="lastname" className="text-[13px]">
                  Nom
                </FieldLabel>
                <Input
                  id="lastname"
                  type="text"
                  autoFocus
                  autoComplete="family-name"
                  placeholder="Dupond"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel
                  htmlFor="firstname"
                  className="flex items-baseline gap-1.5 text-[13px]"
                >
                  Prénom
                  <span className="text-[11px] font-normal text-ink-subtle">
                    facultatif
                  </span>
                </FieldLabel>
                <Input
                  id="firstname"
                  type="text"
                  autoComplete="given-name"
                  placeholder="Jenny"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value.trim())}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="signup-email" className="text-[13px]">
                E-mail
              </FieldLabel>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder="mail@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={email.length > 0 && !emailValide}
                className={
                  email.length > 0 && !emailValide
                    ? "border-destructive ring-1 ring-destructive"
                    : undefined
                }
              />
              {email.length > 0 && !emailValide && (
                <p className="text-[12px] text-destructive">
                  L'adresse e-mail n'est pas valide.
                </p>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="signup-password" className="text-[13px]">
                Mot de passe
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Choisissez un mot de passe"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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

              {/* La liste n'apparaît qu'à la première frappe (vide, elle
                  ressemblerait à une liste de reproches) et disparaît une fois
                  toutes les règles satisfaites : elle n'a plus rien à signaler. */}
              {password.length > 0 && !motDePasseValide && (
                <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                  {criteresMotDePasse.map((critere) => (
                    <li
                      key={critere.libelle}
                      className={`flex items-center gap-1.5 text-[11.5px] transition-colors ${
                        critere.rempli ? "text-success-dark" : "text-ink-subtle"
                      }`}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full transition-colors ${
                          critere.rempli
                            ? "bg-success text-white"
                            : "border border-line-emphasis"
                        }`}
                      >
                        {critere.rempli && <CheckIcon className="h-2.5 w-2.5" strokeWidth={3} />}
                      </span>
                      {critere.libelle}
                    </li>
                  ))}
                </ul>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="confirmpassword" className="text-[13px]">
                Confirmer le mot de passe
              </FieldLabel>
              <InputGroup
                className={
                  confirmPassword.length > 0 && !confirmationCorrespond
                    ? "border-destructive"
                    : undefined
                }
              >
                <InputGroupInput
                  id="confirmpassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Saisissez-le à nouveau"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <InputGroupAddon align="inline-end" className="gap-1.5">
                  {confirmPassword.length > 0 && confirmationCorrespond && (
                    <CheckIcon className="h-4 w-4 text-success" strokeWidth={2.5} />
                  )}
                  <span
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="hover:cursor-pointer"
                  >
                    {showConfirmPassword ? (
                      <EyeOffIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </span>
                </InputGroupAddon>
              </InputGroup>
              {confirmPassword.length > 0 && !confirmationCorrespond && (
                <p className="text-[12px] text-destructive">
                  Les deux mots de passe ne sont pas identiques.
                </p>
              )}
            </Field>

            {/* Toute la bande coche la case, pas seulement le petit carré.
                Un <label> ne conviendrait pas : la case de base-ui garde son
                <input> masqué, que le label viserait à la place du contrôle
                réellement affiché. */}
            <div
              onClick={() => setAcceptCgu(!acceptCgu)}
              className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line-subtle bg-surface-subtle px-3 py-2.5 transition-colors hover:border-line"
            >
              {/* La case gère déjà son propre clic et le clavier : sans cette
                  garde, le clic serait compté deux fois et s'annulerait. */}
              <span onClick={(event) => event.stopPropagation()}>
                <Checkbox
                  id="terms-checkbox-desc"
                  name="terms-checkbox-desc"
                  aria-label="J'accepte les conditions générales d'utilisation"
                  checked={acceptCgu}
                  defaultChecked={false}
                  onCheckedChange={(checked) => setAcceptCgu(Boolean(checked))}
                  className="mt-0.5 border-ring"
                />
              </span>

              <span className="text-[12px] leading-relaxed text-ink-secondary">
                J'accepte les{" "}
                <a
                  href="https://www.lumenjuris.com/conditions-generales-dutilisation/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-brand underline underline-offset-2"
                  onClick={(event) => event.stopPropagation()}
                >
                  conditions générales d'utilisation
                </a>{" "}
                de Lumen Juris.
              </span>
            </div>

            <Button
              className="w-full text-background border border-lumenjuris"
              disabled={submitLoading}
              type="submit"
              size="lg"
            >
              {submitLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PenBoxIcon className="h-4 w-4" />
              )}
              {submitLoading ? "Création en cours…" : "Créer mon compte"}
            </Button>

            <p className="text-center text-[12.5px] text-ink-muted">
              Déjà un compte ?{" "}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="font-semibold text-brand underline-offset-2 transition-colors hover:underline"
              >
                Se connecter
              </button>
            </p>
          </form>
        </div>
      )}
    </AuthPanelShell>
  );
};
