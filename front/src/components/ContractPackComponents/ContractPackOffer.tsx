import { Link } from "react-router-dom";
import { Check, Loader2, Lock, AlertCircle } from "lucide-react";
import { AVAILABLE_CONTRACT_PACK_DELIVERABLES, CONTRACT_PACK_PRICE } from "./contractPackConfig";

interface Props {
  /** Lance l'achat (enregistrement du contrat puis redirection vers Stripe). */
  onPurchase: () => void;
  /** Vrai pendant l'enregistrement et la création de la session de paiement. */
  loading: boolean;
  error: string | null;
}

/**
 * Proposition d'achat ponctuel du contrat en cours (« Pack Contrat Professionnel »).
 * Affichée uniquement quand le plan de l'utilisateur impose le filigrane : un
 * abonné qui exporte déjà sans filigrane ne la voit jamais.
 */
export function ContractPackOffer({ onPurchase, loading, error }: Props) {
  return (
    <section
      aria-labelledby="contract-pack-title"
      className="relative overflow-hidden rounded-card border border-line bg-white shadow-card"
    >
      {/* Filet doré discret : signature « qualité » de la charte */}
      <div aria-hidden className="h-px w-full bg-gradient-to-r from-transparent via-[#D6B266] to-transparent" />

      <div className="flex flex-col gap-5 p-5 sm:p-6 md:flex-row md:items-start md:justify-between md:gap-8">
        <div className="min-w-0 flex-1">
          <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
            Paiement unique
          </p>
          <h2 id="contract-pack-title" className="mt-1 font-serif text-2xl font-normal text-ink">
            Pack Contrat Professionnel
          </h2>
          <p className="mt-1.5 text-sm text-ink-muted">
            Récupérez ce contrat dans des formats prêts à l'emploi et conservez-le dans votre espace.
          </p>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {AVAILABLE_CONTRACT_PACK_DELIVERABLES.map((deliverable) => (
              <li key={deliverable.label} className="flex items-start gap-2 text-sm text-ink-secondary">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={1.75} />
                {deliverable.label}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs text-ink-muted">
            La version actuelle reste téléchargeable gratuitement en PDF, avec la mention « Généré par Lumen Juris ».
          </p>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-3 rounded-panel bg-surface-subtle p-4 md:w-72">
          <div>
            <p className="text-3xl font-semibold tabular-nums text-ink">
              {CONTRACT_PACK_PRICE} <span className="text-sm font-medium text-ink-muted">TTC</span>
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">par contrat</p>
          </div>

          <button
            type="button"
            onClick={onPurchase}
            disabled={loading}
            aria-busy={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:cursor-wait disabled:opacity-70"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Redirection vers le paiement…" : `Obtenir mon contrat – ${CONTRACT_PACK_PRICE}`}
          </button>

          <p className="text-xs font-medium text-ink-secondary">
            Paiement unique, sans abonnement ni engagement.
          </p>
          <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-ink-subtle">
            <Lock className="mt-px h-3 w-3 shrink-0" strokeWidth={1.75} />
            Paiement sécurisé par Stripe. Le contrat est enregistré dans votre contrathèque avant le paiement.
          </p>

          {error && (
            <p role="alert" className="flex items-start gap-1.5 text-xs text-danger">
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          <Link to="/souscription" className="text-2xs text-ink-muted underline underline-offset-2 hover:text-brand">
            Vous générez souvent des contrats ? Comparer avec les abonnements
          </Link>
        </div>
      </div>
    </section>
  );
}
