// UI //
import {
  LogInIcon,
  FileCheckIcon,
  User,
  ScatterChartIcon,
  Bell,
  ChevronDown,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "../ui/Button";

import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

interface HeaderNavBarProps {
  onNavClick?: () => void;
}

const HeaderNavigationBar = ({ onNavClick }: HeaderNavBarProps) => {
  const { pathname } = useLocation();

  const [isConnected, setIsConnected] = useState(false);

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
              ML
            </div>
            <div className="hidden md:flex items-center gap-1 cursor-pointer">
              <span className="text-sm font-medium text-gray-800">
                Marie L.
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </div>
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
