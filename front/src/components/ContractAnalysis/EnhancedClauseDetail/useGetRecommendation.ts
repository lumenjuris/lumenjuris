import { SetStateAction, useEffect, Dispatch } from "react";
import { perfMark, perfMeasure } from "./EnhancedClauseDetail";
import { ClauseRisk } from "../../../types";
import { Recommendation } from "../../../types";
import { AnalysisContext } from "../../../types/contextualAnalysis";
import { getRecommendedClauses } from "../../../utils/getRecommendedClauses";
import { type OpenAIModelId } from "../../../utils/aiClient";

const pendingRecommendationRequests = new Map<string, Promise<Recommendation[]>>();

export const useGetRecommendation = (
    clause: ClauseRisk,
    setAlternatives: Dispatch<SetStateAction<Recommendation[] | null>>,
    altCache: Record<string, Recommendation[]>,
    altCacheTime: Record<string, number>,
    context: AnalysisContext | undefined,
    model: OpenAIModelId
) => {
    useEffect(() => {
        if (!clause) return
        const RECO_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
        const id = clause.id
        const cacheKey = `${id}:${model}`;

        // Cache hit & valid TTL
        if (altCache[cacheKey] && altCacheTime[cacheKey] && Date.now() - altCacheTime[cacheKey] < RECO_CACHE_TTL) {
            setAlternatives(altCache[cacheKey]);
            return;
        }
        // Need fetch
        setAlternatives(null);
        const start = `clause:${id}:open`;
        let cancelled = false;
        const request = pendingRecommendationRequests.get(cacheKey) ?? getRecommendedClauses(clause, context, model)
            .then(alts => {
                altCache[cacheKey] = alts;
                altCacheTime[cacheKey] = Date.now();
                return alts;
            })
            .finally(() => {
                pendingRecommendationRequests.delete(cacheKey);
            });

        pendingRecommendationRequests.set(cacheKey, request);

        request.then(alts => {
            if (cancelled) return;
            setAlternatives(alts);
            perfMark(`clause:${id}:reco_ready`);
            perfMeasure(`clause:${id}:time_to_reco`, start, `clause:${id}:reco_ready`);
        });
        return () => {
            cancelled = true;
        };
    }, [clause, context, model, setAlternatives]);

}
