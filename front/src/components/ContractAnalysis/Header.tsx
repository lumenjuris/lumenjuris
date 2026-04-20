import React from "react";
import { Scale, RefreshCw } from "lucide-react";

interface HeaderProps {
  onLogoClick?: () => void;
  onReanalyze?: () => void;
  showReanalyze?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onLogoClick,
  onReanalyze,
  showReanalyze = false,
}) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button
            onClick={onLogoClick}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Justiclause</h1>
              <p className="text-sm text-gray-600">
                Analyse et Revue de Contrats
              </p>
            </div>
          </button>

          {showReanalyze && (
            <button
              onClick={onReanalyze}
              className="flex items-center justify-center w-10 h-10 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Réanalyser le document"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
