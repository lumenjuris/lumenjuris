import logoBlanc from "../../assets/lumen-juris-logo-blanc.svg";
import logoFonce from "../../assets/lumen-juris-logo.svg";

/**
 * Logo officiel LumenJuris (fichiers fournis par Geoff, 150,38 × 34).
 * variant="dark"  → texte blanc (menu latéral, fonds sombres)
 * variant="light" → texte #0A2540 (fonds clairs, défaut)
 */
export function LumenJurisLogo({
  variant = "light",
  height = 36,
}: {
  variant?: "light" | "dark";
  height?: number;
}) {
  return (
    <img
      src={variant === "dark" ? logoBlanc : logoFonce}
      alt="Lumen Juris"
      height={height}
      width={Math.round(height * (150.38 / 34))}
    />
  );
}
