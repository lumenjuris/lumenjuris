import { useSearchParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { MailOpen, HelpCircle, ShieldCheck } from "lucide-react";
import { fetchProxy } from "../utils/fetchProxy";



export const VerifyAccount = () => {
  const [searchParams] = useSearchParams();

  let reason = searchParams.get("reason");
  const navigate = useNavigate();

  useEffect(() => {
    if (!reason) {
      navigate("/dashboard");
    }
  }, [reason, navigate]);

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [email, setEmail] = useState("");

  const handleResend = async () => {
    console.log(email);
    setResent(true);
    const resendEmail = await fetchProxy("user/resend-verify", {
      headers: {
        "Content-type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        email,
      }),
    });
    const data = await resendEmail.json();

    setResending(data.success);

    setTimeout(() => {
      setResending(false);
      setResent(true);
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 ">
      <div className="max-w-md w-full text-center space-y-8 animate-fade-in ">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-yellow-50 flex items-center justify-center animate-pulse-slow">
            <ShieldCheck
              className="w-10 h-10 text-yellow-400"
              strokeWidth={1.5}
            />
          </div>
        </div>

        {/* Headline */}
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            La vérification de votre compte n'a pas abouti
          </h1>
          <p>
            Le lien de vérification a peut-être expiré, a déjà été utilisé, ou
            quelque chose d'inattendu s'est produit.
            <br />
            Pas d'inquiétude — votre compte est en sécurité.
          </p>
        </div>
        <div className="bg-green-100 border border-success/20 rounded-lg px-4 py-3">
          <p className="text-sm text-success-foreground">
            Cela arrive parfois. Vous pouvez réessayer tout de suite.
          </p>
        </div>

        {/* Actions ressend l'email */}

        <div className="space-y-3">
          <label htmlFor="email">Saisissez votre adresse email</label>
          <input
            type="email"
            placeholder="Email"
            id="email"
            name="email"
            className="border-2 w-full rounded-lg h-10 pl-4"
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            className="w-full h-10 gap-2 flex justify-center items-center border-2 p-2 rounded-lg font-semibold text-white bg-black"
            onClick={handleResend}
          >
            <MailOpen className="w-4 h-4" />
            {resending
              ? "Envoi en cours…"
              : resent
                ? "E-mail envoyé ! Vérifiez votre boîte"
                : "Envoyer un nouvel e-mail de vérification"}
          </button>
        </div>

        {/* Support link */}
        <p className="text-sm text-muted-foreground flex items-center justify-center">
          Toujours des difficultés &nbsp;
          <a
            href="/support"
            className="text-primary underline underline-offset-4 hover:text-primary/80 inline-flex items-center gap-1 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Contacter le support
          </a>
        </p>
      </div>
    </div>
  );
};
