import { useEffect, useRef, useState } from "react";
import { COMPLETION_ANIMATION_MS, LoadingZoneAnalyzer } from "../common/LoadingZoneAnalyzer";
import { useContractAnalysis } from "../../hooks/useContractAnalysis";
import { ContractSummary, ContractSummuryList, ClauseItem, summarizeContract, deleteSummarizeContract } from "../../utils/contractSummarizer";
import { fetchProxy } from "../../utils/fetchProxy";
import { Clock, Trash2 } from "lucide-react";
import { relativeTime } from "../../utils/format/relativeTime";
import { AlertBanner } from "../common/AlertBanner";
import { ConfirmationModal } from "../ui/ConfirmationModal";

const formatParty = (partie: any) => {
  if (!partie) return "Partie non identifiée";
  if (typeof partie === "string") return partie;

  if (typeof partie === "object") {
    const rawName = partie.nom || partie.nom_prenom || partie.denomination || partie.raison_sociale;
    const name = (rawName && rawName !== "null") ? String(rawName).trim() : null;

    const rawRole = partie.qualite || partie.role || partie.type;
    const role = (rawRole && rawRole !== "null") ? String(rawRole).trim() : null;

    if (name && role) return `${name} (${role})`;
    if (name) return name;
    if (role) return role;
  }
  return "Partie non identifiée";
};

const hasValidContent = (obj: any) => {
  if (!obj) return false;
  if (typeof obj === "string") return obj.trim().length > 0;
  if (typeof obj === "object") {
    return Object.values(obj).some(
      (val) => val !== null && val !== undefined && val !== "" && (!Array.isArray(val) || val.length > 0)
    );
  }
  return false;
};

