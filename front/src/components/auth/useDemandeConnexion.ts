import type { MouseEvent } from "react";

import { useUserStore } from "../../store/userStore";
import { useAuthPanelStore } from "../../store/authPanelStore";

/**
 * Retient le clic d'un visiteur sur un lien qui mène à une page réservée aux
 * comptes : plutôt que de le laisser atterrir sur une page qui le renverrait
 * aussitôt à l'accueil, on ouvre le panneau de connexion en mémorisant la
 * destination, et la navigation reprend une fois la connexion faite.
 *
 * Tant que la session est en cours de vérification, on laisse le lien agir
 * normalement : `RequireAuth` affiche alors son écran d'attente.
 *
 * Ce n'est qu'un confort de navigation. La protection des pages reste celle
 * de `RequireAuth` côté routes, et celle du serveur côté données.
 *
 * @example
 * ```tsx
 * const demanderConnexion = useDemandeConnexion();
 * <Link to="/contratheque" onClick={(e) => demanderConnexion(e, "/contratheque")}>
 * ```
 */
export function useDemandeConnexion() {
  const authStatus = useUserStore((state) => state.authStatus);
  const ouvrirConnexion = useAuthPanelStore((state) => state.ouvrirConnexion);

  return (event: MouseEvent<HTMLElement>, destination: string) => {
    if (authStatus !== "unauthenticated") return;

    event.preventDefault();
    ouvrirConnexion(destination);
  };
}
