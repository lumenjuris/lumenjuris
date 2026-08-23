import { X, Sparkles, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";

/**
 * Carte modale affichée quand un plafond de formule est atteint (contrathèque
 * pleine, quota épuisé...). Persistante (pas d'auto-fermeture) : l'utilisateur la
 * ferme via la croix / "Plus tard", ou clique "Voir les formules" -> /souscription.
 *
 * @param title    Titre court (ex : "Contrathèque pleine").
 * @param message  Explication + incitation à changer de formule.
 * @param onClose  Ferme la carte.
 */
export function QuotaLimitModal({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Liseré de marque en haut */}
        <div className="h-1.5 w-full bg-gradient-to-r from-brand via-brand/60 to-brand" />

        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-4 top-4 rounded-full p-1.5 text-ink-subtle transition-colors hover:bg-slate-100 hover:text-ink"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="px-8 py-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-light">
            <Lock className="h-8 w-8 text-brand" />
          </div>

          <h2 className="text-xl font-bold text-ink">{title}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
            {message}
          </p>

          <div className="mt-7 flex flex-col gap-2.5">
            <Button
              type="button"
              onClick={() => navigate("/souscription")}
              className="w-full gap-2 bg-brand text-white shadow-sm hover:bg-brand-hover"
            >
              <Sparkles className="h-4 w-4" />
              Voir les formules
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="w-full text-ink-muted hover:bg-slate-100"
            >
              Plus tard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
