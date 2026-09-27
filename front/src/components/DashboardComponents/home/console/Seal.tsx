/**
 * Sceau doré : petit motif de marque (anneaux concentriques + point central,
 * en écho au logo). Utilisé en filigrane dans les en-têtes de la console.
 * La couleur est héritée via `currentColor`.
 */
export function Seal({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <circle cx="20" cy="20" r="13.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="9" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" opacity="0.7" />
      <circle cx="20" cy="20" r="5" fill="currentColor" />
    </svg>
  );
}
