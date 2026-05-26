// UI //
import { Scale } from "lucide-react";
import type { MouseEvent } from "react";

import HeaderNavigationBar from "./HeaderNavigationBar";

import { Link } from "react-router-dom";

type NavigationClickHandler = (
  event?: MouseEvent<HTMLElement>,
) => boolean | void;

interface MainHeaderProps {
  onNavClick?: NavigationClickHandler;
  setIsConnected?: React.Dispatch<React.SetStateAction<boolean>>;
}

const MainHeader = ({ onNavClick }: MainHeaderProps) => {
  return (
    <header className="h-16 border-b border-gray-200 bg-white sticky top-0 z-10">
      <div className="max-w-[1500px] ml-auto px-4 lg:px-6 flex justify-between items-center h-full 2xl:max-w-full 2xl:ml-64">
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
        </section>

        <HeaderNavigationBar onNavClick={onNavClick} />
      </div>
    </header>
  );
};

export default MainHeader;
