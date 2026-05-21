import { Scale } from "lucide-react";
import { JurisprudenceCase } from "../../../types"



interface TabCasesProps {
    keywordSearches: { query: string; url: string }[],
    isLoadingDecisions: boolean,
    automaticDecisions: JurisprudenceCase[]
}

export const RenderTabCases : React.FC<TabCasesProps> = ({
    keywordSearches,
    isLoadingDecisions,
    automaticDecisions,
}) =>{


    return (
        <div className="space-y-4 text-sm">
            {/* Bloc recherche par mots-clés */}
            <section className="rounded-md border border-slate-200 bg-white p-4">
                <header className="mb-2 flex items-center gap-2">
                    <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                        🔍 Recherche par mots-clés
                    </h4>
                </header>
                {keywordSearches.length === 0 ? (
                    <p className="text-slate-500 text-sm">Aucun mot-clé disponible pour cette clause.</p>
                ) : (
                    <ul className="flex flex-wrap gap-2">
                        {keywordSearches.map(ks => (
                            <li key={ks.query}>
                                <a
                                    href={ks.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 hover:bg-slate-100 px-3 py-1 text-sm text-slate-700 transition-colors"
                                >
                                    <span>{ks.query}</span>
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-4">
                <header className="mb-3 flex items-center gap-2">
                    <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Scale className="w-4 h-4" /> Recherche par décision
                    </h4>
                </header>
                {isLoadingDecisions ? (
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="p-3 border rounded-md bg-slate-50 animate-pulse space-y-2">
                                <div className="h-3 bg-slate-200 rounded w-2/3" />
                                <div className="h-3 bg-slate-200 rounded w-full" />
                                <div className="h-3 bg-slate-200 rounded w-5/6" />
                            </div>
                        ))}
                    </div>
                ) : automaticDecisions.length > 0 ? (
                    <div className="space-y-3">
                        {automaticDecisions.map((decision, index) => {
                            const displayTitle = decision.title || `Décision ${index + 1}`;
                            return (
                                <div
                                    key={decision.id || `decision-${index}`}
                                    className="block p-3 border rounded-md bg-slate-50 space-y-2"
                                >
                                    <a
                                        href={decision.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block font-medium text-blue-700 hover:underline text-sm"
                                    >
                                        {displayTitle}
                                    </a>
                                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                                        {decision.court && <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full text-xs">{decision.court}</span>}
                                        {decision.date && <span className="text-slate-400 text-xs">{decision.date}</span>}
                                    </div>
                                    {(decision.litige || decision.resultat) ? (
                                        <div className="space-y-1.5 pt-1 border-t border-slate-200">
                                            {decision.litige && (
                                                <div>
                                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Litige</span>
                                                    <p className="text-xs text-slate-700 mt-0.5">{decision.litige}</p>
                                                </div>
                                            )}
                                            {decision.resultat && (
                                                <div>
                                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Résultat</span>
                                                    <p className="text-xs text-slate-700 mt-0.5">{decision.resultat}</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : decision.summary ? (
                                        <p className="text-xs text-slate-600 line-clamp-4 pt-1 border-t border-slate-200">{decision.summary}</p>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center text-slate-500 p-6 border-dashed border-2 rounded-lg">
                        <div className="text-4xl mb-2">📚</div>
                        <p className="font-semibold text-sm">Aucune décision trouvée</p>
                        <p className="text-sm text-slate-400 mt-1">Pas de résultats avec la recherche automatique.</p>
                    </div>
                )}
            </section>
        </div>
    );
}