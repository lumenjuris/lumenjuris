import React from "react";
import {
  CheckCircle2,
  Clock3,
  FileText,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import type { ContractHistoryItem } from "../../utils/contractHistory";

interface DocumentHistorySidebarProps {
  items: ContractHistoryItem[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export const DocumentHistorySidebar: React.FC<DocumentHistorySidebarProps> = ({
  items,
  activeId,
  onOpen,
  onDelete,
}) => {
  return (
    <aside className="w-full lg:w-72 lg:shrink-0">
      <div className="lg:sticky lg:top-6 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Clock3 className="w-4 h-4 text-gray-500 shrink-0" />
            <h2 className="font-semibold text-gray-900 truncate">
              Historique
            </h2>
          </div>
          <span className="text-xs font-medium text-gray-500">
            {items.length}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500">
            Aucun document ouvert.
          </div>
        ) : (
          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-2 space-y-2">
            {items.map((item) => {
              const isActive = item.id === activeId;
              const StatusIcon =
                item.status === "analyzed" ? CheckCircle2 : MoreHorizontal;

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
                    onClick={() => onOpen(item.id)}
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
                                item.status === "analyzed"
                                  ? "text-green-600"
                                  : "text-gray-400"
                              }`}
                            />
                            {item.status === "analyzed"
                              ? "Analysé"
                              : "Importé"}
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
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(item.id);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 focus:opacity-100 focus:outline-none group-hover:opacity-100"
                      title="Supprimer de l'historique"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
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
