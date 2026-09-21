interface Props {
  /** Petit libellé en capitales au-dessus du titre (« ABONNEMENT », « AGENDA »…). */
  eyebrow: string;
  title: string;
  /** Contenu aligné à droite de l'en-tête : lien « Voir tout », compteur, badge… */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Coquille commune à tous les blocs de l'accueil : même arrondi, même bordure,
 * même en-tête (petit libellé en capitales + titre sérif).
 *
 * Elle existe pour que les blocs restent visuellement identiques sans recopier
 * la même dizaine de classes Tailwind dans chaque fichier.
 */
export function SectionCard({ eyebrow, title, headerRight, children }: Props) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-[#e8ebf3] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_18px_40px_-28px_rgba(16,24,40,0.35)]">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 px-5 pb-3.5 pt-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            {eyebrow}
          </span>
          <h2 className="font-serif text-[19px] font-normal leading-none text-ink">{title}</h2>
        </div>
        {headerRight}
      </div>

      {children}
    </section>
  );
}

/** Barres grises affichées pendant le chargement d'un bloc. */
export function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line-subtle px-5 py-5">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="h-9 animate-pulse rounded-lg bg-surface-subtle" />
      ))}
    </div>
  );
}
