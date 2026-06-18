/**
 * Logo officiel LumenJuris.
 * variant="dark"  → texte blanc (sidebar sombre)
 * variant="light" → texte #0A2540 (fond clair, défaut)
 */
export function LumenJurisLogo({
  variant = "light",
  height = 36,
}: {
  variant?: "light" | "dark";
  height?: number;
}) {
  const textColor = variant === "dark" ? "#ffffff" : "#0A2540";
  // viewBox recadré sur le contenu réel (cercle + texte) pour éliminer le vide
  // vertical : le logo remplit toute la hauteur demandée au lieu d'être noyé.
  const width = height * (200 / 36);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="22 20 200 36"
      width={width}
      height={height}
      aria-label="LumenJuris"
      role="img"
    >
      {/* Cercle extérieur */}
      <circle cx="34" cy="40" fill="none" r="9" stroke="#0D6EFD" strokeWidth="2" />
      {/* Point central */}
      <circle cx="34" cy="40" fill="#0D6EFD" r="4" />
      {/* Texte */}
      <text
        fill={textColor}
        fontFamily="Arial, sans-serif"
        fontSize="28"
        fontWeight="700"
        x="52"
        y="48"
      >
        Lumen Juris
      </text>
    </svg>
  );
}
