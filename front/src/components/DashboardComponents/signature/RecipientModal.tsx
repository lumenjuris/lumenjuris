import { useEffect, useRef, useState } from "react";
import { X, Send, AtSign, UserRound } from "lucide-react";
import { isValidEmail } from "./types";

interface Props {
  open: boolean;
  /** Valeurs déjà enregistrées — servent de point de départ à la saisie. */
  name: string;
  email: string;
  /** Couleur du cocontractant, pour rester cohérent avec ses zones sur le PDF. */
  accentHex: string;
  /** E-mail du compte connecté, rappelé comme expéditeur de la procédure. */
  senderEmail?: string;
  onClose: () => void;
  onConfirm: (recipient: { name: string; email: string }) => void;
}

/**
 * Modale « À qui envoyer le contrat ? », ouverte juste après que l'émetteur a
 * apposé sa signature.
 *
 * Elle reprend le gabarit de `SignatureModal` : une action à la fois, au
 * centre de l'écran. C'est la dernière information manquante avant l'envoi —
 * la demander dans un formulaire de la colonne de gauche obligeait à aller la
 * chercher, alors que tout le reste du parcours se joue sur le document.
 *
 * La saisie est locale : « Annuler » n'écrase pas ce qui était déjà
 * enregistré.
 */
export function RecipientModal({
  open, name, email, accentHex, senderEmail, onClose, onConfirm,
}: Props) {
  const [draftName, setDraftName] = useState(name);
  const [draftEmail, setDraftEmail] = useState(email);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  // À chaque ouverture on repart des valeurs enregistrées et on place le
  // curseur dans le premier champ.
  useEffect(() => {
    if (!open) return;
    setDraftName(name);
    setDraftEmail(email);
    nameInputRef.current?.focus();
  }, [open, name, email]);

  // Échap ferme la modale, comme les autres modales de l'application.
  useEffect(() => {
    if (!open) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  const trimmedName = draftName.trim();
  const trimmedEmail = draftEmail.trim();
  const canConfirm = !!trimmedName && isValidEmail(trimmedEmail);
  // Message d'erreur affiché seulement une fois quelque chose saisi, pour ne
  // pas accueillir l'utilisateur par un avertissement.
  const emailLooksWrong = trimmedEmail.length > 0 && !isValidEmail(trimmedEmail);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canConfirm) return;
    onConfirm({ name: trimmedName, email: trimmedEmail });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      style={{ animation: "fadeIn 0.15s ease-out" }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        style={{ animation: "scaleIn 0.2s ease-out" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: accentHex + "20" }}
            >
              <Send className="w-4 h-4" style={{ color: accentHex }} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                À qui envoyer le contrat ?
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Votre signature est enregistrée — dernière étape avant l'envoi.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-gray-300 hover:text-gray-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Champs */}
        <div className="px-6 py-5 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-gray-600">
              Nom du cocontractant
            </span>
            <div className="relative">
              <UserRound className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={nameInputRef}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Jean Dupont"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-2.5 text-sm text-gray-800 outline-none focus:border-gray-300 focus:bg-white transition"
              />
            </div>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-gray-600">
              Adresse e-mail
            </span>
            <div className="relative">
              <AtSign className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={draftEmail}
                onChange={(e) => setDraftEmail(e.target.value)}
                placeholder="jean.dupont@exemple.com"
                type="email"
                className={`w-full rounded-lg border bg-gray-50 pl-9 pr-3 py-2.5 text-sm text-gray-800 outline-none focus:bg-white transition ${
                  emailLooksWrong
                    ? "border-danger/40 focus:border-danger/60"
                    : "border-gray-200 focus:border-gray-300"
                }`}
              />
            </div>
            <span className="block text-[11px] h-3.5 text-danger-dark">
              {emailLooksWrong ? "Cette adresse e-mail semble incomplète." : ""}
            </span>
          </label>

          <p className="text-[11px] text-gray-400 leading-relaxed">
            Il recevra un e-mail l'invitant à signer à son tour
            {senderEmail ? (
              <>
                , envoyé au nom de votre compte{" "}
                <span className="font-semibold text-gray-500 break-all">{senderEmail}</span>,
                avec une copie pour vous
              </>
            ) : null}
            .
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!canConfirm}
            className="px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            style={{ backgroundColor: accentHex }}
          >
            Continuer
          </button>
        </div>

        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.94); }
            to   { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </form>
    </div>
  );
}
