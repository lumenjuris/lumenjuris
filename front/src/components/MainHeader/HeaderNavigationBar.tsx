// UI //
import {
  LogInIcon,
  FileCheckIcon,
  User,
  ScatterChartIcon,
  Bell,
  ChevronDown,
  LayoutDashboard,
  LogOutIcon,
} from "lucide-react";
import { Button } from "../ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/DropDownMenu";

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

import { useAuth } from "../../context/AuthContext";

interface HeaderNavBarProps {
  onNavClick?: () => void;
}

type UserDataProfile = {
  email: string;
  nom: string;
  prenom?: string;
  role: "USER" | "ADMIN";
  isVerified: boolean;
};

const HeaderNavigationBar = ({ onNavClick }: HeaderNavBarProps) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { login, logout } = useAuth();

  const [isConnected, setIsConnected] = useState(false);
  const [userData, setUserData] = useState({} as UserDataProfile);
  const [userAvatarUrl, setUserAvatarUrl] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/user/get", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        const dataResponse = await response.json();
        console.log("USER DATA :", dataResponse);
        if (dataResponse.success && dataResponse.data.profile.isVerified) {
          setIsConnected(true);
          setUserData(dataResponse.data.profile);
          setUserAvatarUrl(dataResponse.data.provider.avatarUrl);
          login(
            dataResponse.data.profile.role,
            dataResponse.data.profile.isVerified,
            true,
          );
        } else {
          setIsConnected(false);
        }
      } catch (error) {
        console.error("🛑🛑🛑 ERREUR SERVEUR GET USER", error);
        setIsConnected(false);
      }
    };
    fetchData();
  }, [isConnected]);

  const handleUserLogout = () => {
    const fetchLogout = async () => {
      try {
        const response = await fetch("/api/user/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        const logoutResponse = await response.json();
        console.log("LOGOUT RES : ", logoutResponse);
        if (logoutResponse.success) {
          setIsConnected(false);
          logout();
          alert(logoutResponse.message);
          // navigate("/inscription");
        } else {
          alert(logoutResponse.message);
        }
      } catch (error) {
        alert(error);
      }
    };
    fetchLogout();
  };

  return (
    <div className="flex items-center gap-2 lg:pr-2">
      <nav className="flex items-center gap-2">
        {isConnected && (
          <Link to="/dashboard">
            <Button
              variant="ghost"
              size="lg"
              data-slot="icon"
              onClick={onNavClick}
              className={
                pathname === "/dashboard"
                  ? " text-gray-500 tracking-wide font-semibold text-[16px] hover:cursor-default"
                  : pathname === "/generateur"
                    ? " text-gray-500 tracking-wide font-semibold text-[16px] hover:cursor-default"
                    : pathname === "/signature"
                      ? " text-gray-500 tracking-wide font-semibold text-[16px] hover:cursor-default"
                      : pathname === "/chatjuridique"
                        ? " text-gray-500 tracking-wide font-semibold text-[16px] hover:cursor-default"
                        : pathname === "/calculateur"
                          ? " text-gray-500 tracking-wide font-semibold text-[16px] hover:cursor-default"
                          : pathname === "/veille"
                            ? " text-gray-500 tracking-wide font-semibold text-[16px] hover:cursor-default"
                            : pathname === "/conformite"
                              ? " text-gray-500 tracking-wide font-semibold text-[16px] hover:cursor-default"
                              : "text-gray-400 hover:bg-lumenjuris-background"
              }
            >
              <LayoutDashboard />
              Mon workspace
            </Button>
          </Link>
        )}
        {isConnected && (
          <Link to="/analyzer">
            <Button
              variant="ghost"
              size="lg"
              data-slot="icon"
              className={
                pathname === "/analyzer"
                  ? " text-gray-500 tracking-wide font-semibold text-[16px] hover:cursor-default"
                  : "text-gray-400 hover:bg-lumenjuris-background"
              }
            >
              <FileCheckIcon />
              Analyse
            </Button>
          </Link>
        )}
        {isConnected && (
          <Link to="/mon-compte">
            <Button
              variant="ghost"
              size="lg"
              className={
                pathname === "/mon-compte"
                  ? " text-gray-500 tracking-wide font-semibold text-[16px] hover:cursor-default"
                  : "text-gray-400 hover:bg-lumenjuris-background"
              }
              onClick={onNavClick}
            >
              <User />
              Mon compte
            </Button>
          </Link>
        )}
        {isConnected && userData.role === "ADMIN" && (
          <Link to="/sandbox">
            <Button
              variant="ghost"
              size="lg"
              className={
                pathname === "/sandbox"
                  ? " text-gray-500 tracking-wide font-semibold text-[16px] hover:cursor-default"
                  : "text-gray-400 hover:bg-lumenjuris-background"
              }
              onClick={onNavClick}
            >
              <ScatterChartIcon />
              Sandbox
            </Button>
          </Link>
        )}
      </nav>
      {isConnected ? (
        <section className="flex items-center gap-3">
          <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <Bell className="h-5 w-5 text-gray-400" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-green-500" />
          </button>
          <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
            {userAvatarUrl ? (
              <img
                src={userAvatarUrl}
                className="h-8 w-8 rounded-full object-cover border border-lumenjuris/60"
              ></img>
            ) : (
              <div className="h-8 w-8 rounded-full bg-lumenjuris flex items-center justify-center text-white text-xs font-medium">
                {userData.prenom
                  ? `${userData.prenom.slice(0, 1)}${userData.nom.slice(0, 1)}`
                  : `${userData.nom.slice(0, 1)}`}
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="hidden md:flex items-center gap-1 cursor-pointer text-sm font-medium text-gray-800">
                    {userData.prenom
                      ? `${userData.prenom} ${userData.nom.slice(0, 1)}.`
                      : `${userData.nom.slice(0, 12)}.`}
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                }
              />
              <DropdownMenuContent
                sideOffset={12}
                className="min-w-28 bg-lumenjuris-background ring-lumenjuris/60 inline-flex justify-center font-medium text-sm"
              >
                <button
                  onClick={handleUserLogout}
                  className="cursor-pointer inline-flex justify-center items-center gap-1"
                >
                  Logout
                  <LogOutIcon size={14} />
                </button>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </section>
      ) : (
        <nav>
          <Link to="/inscription">
            <Button
              variant="ghost"
              size="lg"
              className={
                pathname === "/inscription"
                  ? " text-gray-500 tracking-wide font-semibold text-[16px] hover:cursor-default"
                  : "text-gray-400 hover:bg-lumenjuris-background"
              }
              onClick={onNavClick}
            >
              <LogInIcon />
              Se connecter
            </Button>
          </Link>
        </nav>
      )}
    </div>
  );
};

export default HeaderNavigationBar;
