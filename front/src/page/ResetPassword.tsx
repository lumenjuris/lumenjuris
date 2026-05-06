import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import {
  KeyRound,
  EyeIcon,
  EyeOffIcon,
  HelpCircle,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { fetchProxy } from "../utils/fetchProxy";




type ViewState = "form" | "success" | "error";

const ERROR_MESSAGES: Record<string, { title: string; detail: string }> = {
  invalid: {
    title: "Lien invalide",
    detail: "Ce lien de réinitialisation n'existe pas ou a été altéré.",
  },
  "already-used": {
    title: "Lien déjà utilisé",
    detail:
      "Ce lien a déjà été utilisé. Effectuez une nouvelle demande depuis la page de connexion.",
  },
  expired: {
    title: "Lien expiré",
    detail:
      "Ce lien n'est valide que 15 minutes. Effectuez une nouvelle demande depuis la page de connexion.",
  },
  server: {
    title: "Erreur serveur",
    detail:
      "Une erreur inattendue s'est produite. Réessayez dans quelques instants.",
  },
};

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token");
  const reason = searchParams.get("reason");

  const [view, setView] = useState<ViewState>("form");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const passwordErrorTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    if (!token && !reason) {
      navigate("/inscription");
    }
    if (reason) {
      setView("error");
    }
  }, [token, reason, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError("");

    if (password !== confirmPassword) {
      setConfirmError("Les mots de passe ne sont pas identiques.");
      return;
    } else {
      setSubmitLoading(true);
      try {
        const response = await fetchProxy("/api/user/resetpassword", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
          credentials: "include",
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          setServerError(
            data.message || "Une erreur est survenue, veuillez réessayer.",
          );
        } else {
          setView("success");
        }
      } catch {
        setServerError("Une erreur est survenue, veuillez réessayer.");
      } finally {
        setSubmitLoading(false);
      }
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
      setConfirmError("Les mots de passes doivent-être identiques !");
    } else if (value.length >= 8 && value === password) {
      setConfirmError("");
    }
  };

  const errorInfo = reason
    ? (ERROR_MESSAGES[reason] ?? ERROR_MESSAGES["invalid"])
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-8 animate-fade-in">
        {/* ── VUE ERREUR ── */}
        {view === "error" && errorInfo && (
          <>
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center animate-pulse-slow">
                <ShieldAlert
                  className="w-10 h-10 text-red-400"
                  strokeWidth={1.5}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                {errorInfo.title}
              </h1>
              <p className="text-muted-foreground">{errorInfo.detail}</p>
            </div>

            <div className="space-y-3">
              <Link
                to="/inscription"
                className="w-full h-10 gap-2 flex justify-center items-center border-2 p-2 rounded-lg font-semibold text-white bg-black hover:bg-black/80 transition-colors"
              >
                Retour à la connexion
              </Link>
            </div>

            <p className="text-sm text-muted-foreground flex items-center justify-center">
              Toujours des difficultés ?&nbsp;
              <a
                href="/support"
                className="text-primary underline underline-offset-4 hover:text-primary/80 inline-flex items-center gap-1 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Contacter le support
              </a>
            </p>
          </>
        )}

        {/* ── VUE FORMULAIRE ── */}
        {view === "form" && token && (
          <>
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-violet-50 flex items-center justify-center">
                <KeyRound
                  className="w-10 h-10 text-violet-400"
                  strokeWidth={1.5}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Nouveau mot de passe
              </h1>
              <p className="text-muted-foreground">
                Choisissez un mot de passe sécurisé pour votre compte Lumen
                Juris.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              {/* Password */}
              <div className="space-y-1">
                <label htmlFor="password" className="text-sm font-medium">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Choisissez un mot de passe"
                    value={password}
                    onChange={handleChangePassword}
                    className={`border-2 w-full rounded-lg h-10 pl-4 pr-10 ${passwordError ? "border-red-400" : "border-border"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOffIcon className="w-4 h-4" />
                    ) : (
                      <EyeIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-xs text-red-500">{passwordError}</p>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-1">
                <label
                  htmlFor="confirm-password"
                  className="text-sm font-medium"
                >
                  Confirmer le mot de passe
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirmez votre mot de passe"
                    value={confirmPassword}
                    onChange={handleChangeConfirmPassword}
                    className={`border-2 w-full rounded-lg h-10 pl-4 pr-10 ${confirmError ? "border-red-400" : "border-border"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? (
                      <EyeOffIcon className="w-4 h-4" />
                    ) : (
                      <EyeIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {confirmError && (
                  <p className="text-xs text-red-500">{confirmError}</p>
                )}
              </div>

              {serverError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-red-600">{serverError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitLoading}
                className="w-full h-10 gap-2 flex justify-center items-center border-2 p-2 rounded-lg font-semibold text-white bg-black hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitLoading
                  ? "Enregistrement…"
                  : "Enregistrer le nouveau mot de passe"}
              </button>
            </form>
          </>
        )}

        {/* ── VUE SUCCÈS ── */}
        {view === "success" && (
          <>
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2
                  className="w-10 h-10 text-green-500"
                  strokeWidth={1.5}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Mot de passe mis à jour !
              </h1>
              <p className="text-muted-foreground">
                Votre mot de passe a été réinitialisé avec succès. Vous pouvez
                maintenant vous connecter.
              </p>
            </div>

            <div className="bg-green-100 border border-green-200 rounded-lg px-4 py-3">
              <p className="text-sm text-green-800">
                Pour des raisons de sécurité, ce lien de réinitialisation n'est
                plus utilisable.
              </p>
            </div>

            <Link
              to="/inscription"
              className="w-full h-10 gap-2 flex justify-center items-center border-2 p-2 rounded-lg font-semibold text-white bg-black hover:bg-black/80 transition-colors"
            >
              Se connecter
            </Link>
          </>
        )}
      </div>
    </div>
  );
};
