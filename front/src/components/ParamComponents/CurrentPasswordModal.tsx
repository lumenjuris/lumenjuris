import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { EyeIcon, EyeOffIcon, ShieldCheck } from "lucide-react";

import { Button } from "../ui/Button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "../ui/InputGroup";
import { Field, FieldLabel } from "../ui/Field";

interface Props {
  open: boolean;
  /** Vrai pendant l'envoi de la requête de changement. */
  loading: boolean;
  /** Message d'erreur renvoyé par le serveur (mot de passe actuel incorrect…). */
  error: string | null;
  onCancel: () => void;
  /** Confirme avec le mot de passe actuel saisi. */
  onConfirm: (currentPassword: string) => void;
}

/**
 * Demande le mot de passe actuel avant de valider un changement de mot de
 * passe. C'est la ré-authentification qui empêche qu'un simple accès à une
 * session ouverte suffise à remplacer le mot de passe du compte.
 *
 * Le nouveau mot de passe est déjà saisi dans le formulaire : cette fenêtre ne
 * demande que le mot de passe actuel, puis renvoie la valeur au parent qui
 * lance la requête.
 *
 * Volontairement bâtie sur un portail simple (comme `ConfirmationModal`) et non
 * sur le Dialog base-ui : ici on veut une fermeture pilotée uniquement par la
 * prop `open`, sans dépendre du cycle interne du composant.
 */
export function CurrentPasswordModal({
  open,
  loading,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // À chaque ouverture, on repart d'un champ vide : on ne garde pas un mot de
  // passe saisi lors d'une tentative précédente. Échap referme.
  useEffect(() => {
    if (!open) return;

    setCurrentPassword("");
    setShowPassword(false);

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onCancel();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, loading, onCancel]);

  if (!open || typeof document === "undefined") return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentPassword || loading) return;
    onConfirm(currentPassword);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="current-password-modal-title"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <h3
              id="current-password-modal-title"
              className="flex items-center gap-2 text-[15px] font-semibold text-ink"
            >
              <ShieldCheck className="h-4 w-4 text-brand" />
              Confirmer votre identité
            </h3>
            <p className="text-[12.5px] leading-relaxed text-ink-muted">
              Pour votre sécurité, saisissez votre mot de passe actuel avant
              d'enregistrer le nouveau.
            </p>
          </div>

          <Field>
            <FieldLabel htmlFor="current-password" className="text-[13px]">
              Mot de passe actuel
            </FieldLabel>
            <InputGroup className={error ? "border-destructive" : undefined}>
              <InputGroupInput
                id="current-password"
                type={showPassword ? "text" : "password"}
                autoFocus
                autoComplete="current-password"
                placeholder="Votre mot de passe actuel"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
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
            {error && <p className="text-[12px] text-destructive">{error}</p>}
          </Field>

          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="bg-[#1e3a5f] hover:bg-[#152a45] text-white"
              disabled={!currentPassword || loading}
            >
              {loading ? "Enregistrement…" : "Confirmer"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
