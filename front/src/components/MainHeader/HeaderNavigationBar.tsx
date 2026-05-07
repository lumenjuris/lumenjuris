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
  MonitorCheck,
  AlertCircleIcon,
  HandCoinsIcon,
} from "lucide-react";
import { Button } from "../ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/DropDownMenu";

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import type { MouseEvent } from "react";

import { useUserStore } from "../../store/userStore";

type NavigationClickHandler = (
  event?: MouseEvent<HTMLElement>,
) => boolean | void;

interface HeaderNavBarProps {
  onNavClick?: NavigationClickHandler;
}

const HeaderNavigationBar = ({ onNavClick }: HeaderNavBarProps) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const { userData, isConnected, userAvatarUrl, fetchUser, logoutUser } =
    useUserStore();

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const handleUserLogout = async () => {
    if (onNavClick?.() === false) return;

    const success = await logoutUser();
    if (success) navigate("/inscription");
  };

  return (
    <div className="flex items-center gap-1 lg:pr-2">
      {/* AFFICHAGE MENU TABLETTES OU MOBILE */}
      <nav className="flex items-center gap-1  pr-1 lg:hidden">
        {isConnected && (
          <Link to="/dashboard">
            <Button
              variant="ghost"
              size="icon"
              data-slot="icon"
              onClick={onNavClick}
              className={
                pathname === "/dashboard" ||
                pathname === "/generateur" ||
                pathname === "/signature" ||
                pathname === "/chatjuridique" ||
                pathname === "/calculateur" ||
                pathname === "/veille" ||
                pathname === "/conformite"
                  ? " text-gray-800 xl:tracking-wide font-semibold hover:cursor-default"
                  : "text-gray-400 hover:bg-lumenjuris-background transition-all delay-100"
              }
            >
              <LayoutDashboard
                className={
                  pathname === "/dashboard" ||
                  pathname === "/generateur" ||
                  pathname === "/signature" ||
                  pathname === "/chatjuridique" ||
                  pathname === "/calculateur" ||
                  pathname === "/veille" ||
                  pathname === "/conformite"
                    ? "size-6"
                    : "size-5"
                }
              />
            </Button>
          </Link>
        )}
        {isConnected && (
          <Link to="/analyzer">
            <Button
              variant="ghost"
              size="icon"
              data-slot="icon"
              className={
                pathname === "/analyzer"
                  ? " text-gray-800 xl:tracking-wide font-semibold hover:cursor-default"
                  : "text-gray-400 hover:bg-lumenjuris-background transition-all delay-100"
              }
            >
              <FileCheckIcon
                className={pathname === "/analyzer" ? "size-6" : "size-5"}
              />
            </Button>
          </Link>
        )}
        {isConnected && userData?.profile.role === "ADMIN" && (
          <Link to="/sandbox">
            <Button
              variant="ghost"
              size="icon"
              className={
                pathname === "/sandbox"
                  ? " text-gray-800 xl:tracking-wide font-semibold hover:cursor-default"
                  : "text-gray-400 hover:bg-lumenjuris-background transition-all delay-100"
              }
              onClick={onNavClick}
            >
              <ScatterChartIcon
                className={pathname === "/sandbox" ? "size-6" : "size-5"}
              />
            </Button>
          </Link>
        )}
        {isConnected && userData?.profile.role === "ADMIN" && (
          <Link to="/monitoring">
            <Button
              variant="ghost"
              size="icon"
              className={
                pathname === "/monitoring"
                  ? " text-gray-800 xl:tracking-wide font-semibold hover:cursor-default"
                  : "text-gray-400 hover:bg-lumenjuris-background transition-all delay-100"
              }
              onClick={onNavClick}
            >
              <MonitorCheck
                className={pathname === "/monitoring" ? "size-6" : "size-5"}
              />
            </Button>
          </Link>
        )}
      </nav>

      {/* AFFICHAGE MENU ECRANS LARGE */}
      <nav className="hidden lg:flex items-center 2xl:gap-1">
        {isConnected && (
          <Link to="/dashboard">
            <Button
              variant="ghost"
              size="lg"
              data-slot="icon"
              onClick={onNavClick}
              className={
                pathname === "/dashboard" ||
                pathname === "/generateur" ||
                pathname === "/signature" ||
                pathname === "/chatjuridique" ||
                pathname === "/calculateur" ||
                pathname === "/veille" ||
                pathname === "/conformite"
                  ? " text-gray-500 xl:tracking-wide font-semibold xl:text-[16px] hover:cursor-default"
                  : "text-gray-400 hover:bg-lumenjuris-background transition-all delay-100"
              }
            >
              <LayoutDashboard
                className={
                  pathname === "/dashboard" ||
                  pathname === "/generateur" ||
                  pathname === "/signature" ||
                  pathname === "/chatjuridique" ||
                  pathname === "/calculateur" ||
                  pathname === "/veille" ||
                  pathname === "/conformite"
                    ? "size-5"
                    : ""
                }
              />
              Dashboard
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
                  ? " text-gray-500 xl:tracking-wide font-semibold xl:text-[16px] hover:cursor-default"
                  : "text-gray-400 hover:bg-lumenjuris-background transition-all delay-100"
              }
            >
              <FileCheckIcon
                className={pathname === "/analyzer" ? "size-5" : ""}
              />
              Analyse
            </Button>
          </Link>
        )}
        {isConnected && userData?.profile.role === "ADMIN" && (
          <Link to="/sandbox">
            <Button
              variant="ghost"
              size="lg"
              data-slot="icon"
              className={
                pathname === "/sandbox"
                  ? " text-gray-500 xl:tracking-wide font-semibold xl:text-[16px] hover:cursor-default"
                  : "text-gray-400 hover:bg-lumenjuris-background transition-all delay-100"
              }
              onClick={onNavClick}
            >
              <ScatterChartIcon
                className={pathname === "/sandbox" ? "size-5" : ""}
              />
              Sandbox
            </Button>
          </Link>
        )}
        {isConnected && userData?.profile.role === "ADMIN" && (
          <Link to="/monitoring">
            <Button
              variant="ghost"
              size="lg"
              className={
                pathname === "/monitoring"
                  ? " text-gray-500 xl:tracking-wide font-semibold xl:text-[16px] hover:cursor-default"
                  : "text-gray-400 hover:bg-lumenjuris-background transition-all delay-100"
              }
              onClick={onNavClick}
            >
              <MonitorCheck
                className={pathname === "/monitoring" ? "size-5" : ""}
              />
              Monitoring
            </Button>
          </Link>
        )}
      </nav>

      {isConnected ? (
        <section className="flex items-center gap-3">
          {!userData?.enterprise && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="absolute top-2 rounded-full w-6 h-6 bg-transparent border border-destructive flex justify-center items-center animate-ping"></div>
                    <AlertCircleIcon className="size-6 text-destructive" />
                  </button>
                }
              />
              <DropdownMenuContent
                sideOffset={6}
                alignOffset={-60}
                className="min-w-28 bg-lumenjuris-sidebar ring-lumenjuris/60 font-medium text-sm px-4 text-gray-400"
              >
                <p>Pensez à compléter les informations manquantes dans : </p>
                <Link to="/mon-compte" state={{ origin: "header-alert" }}>
                  <button className="font-semibold text-gray-100">{`Mon compte > Mon entreprise`}</button>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <Bell className="h-5 w-5 text-gray-400" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-green-500" />
          </button>
          <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
            {userAvatarUrl ? (
              <img
                src={userAvatarUrl}
                className="hidden md:block h-8 w-8 rounded-full object-cover border border-lumenjuris/60"
              ></img>
            ) : (
              <div className="hidden md:flex h-8 w-8 rounded-full bg-lumenjuris items-center justify-center text-white text-xs font-medium">
                {userData?.profile.prenom
                  ? `${userData.profile.prenom.slice(0, 1)}${userData.profile.nom.slice(0, 1)}`
                  : `${userData?.profile.nom.slice(0, 1)}`}
              </div>
            )}

            <DropdownMenu>
              {isMobile ? (
                <DropdownMenuTrigger
                  render={
                    <button className="flex md:hidden h-8 w-8 rounded-full bg-lumenjuris justify-center items-center cursor-pointer text-xs font-medium text-white">
                      {userData?.profile.prenom
                        ? `${userData.profile.prenom.slice(0, 1)}${userData.profile.nom.slice(0, 1)}`
                        : `${userData?.profile.nom.slice(0, 1)}`}
                    </button>
                  }
                />
              ) : (
                <DropdownMenuTrigger
                  render={
                    <button className="hidden md:flex items-center gap-1 cursor-pointer text-sm font-medium text-gray-800 line-clamp-1">
                      {userData?.profile.prenom
                        ? `${userData.profile.prenom.slice(0, 6)} ${userData.profile.nom.slice(0, 1)}.`
                        : `${userData?.profile.nom.slice(0, 12)}.`}
                      <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                  }
                />
              )}

              <DropdownMenuContent
                sideOffset={14}
                alignOffset={2}
                className="min-w-28 bg-lumenjuris-sidebar ring-lumenjuris/60 font-medium text-sm px-4 py-2 flex flex-col items-start gap-2"
              >
                <button
                  onClick={handleUserLogout}
                  className="cursor-pointer inline-flex justify-center items-center gap-1 py-1 text-gray-400 hover:text-white transition-all delay-100"
                >
                  <LogOutIcon size={16} />
                  Logout
                </button>
                <button
                  onClick={() => {
                    if (onNavClick?.() === false) return;
                    navigate("/mon-compte");
                  }}
                  className="cursor-pointer inline-flex justify-center items-center gap-1 py-1 text-gray-400 hover:text-white transition-all delay-100"
                >
                  <User size={16} />
                  Mon compte
                </button>
                <button
                  onClick={() => {
                    navigate("/souscription");
                  }}
                  className="cursor-pointer inline-flex justify-center items-center gap-1 py-1 text-gray-400 hover:text-white transition-all delay-100"
                >
                  <HandCoinsIcon size={16} />
                  Formules
                </button>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </section>
      ) : (
        <nav className="flex items-center gap-1 pr-2">
          {isMobile ? (
            <>
              <Link to="/souscription">
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className={
                    pathname === "/souscription"
                      ? " text-gray-500 tracking-wide font-semibold hover:cursor-default"
                      : "text-gray-400 hover:bg-lumenjuris-background"
                  }
                >
                  <HandCoinsIcon
                    className={pathname === "/souscription" ? "size-6" : ""}
                  />
                </Button>
              </Link>
              <Link to="/inscription">
                <Button
                  variant="ghost"
                  size="icon-lg"
                  className={
                    pathname === "/inscription"
                      ? " text-gray-500 tracking-wide font-semibold text-[16px] hover:cursor-default"
                      : "text-gray-400 hover:bg-lumenjuris-background"
                  }
                >
                  <LogInIcon
                    className={pathname === "/inscription" ? "size-6" : ""}
                  />
                </Button>
              </Link>
            </>
          ) : (
            <>
              {" "}
              <Link to="/souscription">
                <Button
                  variant="ghost"
                  size="lg"
                  className={
                    pathname === "/souscription"
                      ? " text-gray-500 tracking-wide font-semibold text-[16px] hover:cursor-default"
                      : "text-gray-400 hover:bg-lumenjuris-background"
                  }
                >
                  <HandCoinsIcon
                    className={pathname === "/souscription" ? "size-5" : ""}
                  />
                  Tarifs
                </Button>
              </Link>
              <Link to="/inscription">
                <Button
                  variant="ghost"
                  size="lg"
                  className={
                    pathname === "/inscription"
                      ? " text-gray-500 tracking-wide font-semibold text-[16px] hover:cursor-default"
                      : "text-gray-400 hover:bg-lumenjuris-background"
                  }
                >
                  <LogInIcon
                    className={pathname === "/inscription" ? "size-5" : ""}
                  />
                  Se connecter
                </Button>
              </Link>
            </>
          )}
        </nav>
      )}
    </div>
  );
};

export default HeaderNavigationBar;
