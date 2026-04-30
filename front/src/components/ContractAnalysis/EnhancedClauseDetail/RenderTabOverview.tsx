import { SetStateAction, Dispatch } from "react";
import { Loader } from 'lucide-react';
import { findBestClauseSpan } from "../../../utils/textPatchLocator";
import { ClauseAI, ClauseRecommendation, ClauseRisk } from "../../../types";
import { Recommendation } from "../../../types";
import { copyToClipboard } from "./EnhancedClauseDetail";
import { useDocumentTextStore } from "../../../store/documentTextStore";
import { useAppliedRecommendationsStore } from "../../../store/appliedRecommendationsStore";
import { type OpenAIModelId } from "../../../utils/aiClient";


interface ClauseAIModelOption {
    value: OpenAIModelId;
    label: string;
}

interface PropsRenderTabOverview {
    longText: string,
    shortText: string,
    expanded: boolean,
    setExpanded: Dispatch<SetStateAction<boolean>>
    ai: ClauseAI | undefined,
    alternatives: Recommendation[] | null
    clause: ClauseRisk,
    originalTextGlobal: string,
    recommendationIndex: number,
    setRecommendationIndex: (index: number) => void
    clauseAiModel: OpenAIModelId,
    clauseAiModelOptions: ClauseAIModelOption[],
    onClauseAiModelChange: (model: OpenAIModelId) => void
}
export const RenderTabOverview: React.FC<PropsRenderTabOverview> = ({
    longText,
    shortText,
    expanded,
    setExpanded,
    ai,
    alternatives,
    clause,
    originalTextGlobal,
    recommendationIndex,
    setRecommendationIndex,
    clauseAiModel,
    clauseAiModelOptions,
    onClauseAiModelChange
}) => {




    const applyPatch = useDocumentTextStore(s => s.applyPatch)
    const removePatch = useDocumentTextStore(s => s.removePatch);
    const { getAllRecommendation, applyRecommendation, removeAppliedRecommendation } = useAppliedRecommendationsStore()



    const handleRemove = (recommendationKey: string) => {
        if (!clause) return;
        const clauseId = clause.id
        const allReco = getAllRecommendation()
        const currentPatch = allReco.find(r => r.clauseId === clauseId);

        console.log("La clause a supprimer qui existe déjà :", currentPatch)

        if (currentPatch) {
            console.log("Suppression de l'ancienne recommendation:", currentPatch)
            removeAppliedRecommendation(clauseId, currentPatch.recommendationIndex)

            const removePatch = useDocumentTextStore.getState().removePatch;
            const oldKey = `${clauseId}:${currentPatch.recommendationIndex}`
            removePatch(oldKey)
        }


        //Retire le texte modifié du render 
        console.log("clef de la recommendation à retirer:", recommendationKey)
        removePatch(recommendationKey);

        //Retire la recommendation du store
        removeAppliedRecommendation(clause.id, recommendationIndex);
    };



    const handleApply = (
        alreadyExist: Recommendation[] | undefined,
        clauseRecommendation: ClauseRecommendation,
        recommendationKey: string
    ) => {
        const allReco = getAllRecommendation();

        console.log("Application d'un patch les recommendations déjà saisies :", allReco)
        const clauseId = clause.id

        if (alreadyExist) {
            //detruire l'ancienne recommandation et ajouter la nouvelle
            console.warn('[reco] Recommandation déjà appliquée, ignorée', { clauseId });
            return;
        }
        applyRecommendation(clause.id, recommendationIndex, clauseRecommendation, clause);
        let anchor = findBestClauseSpan(originalTextGlobal, clause);

        if (!anchor) {
            return console.log("impossible de retrouver les index de positionnement, retour de la fonction d'application de recommendation forcé")
        }


        applyPatch({
            clauseId: clause.id,
            recommendationKey,
            startOrig: anchor.start,
            endOrig: anchor.end,
            newSlice: clauseRecommendation.clauseText,
            originalSlice: clause.content
        });
        setRecommendationIndex(recommendationIndex)
    }








    return (
        <div className="space-y-5 text-sm">
            {/* Texte identifié */}
            <section className="rounded-md border border-slate-200 bg-white p-4">
                <header className="mb-3 flex items-center gap-2">
                    <h4 className="font-semibold text-slate-800 flex items-center gap-1">
                        <span className="text-slate-500">📄</span> Texte
                    </h4>
                </header>
                <pre className="whitespace-pre-wrap leading-relaxed text-slate-700 font-sans">{shortText}</pre>
                {longText.length > 800 && (
                    <div className="mt-3 flex justify-center">
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                            {expanded ? 'Réduire' : `Voir complet (${longText.length})`}
                        </button>
                    </div>
                )}
            </section>

            <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h4 className="font-semibold text-slate-800">Comparaison IA</h4>
                        <p className="mt-1 text-xs text-slate-500">
                            Change le modèle pour régénérer les problèmes et les propositions de clause.
                        </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Modèle
                        <select
                            value={clauseAiModel}
                            onChange={(event) => onClauseAiModelChange(event.target.value as OpenAIModelId)}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium normal-case tracking-normal text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            {clauseAiModelOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </section>

            {/* Problèmes */}
            <section className="rounded-md border border-slate-200 bg-white p-4">
                <header className="mb-3 flex items-center gap-2">
                    <h4 className="font-semibold text-slate-800 flex items-center gap-1">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600 text-sm">⚠️</span>
                        Problèmes
                    </h4>
                </header>

                {!ai ? (
                    <div className="py-2 space-y-2">
                        <div className="h-3 rounded bg-slate-200 animate-pulse w-5/6" />
                        <div className="h-3 rounded bg-slate-200 animate-pulse w-4/6" />
                        <div className="h-3 rounded bg-slate-200 animate-pulse w-3/5" />
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {ai.error ? (
                            <li className="rounded-sm bg-amber-50 px-2 py-1.5 text-amber-700">
                                {ai.error}
                            </li>
                        ) : ai?.issues?.length ? (
                            ai.issues.map((issue: string, i: number) => (
                                <li key={i} className="flex gap-2 rounded-sm px-2 py-1.5 leading-snug text-slate-700">
                                    <span className="mt-0.5 text-red-500">•</span>
                                    <span>{issue}</span>
                                </li>
                            ))
                        ) : (
                            <li className="text-slate-500">Aucun problème identifié</li>
                        )}
                    </ul>
                )}
            </section>




            {/* Recommandations */}
            <section className="rounded-md border border-green-100 bg-green-50/40 p-4">
                <header className="mb-3 flex items-center gap-2">
                    <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600 text-sm">💡</span>
                        Recommandations
                    </h4>
                </header>
                {!alternatives ? (
                    <ul className="space-y-3">
                        {Array.from({ length: 2 }).map((_, i) => (
                            <li key={i} className="rounded-md border border-green-200 bg-green-50/70 p-3 space-y-2 animate-pulse relative">
                                <Loader className="animate-spin text-green-500 w-6 h-6 absolute" />
                                <div className="flex justify-end gap-2 relative">
                                    <div className="h-4 w-12 bg-green-100 rounded" />
                                    <div className="h-4 w-16 bg-green-100 rounded" />
                                </div>

                                <div className="h-3 bg-green-100 rounded w-11/12" />
                                <div className="h-3 bg-green-100 rounded w-10/12" />
                                <div className="h-3 bg-green-100 rounded w-2/3" />
                            </li>
                        ))}
                    </ul>
                ) : alternatives.length === 0 ? (
                    <div className="rounded border border-dashed border-green-200 p-3 text-center text-slate-500">Aucune recommandation générée.</div>
                ) : (
                    <ul className="space-y-3 text-sm">
                        {alternatives.map((alternative, index) => {

                            const allReco = getAllRecommendation();
                            const clauseId = clause.id
                            const currentRecommendation = allReco.find(r => r.clauseId === clauseId);
                            const recommendationKey = clause ? `${clause.id}:${index}` : `${index}`;



                            return (
                                <li key={index}
                                    className={`rounded-md border px-3 py-3 transition-colors ${currentRecommendation ? 'bg-green-50 border-green-300' : 'bg-green-50/70 border-green-200 hover:border-green-300'}`}>

                                    {/* Button CTA */}
                                    <div className="mb-2 flex items-start justify-end gap-2 text-sm">
                                        <button onClick={() => copyToClipboard(alternative.clauseText)} className="rounded-full px-3 py-1 font-semibold text-slate-700 border border-slate-400 bg-slate-100 hover:bg-slate-200" title="Copier cette recommandation">Copier</button>
                                        {currentRecommendation ? (
                                            <button onClick={() => handleRemove(recommendationKey)}
                                                className="rounded-full px-3 py-1 font-semibold text-slate-700 border border-slate-400 bg-slate-100 hover:bg-slate-200">
                                                Retirer
                                            </button>
                                        ) : (
                                            <button onClick={() =>
                                                handleApply(
                                                    currentRecommendation,
                                                    alternative,
                                                    recommendationKey
                                                )
                                            }
                                                className="rounded-full px-3 py-1 font-semibold text-slate-700 border border-slate-400 bg-slate-100 hover:bg-slate-200">
                                                Appliquer
                                            </button>
                                        )}
                                    </div>


                                    <pre className="whitespace-pre-wrap leading-relaxed text-slate-700 mb-2 text-sm font-sans">{alternative.clauseText}</pre>

                                    <div className="flex flex-col gap-1 text-xs text-slate-500">
                                        <div>
                                            <span className="font-medium text-slate-600">
                                                Avantages :
                                            </span>
                                            {alternative.benefits}
                                        </div>

                                        <div>
                                            <span className="font-medium text-slate-600">
                                                Réduction des risques :
                                            </span>
                                            {alternative.riskReduction}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
}