// Formats acceptés pour l'import (identiques à la zone d'import de l'analyzer)
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function ComprendreContrat() {
  const { handleFileUpload } = useContractAnalysis();
  const [summary, setSummary] = useState<ContractSummary | null>(null);

  type llm = "gpt-4o-mini" | "gpt-4o" | "gpt-5.2" | "gpt-5.2-nano";

  const selectLlm : llm = "gpt-4o-mini";


  // Input fichier caché : le bouton "Analysez un contrat" ouvre directement l'explorateur
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFileTypeError, setIsFileTypeError] = useState(false);
  const [isSummaryError, setIsSummaryError] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ContractSummary | null>(null);
  const [contractsList, setContractsList] = useState<ContractSummuryList[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDelete, setIsDelete] = useState(false);
  const [isDeleteError, setIsDeleteError] = useState(false);
  const [validateModalOpen, setValidateModalOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<number | null>(null);
  // Vrai du choix du fichier jusqu'à la réponse de l'IA (extraction + résumé)
  const [isLoadingContract, setIsLoadingContract] = useState(false);
  // Vrai quand l'IA a répondu : le loader se remplit à 100 % avant d'afficher le résumé
  const [isSummaryReady, setIsSummaryReady] = useState(false);

  const activeSummary = selectedContract || summary;

  const openFilePicker = () => {
    if (isLoadingContract) return;
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // On vide l'input pour pouvoir re-sélectionner le même fichier plus tard
    event.target.value = "";
    if (!file) return;

    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setIsFileTypeError(true);
      return;
    }
    setIsFileTypeError(false);
    void handleFile(file);
  };

  const handleFile = async (file: File) => {
    try {
      setIsLoadingContract(true);
      setIsSummaryReady(false);
      setIsSummaryError(false);
      setSummary(null);
      setSelectedContract(null);

      const extracted = await handleFileUpload(file);
      if (!extracted?.content) {
        setIsSummaryError(true);
        return;
      }

      const resSummary = await summarizeContract(extracted.content, extracted.fileName, selectLlm);

      // On laisse le temps à la barre d'arriver à 100 % avant de changer de vue
      setIsSummaryReady(true);
      await new Promise((resolve) => setTimeout(resolve, COMPLETION_ANIMATION_MS));

      setSummary(resSummary);
      void handleListContract();
    } catch (error) {
      setIsSummaryError(true);
      console.error("Erreur lors de l'analyse du fichier : ", error);
    } finally {
      setIsLoadingContract(false);
    }
  };

  const handleListContract = async () => {
    try {
      setIsLoading(true);
      const res = await fetchProxy("/api/summarize-contract/list-contract-summarize", {
        credentials: "include",
      });
      const result = await res.json();

      if (result.success) {
        setContractsList(result.data);
      }
    } catch (error) {
      console.error("Erreur lors de la récupération de la liste :", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectContract = async (idSummary: number) => {
    try {
      const res = await fetchProxy(`/api/summarize-contract/content?idSummary=${idSummary}`, {
        credentials: "include",
      });
      const result = await res.json();

      if (result.success) {
        setSelectedContract(result.data);
        setSummary(null);
      }
    } catch (error) {
      console.error("Erreur lors de la récupération du contrat :", error);
    }
  };

  const openDeleteModal = (idSummary: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setContractToDelete(idSummary);
    setValidateModalOpen(true);
  }

  const handleDeleteContract = async () => {
    if (!contractToDelete) return;

    try {
      setIsLoading(true);
      setIsDelete(false);
      await deleteSummarizeContract(contractToDelete);

      if (selectedContract?.idSummary === contractToDelete) {
        setSelectedContract(null);
        setSummary(null);
      }
      setIsDelete(true);
      await handleListContract();
    } catch (error) {
      setIsDeleteError(true);
      console.error("Erreur lors de la suppression du contrat : ", error);
    } finally {
      setIsLoading(false);
      setValidateModalOpen(false);
      setContractToDelete(null);
    }
  }



  useEffect(() => {
    handleListContract();
  }, []);




  return (

    <div className="flex flex-col lg:flex-row gap-6 mx-auto w-full max-w-7xl">
      <div className="order-2 w-full lg:order-1 lg:w-64 lg:shrink-0">
        <div className="flex flex-col overflow-hidden rounded-card border border-line bg-white shadow-card max-h-[60vh] lg:max-h-[calc(100vh-9rem)]">
          {/* En-tête */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
            <p className="text-sm font-semibold text-gray-900">Historique</p>
            {/* Retrait du petit bouton "+"            
 <button
              onClick={() => setIsModalOpen(true)}
              title="Analyser un contrat"
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white transition-colors hover:bg-brand-hover"
            >
              <Plus className="h-3.5 w-3.5" />
            </button> */}
          </div>

          {/* Liste ou état vide */}
          {!contractsList || contractsList.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-4 py-10">
              <p className="text-center text-xs text-gray-400">
                Aucun contrat analysé.
              </p>
            </div>
          ) : (
            <ul className="flex-1 space-y-1 overflow-auto px-3 py-3">
              {contractsList.map((contract: ContractSummuryList) => (
                <li key={contract.idSummary}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectContract(contract.idSummary)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleSelectContract(contract.idSummary)
                    }
                    className={`group flex w-full cursor-pointer items-start justify-between gap-2 rounded-xl px-3 py-3 text-left transition-colors ${selectedContract?.idSummary === contract.idSummary
                      ? "border border-brand/20 bg-brand-light"
                      : "hover:bg-gray-50"
                      }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-medium ${selectedContract?.idSummary === contract.idSummary
                          ? "text-brand"
                          : "text-gray-700"
                          }`}
                      >
                        {contract.fileName}
                      </p>
                      <div className="mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0 text-gray-400" />
                        <span className="text-[11px] text-gray-400">
                          {relativeTime(contract.createdAt)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => openDeleteModal(contract.idSummary, e)}
                      title="Supprimer"
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="order-1 flex-1 min-w-0 space-y-6 lg:order-2">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 bg-blue-primary p-5 sm:p-8 rounded-2xl">
          <div className="space-y-4 max-w-lg">
            <h2 className="text-xl sm:text-3xl font-semibold text-white leading-tight">
              Analyse et compréhension de contrat
            </h2>
            <p className="text-sm text-gray-primary leading-relaxed">
              Obtenez une synthèse claire de vos documents : points d'attention, niveau de risque et obligations clés.
            </p>
          </div>

          {/* Bouton blanc à droite : ouvre directement l'explorateur de fichiers */}
          <button
            onClick={openFilePicker}
            disabled={isLoadingContract}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-gray-900 text-sm font-medium rounded-xl hover:bg-gray-100
             transition-all duration-200 hover:-translate-y-0.5 will-change-transform shadow-sm shrink-0 self-start sm:self-auto
             disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <span className="text-base font-normal">+</span> Analysez un contrat
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={handleFileInputChange}
          />
        </div>

        <div className="space-y-3">

          {isFileTypeError && (
            <AlertBanner
              title="Erreur de fichier"
              variant="error"
              detail="Seuls les fichiers PDF, DOC et DOCX (Word) sont acceptés."
              duration={8000}
              onClose={() => setIsFileTypeError(false)}
            />
          )}

          {isSummaryError && (
            <AlertBanner
              title="Résumé impossible"
              variant="error"
              detail="Une erreur est survenue pendant l'analyse de votre contrat. Veuillez réessayer."
              duration={8000}
              onClose={() => setIsSummaryError(false)}
            />
          )}

          {isDeleteError && (
            <AlertBanner
              title="Suppression impossible"
              variant="error"
              detail="Impossible de supprimer votre contrat."
              duration={8000}
              onClose={() => setIsDeleteError(false)}
            />
          )}

          {isDelete && (
            <AlertBanner
              title="Succès de la suppression"
              variant="success"
              detail="Votre contrat a bien été supprimé."
              duration={3000}
              onClose={() => setIsDelete(false)}
            />
          )}

          <ConfirmationModal
            open={validateModalOpen}
            title="Supprimer le contrat"
            description={`Souhaitez-vous supprimer ce résumé de contrat ?`}
            confirmLabel="Valider"
            onConfirm={handleDeleteContract}
            onCancel={() => { setValidateModalOpen(false); setContractToDelete(null) }}
          />


          {isLoading && <p className="text-xs text-gray-500">Chargement de la liste...</p>}


        </div>

        {isLoadingContract ? (
          <div className="mt-8">
            <LoadingZoneAnalyzer phase="summary" isComplete={isSummaryReady} />
          </div>
        ) : activeSummary ? (
          <div className="mt-8 space-y-6 border-t border-gray-100 pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Résumé du contrat</h3>

              {activeSummary.niveau_risque?.niveau && (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${activeSummary.niveau_risque.niveau.toLowerCase().includes("élevé") ||
                    activeSummary.niveau_risque.niveau.toLowerCase().includes("haut")
                    ? "bg-red-100 text-red-800"
                    : activeSummary.niveau_risque.niveau.toLowerCase().includes("moyen")
                      ? "bg-amber-100 text-amber-800"
                      : "bg-green-100 text-green-800"
                    }`}
                >
                  Risque : {activeSummary.niveau_risque.niveau}
                </span>
              )}
            </div>

            {activeSummary.niveau_risque?.justification && (
              <p className="text-xs text-gray-500 italic">
                {activeSummary.niveau_risque.justification}
              </p>
            )}

            {Array.isArray(activeSummary.annexes) && activeSummary.annexes.length > 0 && (
              <div className="text-xs pt-2">
                <span className="font-medium text-blue-primary"> Annexes mentionnées : </span>
                {activeSummary.annexes
                  .map((annexe) => {
                    if (typeof annexe === "string") return annexe;

                    if (typeof annexe === "object" && annexe !== null) {
                      const entries = Object.entries(annexe);
                      const textVal = entries.find(
                        ([_, val]) => typeof val === "string" && val.trim() !== ""
                      )?.[1];

                      return textVal || "Annexe sans nom";
                    }

                    return String(annexe);
                  })
                  .filter(Boolean)
                  .join(", ")}
              </div>
            )}

            {activeSummary.resume_executif && (
              <div className="rounded-lg bg-gray-card p-4 border border-gray-300">
                <h4 className="font-semibold text-blue-primary mb-1">Résumé exécutif</h4>
                <p className="text-sm leading-relaxed">{activeSummary.resume_executif}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {activeSummary.objet && (
                <div className="rounded-lg bg-gray-card p-4 border border-gray-300">
                  <h4 className="font-semibold text-blue-primary">Objet du contrat</h4>
                  <p className="text-sm text-gray-600 mt-1">{activeSummary.objet}</p>
                </div>
              )}

              {Array.isArray(activeSummary.parties) && activeSummary.parties.length > 0 && (
                <div className="rounded-lg bg-gray-card p-4 border border-gray-300">
                  <h4 className="font-semibold text-blue-primary mb-2">Parties au contrat</h4>
                  <div className="flex flex-wrap gap-2">
                    {activeSummary.parties.map((partie, index) => (
                      <span
                        key={index}
                        className="rounded-md bg-blue-primary px-3 py-1.5 text-xs font-medium text-white border border-gray-200 capitalize"
                      >
                        {formatParty(partie)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {Array.isArray(activeSummary.points_attention) && activeSummary.points_attention.length > 0 && (
              <div className="">
                <div className="rounded-lg bg-gray-card p-4 border border-gray-300">
                  <h4 className="font-semibold text-blue-primary mb-2">Points d'attention</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {activeSummary.points_attention.map((point, index) => (
                      <li key={index}>{typeof point === "string" ? point : JSON.stringify(point)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {activeSummary.obligations && Object.keys(activeSummary.obligations).length > 0 && (
              <div className="rounded-lg bg-gray-card p-4 border border-gray-300">
                <h4 className="font-semibold text-blue-primary mb-2"> Obligations principales</h4>

                {/* GRILLE DÉDIÉE UNIQUEMENT AUX OBLIGATIONS (Preneur, Bailleur, etc.) */}
                {typeof activeSummary.obligations === "object" && !Array.isArray(activeSummary.obligations) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch text-sm text-gray-600">
                    {Object.entries(activeSummary.obligations).map(([key, val], index) => (
                      <div key={index} className="rounded-md bg-white p-3 border border-color-grey flex flex-col justify-between">
                        <div>
                          <span className="block font-medium text-gray-800 capitalize whitespace-pre-line mb-1">
                            {key.replace(/_/g, " ")} :
                          </span>
                          {Array.isArray(val) ? (
                            <ul className="list-disc list-inside space-y-0.5">
                              {val.map((item, i) => (
                                <li key={i}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
                              ))}
                            </ul>
                          ) : typeof val === "object" && val !== null ? (
                            <div className="text-gray-700 whitespace-pre-line space-y-1">
                              {Object.entries(val)
                                .filter(([_, v]) => {
                                  if (v === null || v === undefined) return false;
                                  if (typeof v === "string") return v.trim().length > 0;
                                  if (Array.isArray(v)) return v.length > 0;
                                  return true;
                                })
                                .map(([k, v], i) => {
                                  const formattedVal = Array.isArray(v) ? v.join(" ") : String(v);
                                  return (
                                    <div key={i} className="pl-2">
                                      <span className="font-semibold text-gray-800 uppercase">
                                        {i + 1}. {k.replace(/_/g, " ")} :
                                      </span>{" "}
                                      <span>{formattedVal}</span>
                                    </div>
                                  );
                                })}
                            </div>
                          ) : (
                            <span>{String(val ?? "Non spécifié")}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">{String(activeSummary.obligations)}</p>
                )}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              {Array.isArray(activeSummary.delais_importants) && activeSummary.delais_importants.length > 0 && (
                <div className="rounded-lg bg-gray-card p-4 border border-gray-300">
                  <h4 className="font-semibold text-blue-primary mb-2">Délais importants</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {activeSummary.delais_importants.map((delai, index) => (
                      <li key={index}>{typeof delai === "string" ? delai : JSON.stringify(delai)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {Array.isArray(activeSummary.clauses_particulieres) && activeSummary.clauses_particulieres.length > 0 && (
                <div className="rounded-lg bg-gray-card p-4 border border-gray-300">
                  <h4 className="font-semibold text-blue-primary mb-2">Clauses particulières</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {activeSummary.clauses_particulieres
                      .filter((clauseItem: ClauseItem | string) => {
                        // Si c'est une simple chaîne, on la garde seulement si elle n'est pas vide
                        if (typeof clauseItem === "string") return clauseItem.trim().length > 0;

                        if (typeof clauseItem === "object" && clauseItem !== null) {
                          // 1. Si elle possède un résumé explicite non vide, elle est valide
                          if (clauseItem.resume && String(clauseItem.resume).trim() !== "") return true;

                          // 2. Si un des booléens est explicitement `true`
                          const hasTrueFlag = Object.entries(clauseItem).some(
                            ([key, val]) => key !== "resume" && val === true
                          );
                          return hasTrueFlag;
                        }
                        return false;
                      })
                      .map((clauseItem: ClauseItem | string, index: number) => {
                        if (typeof clauseItem === "string") {
                          return <li key={index}>{clauseItem}</li>;
                        }

                        const entries = Object.entries(clauseItem);
                        const clauseEntry = entries.find(([key, val]) => key !== "resume" && val === true);

                        // Récupération propre du nom de la clause
                        const rawName = clauseItem.type || (clauseEntry ? clauseEntry[0] : null);
                        const clauseName = rawName ? rawName.replace(/_/g, " ") : "Clause";
                        const resumeText = clauseItem.resume;

                        return (
                          <li key={index}>
                            <strong className="capitalize">{clauseName}</strong>
                            {resumeText ? ` : ${resumeText}` : ""}
                          </li>
                        );
                      })}
                  </ul>
                </div>
              )}
            </div>

            {(hasValidContent(activeSummary.conditions_financieres) || hasValidContent(activeSummary.resiliation)) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-4">

                {hasValidContent(activeSummary.conditions_financieres) && (
                  <div className="rounded-lg bg-gray-card p-4 border border-gray-300">
                    <h4 className="font-semibold text-blue-primary mb-1">Conditions financières</h4>
                    <div className="text-xs p-3 rounded-lg space-y-1">
                      {typeof activeSummary.conditions_financieres === "object"
                        ? Object.entries(activeSummary.conditions_financieres)
                          .filter(([_, val]) => {
                            if (val === null || val === undefined) return false;
                            const str = String(val).trim().toLowerCase();
                            return str !== "" && str !== "null" && str !== "undefined";
                          })
                          .map(([k, val], i) => (
                            <div key={i}>
                              <span className="font-medium text-gray-700 capitalize">
                                {k.replace(/_/g, " ")} :{" "}
                              </span>
                              <span>{String(val)}</span>
                            </div>
                          ))
                        : activeSummary.conditions_financieres}
                    </div>
                  </div>
                )}

                {hasValidContent(activeSummary.resiliation) && (
                  <div className="rounded-lg bg-gray-card p-4 border border-gray-300">
                    <h4 className="font-semibold text-blue-primary mb-1">Modalités de résiliation</h4>
                    <div className="text-xs p-3 rounded-lg space-y-1">
                      {typeof activeSummary.resiliation === "object"
                        ? Object.entries(activeSummary.resiliation)
                          .filter(([_, val]) => {
                            if (val === null || val === undefined) return false;
                            const str = String(val).trim().toLowerCase();
                            return str !== "" && str !== "null" && str !== "undefined";
                          })
                          .map(([k, val], i) => (
                            <div key={i}>
                              <span className="font-medium text-gray-700 capitalize">
                                {k.replace(/_/g, " ")} :{" "}
                              </span>
                              <span>{String(val)}</span>
                            </div>
                          ))
                        : activeSummary.resiliation}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        ) : (
          <div className="mt-8 border-t border-gray-100 pt-8 text-center text-gray-400">
            <p className="text-sm">Sélectionnez un contrat dans la liste ci-dessus ou analysez-en un nouveau.</p>
          </div>
        )}

      </div>
    </div>
  );
}
