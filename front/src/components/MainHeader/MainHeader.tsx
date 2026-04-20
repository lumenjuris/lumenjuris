// UI //
import { Scale, RefreshCw } from "lucide-react";

import HeaderNavigationBar from "./HeaderNavigationBar";

import { Link, useLocation } from "react-router-dom";

interface MainHeaderProps {
  onNavClick?: () => void;
  onReanalyze?: () => void;
  showReanalyze?: boolean;
  setIsConnected?: React.Dispatch<React.SetStateAction<boolean>>;
}

const MainHeader = ({
  onNavClick,
  onReanalyze,
  showReanalyze,
}: MainHeaderProps) => {
  const { pathname } = useLocation();

  return (
    <header className="h-16 border-b border-gray-200 bg-white sticky top-0 z-10">
      <div className="max-w-[1500px] ml-auto px-4 lg:px-6 flex justify-between items-center h-full">
        <section className="flex justify-center gap-10">
          <Link to="/dashboard">
            <button
              className="flex items-center gap-2.5 border-none"
              onClick={onNavClick}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-lumenjuris">
                <Scale className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-lumenjuris tracking-tight">
                  LumenJuris
                </span>
                <span className="text-[10px] text-gray-400 leading-none">
                  Conformité RH
                </span>
              </div>
            </button>
          </Link>
          {pathname === "/analyzer" && showReanalyze && (
            <button
              onClick={onReanalyze}
              className="flex items-center justify-center w-10 h-10 text-gray-600 hover:bg-lumenjuris-background rounded-lg transition-colors"
              title="Réanalyser le document"
            >
              <RefreshCw className="size-5" />
            </button>
          )}
        </section>

        <HeaderNavigationBar onNavClick={onNavClick} />
      </div>
    </header>
  );
};

export default MainHeader;
