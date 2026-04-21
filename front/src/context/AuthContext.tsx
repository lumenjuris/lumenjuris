import { createContext, useState, useContext } from "react";

<<<<<<< HEAD
interface AuthContextValue {
  userRole: string | null;
=======
// type UserInfoProfile = {
//   email: string;
//   nom: string;
//   prenom?: string;
//   role: "USER" | "ADMIN";
//   isVerified: boolean;
// };

interface AuthContextValue {
  //   userInfo: UserInfoProfile | null;
  userRole: string;
>>>>>>> main
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
<<<<<<< HEAD
  const [userRole, setUserRole] = useState<string | null>(null);
=======
  //   const [userInfo, setUserInfo] = useState<UserInfoProfile | null>(null);
  const [userRole, setUserRole] = useState("");
>>>>>>> main
  const [userVerified, setUserVerified] = useState(false);
  const [userConnected, setUserConnected] = useState(false);

  const login = (role: string, verified: boolean, status: boolean) => {
    setUserRole(role);
    setUserVerified(verified);
    setUserConnected(status);
  };

  const logout = () => {
    setUserConnected(false);
<<<<<<< HEAD
    setUserRole(null);
    setUserVerified(false);
=======
>>>>>>> main
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
