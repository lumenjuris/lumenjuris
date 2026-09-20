import { useMemo, useState } from "react";
import { FileText, Sparkles, Trash2 } from "lucide-react";

import { DataTable, EmptyCell, type DataTableColumn } from "../../common/DataTable";
import { RowActionsMenu } from "../../common/RowActionsMenu";
import { fmtDate } from "../contratheque/types";

/** Modèle enregistré, tel que renvoyé par GET /api/template. */
export interface TemplateListItem {
  id: string;
  name: string;
  contractType: string | null;
  sourceFilename: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  /** Nombre de champs (variables) du modèle. */
  variableCount?: number;
}

type SortKey = "name" | "variableCount" | "createdAt" | "updatedAt";
type SortDirection = "asc" | "desc";

interface Props {
  items: TemplateListItem[];
  loading: boolean;
  /** Ouvre le modèle pour générer un contrat. */
  onOpen: (id: string) => void;
  onDelete: (item: TemplateListItem) => void;
}

const STORAGE_KEY = "template_table_visible_columns";
const DEFAULT_COLUMNS = ["name", "contractType", "variableCount", "updatedAt", "action"];

/** Trie les modèles sans modifier le tableau d'origine. */
function sortTemplates(items: TemplateListItem[], sortBy: SortKey, sortDirection: SortDirection): TemplateListItem[] {
  return [...items].sort((a, b) => {
    let comparison: number;
    if (sortBy === "name") {
      comparison = a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
    } else if (sortBy === "variableCount") {
      comparison = (a.variableCount ?? 0) - (b.variableCount ?? 0);
    } else {
      comparison = new Date(a[sortBy]).getTime() - new Date(b[sortBy]).getTime();
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });
}

/** Tableau des modèles enregistrés. */
export function TemplateTable({ items, loading, onOpen, onDelete }: Props) {
  const [sortBy, setSortBy] = useState<SortKey>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedItems = useMemo(
    () => sortTemplates(items, sortBy, sortDirection),
    [items, sortBy, sortDirection],
  );

  const handleSort = (key: SortKey) => {
    if (key === sortBy) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      // Nom : A → Z d'abord ; nombres et dates : les plus grands / récents d'abord.
      setSortDirection(key === "name" ? "asc" : "desc");
    }
  };

  const columns: DataTableColumn<TemplateListItem, SortKey>[] = [
    {
      id: "name",
      label: "Nom",
      sortKey: "name",
      cell: (template) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-xl bg-brand-light p-2 text-blue-primary transition-colors group-hover:bg-blue-primary group-hover:text-white">
            <FileText className="h-4 w-4" />
          </div>
          <span
            title={template.name}
            className="max-w-[220px] truncate font-medium text-ink transition-colors group-hover:text-blue-primary"
          >
            {template.name}
          </span>
        </div>
      ),
    },
    {
      id: "contractType",
      label: "Type",
      cellClassName: "text-xs font-medium text-ink-muted",
      cell: (template) => template.contractType ?? <EmptyCell />,
    },
    {
      id: "origin",
      label: "Origine",
      // Un modèle sans fichier source a été généré « de zéro ».
      cell: (template) => (
        <span
          className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
            template.sourceFilename
              ? "border-emerald-200/60 bg-emerald-50 text-emerald-700"
              : "border-purple-200/60 bg-purple-50 text-purple-700"
          }`}
        >
          {template.sourceFilename ? "Importé" : "Généré"}
        </span>
      ),
    },
    {
      id: "sourceFilename",
      label: "Fichier source",
      cellClassName: "text-xs text-ink-secondary",
      cell: (template) =>
        template.sourceFilename ? (
          <span title={template.sourceFilename} className="block max-w-[180px] truncate">
            {template.sourceFilename}
          </span>
        ) : (
          <EmptyCell />
        ),
    },
    {
      id: "variableCount",
      label: "Champs",
      sortKey: "variableCount",
      cellClassName: "whitespace-nowrap text-xs text-ink-secondary",
      cell: (template) => template.variableCount ?? <EmptyCell />,
    },
    {
      id: "version",
      label: "Version",
      cellClassName: "whitespace-nowrap text-xs text-ink-muted",
      cell: (template) => `v${template.version}`,
    },
    {
      id: "createdAt",
      label: "Créé le",
      sortKey: "createdAt",
      cellClassName: "whitespace-nowrap text-xs text-ink-muted",
      cell: (template) => fmtDate(template.createdAt),
    },
    {
      id: "updatedAt",
      label: "Modifié le",
      sortKey: "updatedAt",
      cellClassName: "whitespace-nowrap text-xs text-ink-muted",
      cell: (template) => fmtDate(template.updatedAt),
    },
    {
      id: "action",
      label: "Action",
      alignRight: true,
      cell: (template) => (
        <RowActionsMenu
          actions={[
            {
              label: "Utiliser",
              icon: <Sparkles className="h-3.5 w-3.5" />,
              onSelect: () => onOpen(template.id),
            },
            {
              label: "Supprimer",
              icon: <Trash2 className="h-3.5 w-3.5" />,
              danger: true,
              onSelect: () => onDelete(template),
            },
          ]}
        />
      ),
    },
  ];

  const countLabel = `${items.length} modèle${items.length > 1 ? "s" : ""}`;

  return (
    <DataTable
      items={sortedItems}
      loading={loading}
      skeletonRows={3}
      rowKey={(template) => template.id}
      columns={columns}
      defaultColumns={DEFAULT_COLUMNS}
      storageKey={STORAGE_KEY}
      sortBy={sortBy}
      sortDir={sortDirection}
      onSort={handleSort}
      onRowClick={(template) => onOpen(template.id)}
      empty={{
        title: "Aucun modèle enregistré",
        description: "Importez un contrat pour en faire un modèle réutilisable.",
      }}
      summary={loading ? null : countLabel}
    />
  );
}
