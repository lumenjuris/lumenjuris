import { ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUserStore } from "../../store/userStore";
import { useAuthPanelStore } from "../../store/authPanelStore";

interface RequireAuthProps {
  children: ReactNode;
}

/**
 * Fonction de sécurisation des routes protègeant contre les accès non authentifiés.
 * À placer en tant que wrapper autour des `<Route>` ou des pages à protéger.
 *
 * **Comportement selon `authStatus`** :
 * - `"idle"` / `"loading"` → affiche un écran de chargement plein écran pour
 *   éviter le flash de la page de connexion pendant la vérification du cookie JWT.
 * - `"unauthenticated"` → ramène à l'accueil, qui est public, et ouvre le
 *   panneau de connexion en mémorisant la page demandée : une fois connecté,
 *   l'utilisateur y est emmené directement. Sans cela, une URL saisie à la
 *   main ou un lien partagé renvoyait à l'accueil sans la moindre explication.
 * - `"authenticated"` → rend `children` normalement.
 *
 * @example
 * ```tsx
 * <Route
 *   path="/dashboard"
 *   element={
 *     <RequireAuth>
 *       <Dashboard />
 *     </RequireAuth>
 *   }
 * />
 * ```
 *
 * @param children Contenu à afficher si l'utilisateur est authentifié.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const authStatus = useUserStore((state) => state.authStatus);
  const ouvrirConnexion = useAuthPanelStore((state) => state.ouvrirConnexion);
  const location = useLocation();
  const destination = location.pathname + location.search;

  useEffect(() => {
    if (authStatus === "unauthenticated") ouvrirConnexion(destination);
  }, [authStatus, destination, ouvrirConnexion]);

  if (authStatus === "idle" || authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Chargement…</div>
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
