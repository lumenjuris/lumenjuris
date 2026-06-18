// UI //
import type { MouseEvent } from "react";

import HeaderNavigationBar from "./HeaderNavigationBar";
import { LumenJurisLogo } from "../common/LumenJurisLogo";

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
    <header className="h-16 border-b border-line bg-white sticky top-0 z-10 flex items-center justify-between px-4">
      <Link to="/dashboard" className="flex items-center" onClick={onNavClick}>
        <LumenJurisLogo variant="light" height={30} />
      </Link>

      <HeaderNavigationBar onNavClick={onNavClick} />
    </header>
  );
};

export default MainHeader;
