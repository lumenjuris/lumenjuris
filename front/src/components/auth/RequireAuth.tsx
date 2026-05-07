import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUserStore } from "../../store/userStore";

interface RequireAuthProps {
  children: ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const authStatus = useUserStore((state) => state.authStatus);
  const location = useLocation();

  if (authStatus === "idle" || authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Chargement…</div>
      </div>
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <Navigate to="/inscription" replace state={{ from: location.pathname }} />
    );
  }

  return <>{children}</>;
}
