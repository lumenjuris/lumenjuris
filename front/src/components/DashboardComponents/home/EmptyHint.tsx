/**
 * Message d'état vide, identique dans tous les blocs de l'accueil.
 *
 * Une seule ligne courte, alignée à gauche et volontairement plus discrète que
 * le contenu réel, pour que les blocs vides ne fassent pas de bruit visuel.
 */
export function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-t border-line-subtle px-5 py-3.5 text-[12.5px] text-ink-subtle">
      {children}
    </p>
  );
}
