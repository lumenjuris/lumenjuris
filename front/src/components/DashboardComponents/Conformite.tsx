import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  ChevronDown,
  BarChart3,
  ShieldAlert,
  FileCheck,
  FileText,
  MoreVertical,
  Trash2,
} from "lucide-react";
import {
  loadContractHistoryIndex,
  deleteContractHistoryEntry,
  type ContractHistoryItem,
} from "../../utils/contractHistory";

type RiskLevel = "Élevé" | "Moyen" | "Faible" | "—";

function getRiskLevel(score?: number): RiskLevel {
  if (score === undefined || score === null) return "—";
  if (score >= 60) return "Élevé";
  if (score >= 30) return "Moyen";
  return "Faible";
}

function getRiskStyles(level: RiskLevel): string {
  switch (level) {
    case "Élevé":  return "text-red-500 border-red-100 bg-red-50";
    case "Moyen":  return "text-amber-500 border-amber-100 bg-amber-50";
    case "Faible": return "text-emerald-500 border-emerald-100 bg-emerald-50";
    default:       return "text-slate-400 border-slate-100 bg-slate-50";
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function avgScore(items: ContractHistoryItem[]): number {
  const scored = items.filter((i) => i.overallRiskScore !== undefined);
  if (!scored.length) return 0;
  const avg = scored.reduce((s, i) => s + (i.overallRiskScore ?? 0), 0) / scored.length;
  // Conformité = inverse du score de risque
  return Math.round(100 - avg);
}

export function Conformite() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("Tous");
  const [history, setHistory] = useState<ContractHistoryItem[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    loadContractHistoryIndex().then(setHistory).catch(() => {});
  }, []);

  const handleOpen = (id: string) => {
    navigate("/analyzer", { state: { historyId: id } });
  };

  const handleDelete = async (id: string) => {
    await deleteContractHistoryEntry(id);
    setHistory((prev) => prev.filter((i) => i.id !== id));
    setOpenMenuId(null);
  };

  const filtered = history.filter((item) => {
    const matchSearch = item.fileName.toLowerCase().includes(searchTerm.toLowerCase());
    const level = getRiskLevel(item.overallRiskScore);
    const matchPriority = priorityFilter === "Tous" || level === priorityFilter;
    return matchSearch && matchPriority;
  });

  const highRiskCount = history.filter(
    (i) => getRiskLevel(i.overallRiskScore) === "Élevé",
  ).length;

  const conformityAvg = avgScore(history);

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Title + CTA */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Analyse de conformité
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Vérifiez la conformité juridique de vos documents
          </p>
        </div>
        <button
          onClick={() => navigate("/analyzer")}
          className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-[#354F99] text-white text-sm font-semibold rounded-xl hover:bg-[#1a2d5a] transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nouvelle analyse
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 border border-gray-100 rounded-xl bg-white shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-50 rounded-lg text-slate-400">
            <BarChart3 className="w-5 h-5 stroke-[1.5]" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">
              Total documents
            </p>
            <p className="text-lg font-semibold text-gray-700">{history.length}</p>
          </div>
        </div>
        <div className="p-5 border border-gray-100 rounded-xl bg-white shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 rounded-lg text-red-400">
            <ShieldAlert className="w-5 h-5 stroke-[1.5]" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">
              Risque élevé
            </p>
            <p className="text-lg font-semibold text-red-500">{highRiskCount}</p>
          </div>
        </div>
        <div className="p-5 border border-gray-100 rounded-xl bg-white shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-400">
            <FileCheck className="w-5 h-5 stroke-[1.5]" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">
              Conformité moy.
            </p>
            <p className="text-lg font-semibold text-emerald-500">
              {history.length ? `${conformityAvg}%` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 stroke-[1.5]" />
          <input
            type="text"
            placeholder="Rechercher un document..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-lumenjuris/40 focus:ring-4 focus:ring-lumenjuris/5 transition-all"
          />
        </div>
        <div className="relative w-full md:w-48">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="appearance-none w-full bg-white border border-gray-200 px-4 py-2.5 pr-9 rounded-xl text-sm outline-none focus:border-lumenjuris/40 cursor-pointer transition-all"
          >
            <option value="Tous">Filtrer par priorité</option>
            <option value="Élevé">Élevé</option>
            <option value="Moyen">Moyen</option>
            <option value="Faible">Faible</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none stroke-[1.5]" />
        </div>
      </div>

      {/* History table */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50/60 border-b border-gray-100 text-gray-400 text-[10px] uppercase tracking-widest font-medium">
            <tr>
              <th className="px-6 py-4">Document</th>
              <th className="px-4 py-4 text-center">Clauses</th>
              <th className="px-4 py-4">Priorité</th>
              <th className="px-4 py-4 hidden md:table-cell">Date</th>
              <th className="px-6 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length > 0 ? (
              filtered.map((item) => {
                const level = getRiskLevel(item.overallRiskScore);
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50/40 transition-all group cursor-pointer"
                    onClick={() => handleOpen(item.id)}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-50 rounded-lg text-gray-400 shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate max-w-xs">
                            {item.fileName}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {item.status === "analyzed" ? "Analysé" : "En cours"}
                            {item.activePatchCount > 0
                              ? ` · ${item.activePatchCount} modif.`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <span className="text-sm text-gray-500">
                        {item.clausesCount ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-5">
                      {level !== "—" ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[11px] font-medium tracking-wide ${getRiskStyles(level)}`}
                        >
                          {level}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-5 hidden md:table-cell">
                      <span className="text-xs text-gray-400">
                        {formatDate(item.createdAt)}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div
                        className="relative inline-flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleOpen(item.id)}
                          className="text-lumenjuris font-medium text-xs hover:underline underline-offset-4 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          Ouvrir
                        </button>
                        <button
                          onClick={() =>
                            setOpenMenuId(openMenuId === item.id ? null : item.id)
                          }
                          className="p-1.5 text-gray-300 hover:text-gray-500 transition-colors rounded-md hover:bg-gray-100"
                        >
                          <MoreVertical className="w-4 h-4 stroke-[1.5]" />
                        </button>
                        {openMenuId === item.id && (
                          <div className="absolute right-0 top-8 z-10 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[140px]">
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Supprimer
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-16 text-center text-gray-300 italic text-sm"
                >
                  {history.length === 0
                    ? "Aucun document analysé pour le moment."
                    : "Aucun résultat pour cette recherche."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
