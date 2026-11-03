import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Check, Loader2, Lock, AlertCircle, X, Receipt, Download } from "lucide-react";
import { AVAILABLE_CONTRACT_PACK_DELIVERABLES, CONTRACT_PACK_PRICE } from "./contractPackConfig";

/**
 * Ce qui a ouvert la modale : le message s'adapte à l'intention de l'utilisateur.
 *  - `pdf`       : clic sur « Télécharger en PDF » (on propose aussi la version gratuite) ;
 *  - `docx`      : clic sur « Télécharger en Word » (format inclus dans le Pack) ;
 *  - `watermark` : clic sur « Retirer la mention » dans le document.
 */
export type ContractPackOfferReason = "pdf" | "docx" | "watermark";

const REASON_COPY: Record<ContractPackOfferReason, { eyebrow: string; subtitle: string }> = {
  pdf: {
    eyebrow: "Télécharger le contrat",
    subtitle: "Obtenez la version professionnelle, sans mention, ou téléchargez la version gratuite.",
  },
  docx: {
    eyebrow: "Export Word",
    subtitle: "Le format Word modifiable est inclus dans le Pack Contrat Professionnel.",
  },
  watermark: {
    eyebrow: "Version sans mention",
    subtitle: "Retirez la mention « Généré par Lumen Juris » et récupérez votre contrat dans tous les formats.",
  },
};

interface Props {
  /** null = modale fermée */
  reason: ContractPackOfferReason | null;
  onClose: () => void;
  /** Lance l'achat (enregistrement du contrat puis redirection vers Stripe). */
  onPurchase: () => void;
  /** Téléchargement gratuit avec la mention (proposé quand la modale vient du bouton PDF). */
  onDownloadFree?: () => void;
  /** Vrai pendant l'enregistrement et la création de la session de paiement. */
  loading: boolean;
  error: string | null;
}

/**
 * Modale d'achat ponctuel du contrat en cours (« Pack Contrat Professionnel »).
 * Ouverte au moment où l'utilisateur veut exporter son contrat, uniquement quand
 * son plan impose le filigrane : un abonné ne la voit jamais.
 */
export function ContractPackOffer({ reason, onClose, onPurchase, onDownloadFree, loading, error }: Props) {
  const purchaseButtonRef = useRef<HTMLButtonElement>(null);
  const isOpen = reason !== null;

  // Échap pour fermer, page figée derrière, focus sur l'action principale ; à la
  // fermeture, le focus revient sur le bouton qui a ouvert la modale.
  useEffect(() => {
    if (!isOpen) return;

    const triggerElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);
    purchaseButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
      triggerElement?.focus?.();
    };
  }, [isOpen, loading, onClose]);

  if (!reason || typeof document === "undefined") return null;

  const copy = REASON_COPY[reason];
  // Pendant la redirection vers Stripe, on ne laisse pas fermer la modale par accident
  const closeIfIdle = () => { if (!loading) onClose(); };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={closeIfIdle}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-pack-title"
        aria-describedby="contract-pack-subtitle"
        onClick={(event) => event.stopPropagation()}
        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl"
      >
        {/* En-tête navy premium : filet doré + halo discret (charte) */}
        <div className="relative overflow-hidden bg-brand px-6 pb-6 pt-7 text-white sm:px-8">
          <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D6B266] to-transparent" />
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(214,178,102,0.18),transparent_70%)]" />
          {/* Poignée du panneau mobile (ouvert depuis le bas de l'écran) */}
          <div aria-hidden className="mx-auto -mt-3 mb-4 h-1 w-10 rounded-full bg-white/25 sm:hidden" />

          <button
            type="button"
            onClick={closeIfIdle}
            aria-label="Fermer"
            className="absolute right-4 top-4 rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>

          <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-[#D6B266]">
            {copy.eyebrow}
          </p>
          <h2 id="contract-pack-title" className="mt-1.5 pr-8 font-serif text-2xl font-normal leading-tight">
            Pack Contrat Professionnel
          </h2>
          <p id="contract-pack-subtitle" className="mt-2 text-sm leading-relaxed text-white/70">
            {copy.subtitle}
          </p>

          <div className="mt-5 flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums">{CONTRACT_PACK_PRICE}</span>
            <span className="text-sm text-white/70">TTC · par contrat</span>
          </div>
          <p className="mt-1 text-xs font-medium text-white/80">Paiement unique, sans abonnement ni engagement.</p>
        </div>

        <div className="px-6 pb-6 pt-5 sm:px-8">
          <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">Inclus</p>
          <ul className="mt-3 space-y-2.5">
            {AVAILABLE_CONTRACT_PACK_DELIVERABLES.map((deliverable) => (
              <li key={deliverable.label} className="flex items-start gap-2.5 text-sm text-ink-secondary">
                <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-light">
                  <Check className="h-3 w-3 text-success" strokeWidth={2.5} />
                </span>
                {deliverable.label}
              </li>
            ))}
          </ul>

          {error && (
            <p role="alert" className="mt-5 flex items-start gap-2 rounded-panel border border-danger/20 bg-danger-light px-3 py-2.5 text-xs text-danger-dark">
              <AlertCircle className="mt-px h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              ref={purchaseButtonRef}
              type="button"
              onClick={onPurchase}
              disabled={loading}
              aria-busy={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover focus-visible:outline-none focus-visible:shadow-ring-brand disabled:cursor-wait disabled:opacity-70"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Redirection vers le paiement…" : `Obtenir mon contrat – ${CONTRACT_PACK_PRICE}`}
            </button>

            {reason === "pdf" && onDownloadFree ? (
              <button
                type="button"
                onClick={onDownloadFree}
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink-secondary transition hover:bg-surface-subtle disabled:opacity-60"
              >
                <Download className="h-4 w-4" strokeWidth={1.75} />
                Télécharger gratuitement, avec la mention
              </button>
            ) : (
              <button
                type="button"
                onClick={closeIfIdle}
                disabled={loading}
                className="w-full rounded-md px-4 py-2.5 text-sm font-medium text-ink-muted transition hover:bg-surface-subtle disabled:opacity-60"
              >
                Plus tard
              </button>
            )}
          </div>

          {/* Réassurance */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-line-subtle pt-4 text-2xs text-ink-subtle">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3 w-3" strokeWidth={1.75} /> Paiement sécurisé par Stripe
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Receipt className="h-3 w-3" strokeWidth={1.75} /> Facture envoyée par e-mail
            </span>
          </div>
          <p className="mt-3 text-center text-2xs text-ink-subtle">
            Vous générez souvent des contrats ?{" "}
            <Link to="/souscription" className="font-medium text-ink-muted underline underline-offset-2 hover:text-brand">
              Comparer avec les abonnements
            </Link>
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
