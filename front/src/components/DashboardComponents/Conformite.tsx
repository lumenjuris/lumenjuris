import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
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
  ExternalLink,
  FolderPlus,
  Check,
  Loader2,
  Sparkles,
  PlusCircle,
} from "lucide-react";
import {
  loadContractHistoryIndex,
  loadContractHistorySnapshot,
  deleteContractHistoryEntry,
  type ContractHistoryItem,
} from "../../utils/contractHistory";
import { contractApi } from "./contratheque/api";

type RiskLevel = "Élevé" | "Moyen" | "Faible" | "—";

function getRiskLevel(score?: number): RiskLevel {
  if (score === undefined || score === null) return "—";
  if (score >= 60) return "Élevé";
  if (score >= 30) return "Moyen";
  return "Faible";
}

function getRiskStyles(level: RiskLevel): string {
  switch (level) {
    case "Élevé": return "text-danger-dark border-danger/20 bg-danger-light";
    case "Moyen": return "text-warning-dark border-warning/20 bg-warning-light";
    case "Faible": return "text-success-dark border-success/20 bg-success-light";
    default: return "text-ink-subtle border-line bg-surface-muted";
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
  const [addState, setAddState] = useState<Record<string, "saving" | "done">>({});

  useEffect(() => {
    loadContractHistoryIndex().then(setHistory).catch(() => { });
  }, []);

  const handleOpenAnalyzer = (id: string) => {
    console.log("Id du contract à ouvrir :", id)
    navigate(`/analyzer`, { state: { historyId: id } });
  };

  //Handle de la fermeture de la modale "Action"
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuId(null);
    };
    window.addEventListener("click", handleClickOutside);
    return () => {
      window.removeEventListener("click", handleClickOutside);
    };
  }, []);
  /** Enregistre le document analysé dans la contrathèque (charge le texte du snapshot). */
  const handleAddToContratheque = async (item: ContractHistoryItem) => {
    if (addState[item.id]) return;
    setAddState((s) => ({ ...s, [item.id]: "saving" }));
    try {
      const snapshot = await loadContractHistorySnapshot(item.id);
      if (!snapshot) throw new Error("Document introuvable.");
      const title =
        (item.fileName || "Contrat analysé").replace(/\.[^.]+$/, "").trim() ||
        "Contrat analysé";
      const contractType =
        (snapshot.contract.contractType ||
          snapshot.currentAnalysisContext?.contractType ||
          item.contractType ||
          "").trim() || null;
      await contractApi.create({
        title,
        contractType,
        ocrText: snapshot.contract.content,
        status: "DRAFT",
      });
      setAddState((s) => ({ ...s, [item.id]: "done" }));
      toast.success("Ajouté à la contrathèque.");
    } catch (e) {
      setAddState((s) => {
        const next = { ...s };
        delete next[item.id];
        return next;
      });
      const msg = e instanceof Error ? e.message : "";
      toast.error(
        /403|éditeur|editor/i.test(msg)
          ? "Réservé aux rôles Juriste et Administrateur."
          : "Échec de l'ajout à la contrathèque.",
      );
    }
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
    <>
    <div className="lg:col-span-3 space-y-6">
      {/* Title + CTA */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 bg-blue-primary px-8 py-8 rounded-2xl">
        <div className="text-left">
          <h2 className="text-2xl sm:text-3xl font-semibold text-white leading-tight">
            Analyse de conformité
          </h2>
          <p className="text-sm text-gray-primary leading-relaxed mt-1">
            Vérifiez la conformité juridique de vos documents.
          </p>
        </div>
        <button
          onClick={() => navigate("/analyzer")}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-gray-900 text-sm font-medium rounded-xl hover:bg-gray-100 transition-colors shadow-sm shrink-0 self-start sm:self-end"
        >
          <Plus className="text-base font-normal" /> Nouvelle analyse
        </button>
      </div>

<div className="my-4 pl-4 border-l-2 border-blue-primary">
  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-primary mb-2">
    Pourquoi utiliser l'Analyzer ?
  </h3>

  <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
    <li className="flex items-start gap-2">
      <span className="text-blue-500 font-bold select-none">•</span>
      <span>
        <strong className="font-semibold text-slate-800">Diagnostic & Score de risque :</strong> Chaque clause est analysée et assortie d'un score visuel pour repérer instantanément les points de vigilance.
      </span>
    </li>

    <li className="flex items-start gap-2">
      <span className="text-blue-500 font-bold select-none">•</span>
      <span>
        <strong className="font-semibold text-slate-800">Modifications concrètes :</strong> L'outil propose des réécritures adaptées et vous explique en détail la justification de chaque changement.
      </span>
    </li>

    <li className="flex items-start gap-2">
      <span className="text-blue-500 font-bold select-none">•</span>
      <span>
        <strong className="font-semibold text-slate-800">Suggestions de clauses :</strong> Bénéficiez de recommandations de clauses à ajouter pour combler les manques et protéger au mieux vos intérêts.
      </span>
    </li>
  </ul>
</div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard label="Total documents" value={history.length} icon={BarChart3} accent="#2C3A5E" />
        <KpiCard label="Risque élevé" value={highRiskCount} icon={ShieldAlert} accent="#dc2626" />
        <KpiCard
          label="Conformité moy."
          value={history.length ? `${conformityAvg}%` : "—"}
          icon={FileCheck}
          accent="#059669"
        />
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col md:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle stroke-[1.5]" />
          <input
            type="text"
            placeholder="Rechercher un document…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-line rounded-xl text-sm text-ink outline-none focus:border-brand/40 focus:shadow-ring-brand transition-all placeholder:text-ink-placeholder shadow-card"
          />
        </div>
        <div className="relative w-full md:w-48">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="appearance-none w-full bg-white border border-line px-4 py-2.5 pr-9 rounded-xl text-sm text-ink-secondary outline-none focus:border-brand/40 cursor-pointer transition-all shadow-card"
          >
            <option value="Tous">Filtrer par priorité</option>
            <option value="Élevé">Élevé</option>
            <option value="Moyen">Moyen</option>
            <option value="Faible">Faible</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle pointer-events-none stroke-[1.5]" />
        </div>
      </div>

      {/* History table */}
      <div className="bg-white border border-line rounded-card shadow-card overflow-hidden">
  
  {/* ── Vue Mobile (Cartes / Liste) ── */}
  <div className="md:hidden divide-y divide-line-subtle">
    {filtered.length > 0 ? (
      filtered.map((item) => {
        const level = getRiskLevel(item.overallRiskScore);
        return (
          <div
            key={item.id}
            className="p-4 space-y-3 hover:bg-surface-subtle/60 transition-all cursor-pointer"
            onClick={() => handleOpenAnalyzer(item.id)}
          >
            {/* Entête Carte : Icône + Nom + Status + Actions */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-panel bg-surface-subtle border border-line flex items-center justify-center text-ink-subtle shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    {item.fileName}
                  </p>
                  <p className="text-xs text-ink-subtle mt-0.5">
                    {item.status === "analyzed" ? "Analysé" : "En cours"}
                    {item.activePatchCount > 0 ? ` · ${item.activePatchCount} modif.` : ""}
                    <span className="ml-1 text-ink-placeholder">• {formatDate(item.createdAt)}</span>
                  </p>
                </div>
              </div>

              {/* Actions rapide sur mobile */}
              <div
                className="relative flex items-center gap-1 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => handleAddToContratheque(item)}
                  disabled={addState[item.id] === "saving"}
                  title={
                    addState[item.id] === "done"
                      ? "Ajouté à la contrathèque"
                      : "Ajouter à la contrathèque"
                  }
                  className="p-1.5 text-ink-subtle hover:text-brand transition-colors rounded-lg hover:bg-surface-muted disabled:opacity-50"
                >
                  {addState[item.id] === "done" ? (
                    <Check className="w-4 h-4 text-success stroke-[1.5]" />
                  ) : addState[item.id] === "saving" ? (
                    <Loader2 className="w-4 h-4 animate-spin stroke-[1.5]" />
                  ) : (
                    <FolderPlus className="w-4 h-4 stroke-[1.5]" />
                  )}
                </button>
                <button
                  onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                  className="p-1.5 text-ink-subtle hover:text-ink-secondary transition-colors rounded-lg hover:bg-surface-muted"
                >
                  <MoreVertical className="w-4 h-4 stroke-[1.5]" />
                </button>

                {openMenuId === item.id && (
                  <div className="absolute right-0 top-8 z-10 bg-white border border-line rounded-panel shadow-card-md py-1 min-w-[140px]">
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-danger-light transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Supprimer
                    </button>
                    <button
                      onClick={() => handleOpenAnalyzer(item.id)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-brand hover:bg-brand/10 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ouvrir
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Pied Carte : Informations secondaires (Clauses & Priorité) */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-line-subtle/50">
              <div className="flex items-center gap-1.5 text-ink-subtle">
                <span>Clauses :</span>
                <span className="font-semibold text-ink">{item.clausesCount ?? "—"}</span>
              </div>
              <div>
                {level !== "—" ? (
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-chip border text-[10px] font-semibold tracking-wide ${getRiskStyles(level)}`}
                  >
                    {level}
                  </span>
                ) : (
                  <span className="text-xs text-ink-placeholder">—</span>
                )}
              </div>
            </div>
          </div>
        );
      })
    ) : (
      <div className="px-6 py-12 text-center text-ink-subtle italic text-sm">
        {history.length === 0
          ? "Aucun document analysé pour le moment."
          : "Aucun résultat pour cette recherche."}
      </div>
    )}
  </div>

  {/* ── Vue Desktop (Tableau classique) ── */}
  <div className="hidden md:block">
    <table className="w-full text-left border-collapse">
      <thead className="bg-blue-primary border-b border-line text-white text-[10px] uppercase tracking-widest font-semibold">
        <tr>
          <th className="px-6 py-4">Document</th>
          <th className="px-4 py-4 text-center">Clauses</th>
          <th className="px-4 py-4">Priorité</th>
          <th className="px-4 py-4">Date</th>
          <th className="px-6 py-4 text-right">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line-subtle">
        {filtered.length > 0 ? (
          filtered.map((item) => {
            const level = getRiskLevel(item.overallRiskScore);
            return (
              <tr
                key={item.id}
                className="hover:bg-surface-subtle/60 transition-all group cursor-pointer"
                onClick={() => handleOpenAnalyzer(item.id)}
              >
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-panel bg-surface-subtle border border-line flex items-center justify-center text-ink-subtle shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate max-w-xs">
                        {item.fileName}
                      </p>
                      <p className="text-xs text-ink-subtle mt-0.5">
                        {item.status === "analyzed" ? "Analysé" : "En cours"}
                        {item.activePatchCount > 0
                          ? ` · ${item.activePatchCount} modif.`
                          : ""}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-5 text-center">
                  <span className="text-sm text-ink-muted">
                    {item.clausesCount ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-5">
                  {level !== "—" ? (
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-chip border text-[11px] font-semibold tracking-wide ${getRiskStyles(level)}`}
                    >
                      {level}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-placeholder">—</span>
                  )}
                </td>
                <td className="px-4 py-5">
                  <span className="text-xs text-ink-subtle">
                    {formatDate(item.createdAt)}
                  </span>
                </td>

                <td className="px-6 py-5 text-right">
                  <div
                    className="relative inline-flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleAddToContratheque(item)}
                      disabled={addState[item.id] === "saving"}
                      title={
                        addState[item.id] === "done"
                          ? "Ajouté à la contrathèque"
                          : "Ajouter à la contrathèque"
                      }
                      className="p-1.5 text-ink-subtle hover:text-brand transition-colors rounded-lg hover:bg-surface-muted disabled:opacity-50"
                    >
                      {addState[item.id] === "done" ? (
                        <Check className="w-4 h-4 text-success stroke-[1.5]" />
                      ) : addState[item.id] === "saving" ? (
                        <Loader2 className="w-4 h-4 animate-spin stroke-[1.5]" />
                      ) : (
                        <FolderPlus className="w-4 h-4 stroke-[1.5]" />
                      )}
                    </button>
                    <button
                      onClick={() =>
                        setOpenMenuId(openMenuId === item.id ? null : item.id)
                      }
                      className="p-1.5 text-ink-subtle hover:text-ink-secondary transition-colors rounded-lg hover:bg-surface-muted"
                    >
                      <MoreVertical className="w-4 h-4 stroke-[1.5]" />
                    </button>
                    {openMenuId === item.id && (
                      <div className="absolute right-0 top-8 z-10 bg-white border border-line rounded-panel shadow-card-md py-1 min-w-[140px]">
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-danger hover:bg-danger-light transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Supprimer
                        </button>

                        <button
                          onClick={() => handleOpenAnalyzer(item.id)}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-brand hover:bg-brand/10 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Ouvrir
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
              className="px-6 py-16 text-center text-ink-subtle italic text-sm"
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
    </div>
    <Toaster position="top-right" />
    </>
  );
}

/** Petite carte KPI — même gabarit que la bibliothèque de clauses. */
function KpiCard({
  label, value, icon: Icon, accent,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-card border border-line shadow-card p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-panel flex items-center justify-center shrink-0" style={{ backgroundColor: accent + "18" }}>
        <Icon className="w-5 h-5 stroke-[1.5]" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tracking-tight text-ink">{value}</p>
        <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest leading-tight mt-0.5">{label}</p>
      </div>
    </div>
  );
}
