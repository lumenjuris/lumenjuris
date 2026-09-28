/**
 * Mise en forme du texte d'un contrat (titre, intertitres, paragraphes).
 * Partagée par l'éditeur de contrat et l'écran d'import d'un modèle, pour que
 * le passage de l'un à l'autre ne change ni la police, ni les tailles.
 */
export const CONTRACT_DOCUMENT_CLASS =
  "prose prose-sm max-w-none leading-relaxed text-ink-secondary focus:outline-none [&_:focus]:outline-none " +
  "[&_h2]:mb-4 [&_h2]:mt-0 [&_h2]:text-[26px] [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-ink " +
  "[&_h3]:mb-2 [&_h3]:mt-7 [&_h3]:flex [&_h3]:items-center [&_h3]:gap-2.5 [&_h3]:text-[11px] [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-[0.18em] [&_h3]:text-brand " +
  "[&_h3]:before:h-[2px] [&_h3]:before:w-6 [&_h3]:before:rounded-full [&_h3]:before:bg-brand [&_h3]:before:content-['']";

/** Cadre du document sous la barre d'outils (marges intérieures). */
export const CONTRACT_DOCUMENT_PADDING_CLASS = "relative min-h-[60vh] px-10 pb-10 pt-6";

/** Barre d'outils blanche collée en tête du contrat, qui reste visible au défilement. */
export const CONTRACT_TOOLBAR_CLASS =
  "sticky top-12 z-20 -mx-px -mt-px flex flex-wrap items-center gap-3 rounded-t-2xl border border-line border-b-line-subtle bg-white px-4 py-2.5";
