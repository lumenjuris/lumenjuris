import SignupForm from "../components/auth/SignupForm";
import LoginForm from "../components/auth/LoginForm";
import MainHeader from "../components/MainHeader/MainHeader";
import { useUserStore } from "../store/userStore";

// UI //
import { Button } from "../components/ui/Button";

import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

export function Inscription() {
  const [isLoginOnScreen, setIsLoginOnScreen] = useState(true);

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [siren, setSiren] = useState("");
  const [acceptCgu, setAcceptCgu] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const { isConnected: userConnected } = useUserStore();

  return userConnected ? (
    <Navigate to="/dashboard" />
  ) : (
    <>
      <MainHeader />

      <div className="bg-lumenjuris-background min-h-[calc(100vh-64px)] w-screen">
        <div className="w-[420px] mx-auto pt-12">
          <div className="w-full border border-border px-4 py-7 rounded-xl flex flex-col gap-5 bg-background">
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
                <LoginForm
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  forgotPassword={forgotPassword}
                  setForgotPassword={setForgotPassword}
                  emailSent={emailSent}
                  setEmailSent={setEmailSent}
                />
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
                  siren={siren}
                  setSiren={setSiren}
                  acceptCgu={acceptCgu}
                  setAcceptCgu={setAcceptCgu}
                />
              )}
            </>
          </div>
        </div>
      </div>
    </>
  );
}
