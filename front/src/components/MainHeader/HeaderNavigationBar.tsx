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

interface HeaderNavBarProps {
  onNavClick?: () => void;
}

const HeaderNavigationBar = ({ onNavClick }: HeaderNavBarProps) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [isConnected, setIsConnected] = useState(false);
  const [userData, setUserData] = useState(null);

  let role = null;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/user/get", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        const dataResponse = await response.json();
        if (dataResponse.success && dataResponse.data.profile.isVerified) {
          setIsConnected(true);
          setUserData(dataResponse.data);
          role = dataResponse.data.profile.role;
        }
      } catch (error) {}
    };
    fetchData();
  }, []);

  const firstName = "Julien";
  const lastName = "Bouchez";
  const initials = `${firstName.slice(0, 1)}${lastName.slice(0, 1)}`;

  const handleUserLogout = () => {
    setIsConnected(false);
    // navigate("/inscription");
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
        {isConnected && (
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
            <div className="h-8 w-8 rounded-full bg-lumenjuris flex items-center justify-center text-white text-xs font-medium">
              {initials}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="hidden md:flex items-center gap-1 cursor-pointer text-sm font-medium text-gray-800">
                    {`${firstName} ${lastName.slice(0, 1)}.`}
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
