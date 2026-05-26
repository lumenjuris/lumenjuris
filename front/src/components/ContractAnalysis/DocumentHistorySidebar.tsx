import React, { useState } from "react";
import {
  CheckCircle2,
  Clock3,
  FileText,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { ContractHistoryItem } from "../../utils/contractHistory";

interface DocumentHistorySidebarProps {
  items: ContractHistoryItem[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onCollapse?: (collapsed: boolean) => void;
  onNewAnalysis?: () => void;
  defaultCollapsed?: boolean;
}

export const DocumentHistorySidebar: React.FC<DocumentHistorySidebarProps> = ({
  items,
  activeId,
  onOpen,
  onDelete,
  onCollapse,
  onNewAnalysis,
  defaultCollapsed = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const toggle = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    onCollapse?.(next);
  };

  const handleHistoryIconClick = () => {
    if (window.innerWidth < 768) {
      setIsMobileDrawerOpen((prev) => !prev);
    } else {
      toggle();
    }
  };

  const handleItemOpen = (id: string) => {
    onOpen(id);
    setIsMobileDrawerOpen(false);
  };

  const handleItemDelete = (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    onDelete(id);
  };

  const historyList = (onItemOpen: (id: string) => void) =>
    items.length === 0 ? (
      <div className="px-4 py-6 text-sm text-gray-500">
        Aucun document ouvert.
      </div>
    ) : (
      <div className="p-2 space-y-2">
        {items.map((item) => {
          const isActive = item.id === activeId;
          const isAnalyzed = item.status === "analyzed";
          const StatusIcon = isAnalyzed ? CheckCircle2 : MoreHorizontal;

          return (
            <div
              key={item.id}
              className={`group rounded-md border transition-colors ${
                isActive
                  ? "border-blue-300 bg-blue-50"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <button
                type="button"
                onClick={() => onItemOpen(item.id)}
                className="w-full text-left px-3 py-3"
              >
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 mt-0.5 text-gray-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.fileName}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-y-1 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <StatusIcon
                          className={`w-3.5 h-3.5 ${
                            isAnalyzed ? "text-green-600" : "text-gray-400"
                          }`}
                        />
                        {isAnalyzed ? "Analysé" : "En cours"}
                      </span>
                      <HistoryMetaItem>
                        {formatClauseCount(item.clausesCount)}
                      </HistoryMetaItem>
                      {item.activePatchCount > 0 && (
                        <HistoryMetaItem>
                          {formatPatchCount(item.activePatchCount)}
                        </HistoryMetaItem>
                      )}
                    </div>
                  </div>
                </div>
              </button>

              <div className="px-3 pb-2 flex items-center justify-between gap-2">
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {formatDate(item.createdAt)}
                </span>
                <button
                  type="button"
                  onClick={(event) => handleItemDelete(event, item.id)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 focus:opacity-100 focus:outline-none group-hover:opacity-100"
                  title={
                    isAnalyzed
                      ? "Supprimer de l'historique"
                      : "Abandonner l'analyse en cours"
                  }
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );

  return (
    <>
      {/* Sidebar — always w-12 on mobile, expandable on desktop */}
      <aside
        className={`fixed left-0 top-16 bottom-0 z-20 flex flex-col bg-white border-r border-gray-200 shadow-sm transition-all duration-300 ease-in-out w-12 rounded-r-2xl ${
          !isCollapsed ? "md:w-72 md:rounded-r-none" : ""
        }`}
      >
        {/* Collapsed header (always shown on mobile; shown on desktop when collapsed) */}
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-3 w-full pt-3 pb-4 shrink-0">
            <button
              type="button"
              onClick={handleHistoryIconClick}
              className="flex flex-col items-center gap-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors p-1 rounded"
              title="Afficher l'historique"
            >
              <PanelLeftOpen className="w-5 h-5" />
              <Clock3 className="w-4 h-4" />
            </button>
            <div className="mt-4">
              <button
                type="button"
                onClick={onNewAnalysis}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors p-1 rounded"
                title="Nouvelle analyse"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Expanded header — desktop only */
          <div className="hidden md:flex items-center justify-between px-3 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Clock3 className="w-4 h-4 text-gray-500 shrink-0" />
              <h2 className="font-semibold text-gray-900 truncate text-sm">
                Historique
              </h2>
            </div>
            <button
              type="button"
              onClick={onNewAnalysis}
              className="ml-2 flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors shrink-0"
              title="Nouvelle analyse"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={toggle}
              className="ml-1 flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors shrink-0"
              title="Réduire l'historique"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* List — desktop only when expanded */}
        {!isCollapsed && (
          <div className="hidden md:flex flex-1 overflow-y-auto flex-col">
            {historyList(onOpen)}
          </div>
        )}
      </aside>

      {/* Mobile drawer overlay — always mounted for smooth enter/exit animation */}
      <>
        <div
          className={`fixed inset-x-0 top-16 bottom-0 z-30 bg-black/30 md:hidden transition-opacity duration-200 ${
            isMobileDrawerOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setIsMobileDrawerOpen(false)}
        />
        <div
          className={`fixed left-0 top-16 bottom-0 z-40 w-72 flex flex-col bg-white border-r border-gray-200 shadow-lg md:hidden transition-transform duration-300 ease-out ${
            isMobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
            <div className="flex items-center gap-2">
              <Clock3 className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-gray-900 text-sm">
                Historique
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onNewAnalysis}
                className="flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                title="Nouvelle analyse"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                className="flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {historyList(handleItemOpen)}
          </div>
        </div>
      </>
    </>
  );
};

function HistoryMetaItem({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap">
      <span className="mx-1.5 text-gray-300" aria-hidden="true">
        /
      </span>
      {children}
    </span>
  );
}

function formatClauseCount(count: number): string {
  return `${count} clause${count > 1 ? "s" : ""}`;
}

function formatPatchCount(count: number): string {
  return `${count} modif.`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
