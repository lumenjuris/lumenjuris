import { createContext, useState, useContext } from "react";

interface AuthContextValue {
  userRole: string | null;
  userVerified: boolean;
  userConnected: boolean;
  login: (role: string, verified: boolean, status: boolean) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthContextProvider = ({ children }: AuthProviderProps) => {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userVerified, setUserVerified] = useState(false);
  const [userConnected, setUserConnected] = useState(false);

  const login = (role: string, verified: boolean, status: boolean) => {
    setUserRole(role);
    setUserVerified(verified);
    setUserConnected(status);
  };

  const logout = () => {
    setUserConnected(false);
    setUserRole(null);
    setUserVerified(false);
  };

  return (
    <AuthContext.Provider
      value={{ userRole, userVerified, userConnected, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthContextProvider");
  return ctx;
};
