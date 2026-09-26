import { SignupForm } from "../components/auth/SignupForm";
import { LoginForm } from "../components/auth/LoginForm";
import { VerifierBoiteMail } from "../components/auth/VerifierBoiteMail";
import { MainHeader } from "../components/MainHeader/MainHeader";
import { useUserStore } from "../store/userStore";
import { PENDING_CHECKOUT_KEY } from "../utils/planMapping";

// UI //
import { Button } from "../components/ui/Button";

import { useState } from "react";
import { Navigate } from "react-router-dom";


/**
 * Ancienne version du système d'authentification. 
 * Page entière avec double vue pour connection/inscription
 * Cette page a été retiré pour avoir quelque chose de plus subtil et moin lourd pour l'ergonomie des 
 * utilisateurs.
 */
export function Inscription() {
  const [isLoginOnScreen, setIsLoginOnScreen] = useState(true);

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptCgu, setAcceptCgu] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  // Adresse à laquelle l'e-mail de vérification vient d'être envoyé : tant
  // qu'elle est renseignée, l'écran « Vérifiez votre boîte mail » remplace le
  // formulaire.
  const [emailAVerifier, setEmailAVerifier] = useState<string | null>(null);

  const authStatus = useUserStore((state) => state.authStatus);

  if (authStatus === "idle" || authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Chargement…</div>
      </div>
    );
  }

  // Si un plan a été choisi avant l'inscription, on renvoie l'utilisateur
  // fraîchement connecté vers la page des offres pour y reprendre le paiement.
  if (authStatus === "authenticated") {
    const hasPendingCheckout = !!sessionStorage.getItem(PENDING_CHECKOUT_KEY);
    return (
      <Navigate to={hasPendingCheckout ? "/souscription" : "/dashboard"} replace />
    );
  }

  // À ce stade, l'utilisateur n'est pas authentifié : on affiche le formulaire.
  return (
    <>
      <MainHeader />

      <div className="bg-lumenjuris-background min-h-[calc(100vh-48px)] w-full">
        <div className="w-full max-w-[420px] mx-auto px-4 pt-12">
          <div className="w-full border border-border px-4 py-7 rounded-xl flex flex-col gap-5 bg-background">
            {emailAVerifier ? (
              <VerifierBoiteMail
                email={emailAVerifier}
                onModifier={() => setEmailAVerifier(null)}
                onSeConnecter={() => {
                  setEmailAVerifier(null);
                  setPassword("");
                  setConfirmPassword("");
                  setIsLoginOnScreen(true);
                }}
              />
            ) : (<>
              <section className="w-full flex items-center justify-between">
                <div className="w-44 flex flex-col items-center gap-1">
                  <Button
                    variant="default"
                    size="lg"
                    className="w-full bg-lumenjuris-background text-lumenjuris hover:text-white hover:bg-primary/90 disabled:bg-primary disabled:text-white disabled:opacity-80"
                    disabled={isLoginOnScreen ? true : false}
                    onClick={() => {
                      setIsLoginOnScreen(true);
                    }}
                  >
                    Connectez-vous
                  </Button>
                </div>

                <div className="w-44 flex flex-col items-center gap-1">
                  <Button
                    variant="default"
                    size="lg"
                    className="w-full bg-lumenjuris-background text-lumenjuris hover:text-white hover:bg-primary/90 disabled:bg-primary disabled:text-white disabled:opacity-80"
                    disabled={isLoginOnScreen ? false : true}
                    onClick={() => {
                      setIsLoginOnScreen(false);
                    }}
                  >
                    Inscrivez-vous
                  </Button>
                </div>
              </section>
              <div className="w-full h-px bg-border"></div>
              <>
                {isLoginOnScreen ? (
                  <LoginForm />
                ) : (
                  <SignupForm
                    lastName={lastName}
                    setLastName={setLastName}
                    firstName={firstName}
                    setFirstName={setFirstName}
                    email={email}
                    setEmail={setEmail}
                    password={password}
                    setPassword={setPassword}
                    acceptCgu={acceptCgu}
                    setAcceptCgu={setAcceptCgu}
                    confirmPassword={confirmPassword}
                    setConfirmPassword={setConfirmPassword}
                    onInscrit={setEmailAVerifier}
                  />
                )}
              </>
            </>)}
          </div>
        </div>
      </div>
    </>
  );
}
