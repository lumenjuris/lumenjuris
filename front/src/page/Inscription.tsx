import SignupForm from "../components/auth/SignupForm";

import { useState } from "react";

export function Inscription() {
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [siren, setSiren] = useState("");
  const [acceptCgu, setAcceptCgu] = useState(false);

  return (
    <>
      <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10"></header>
      <div className="bg-lumenjuris-background min-h-[calc(100vh-64px)]">
        <div className="w-[800px] mx-auto pt-10 flex flex-col items-center gap-5">
          <h1>Créez un compte</h1>
          <SignupForm />
        </div>
      </div>
    </>
  );
}
