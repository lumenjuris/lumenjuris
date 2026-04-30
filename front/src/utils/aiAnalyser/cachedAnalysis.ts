
import { AnalysisContext } from "../../types/contextualAnalysis";
import { ClauseRisk } from "../../types";




const ANALYSIS_CACHE_NS = 'analysisV2:';


// --- Fonctions de Cache ---


function hashString(s: string): string {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    }
    return h.toString();
}


export function contextCacheKeyPart(context?: AnalysisContext): string {
    if (!context) return 'noctx';
    const shallow = {
        contractType: context.contractType,
        userRole: context.userRole,
        orientation: context.interestOrientation,
        mission: context.missionContext || context.mission || '',
        questions: (context.specificQuestions || '').slice(0, 200),
        legalRegime: context.legalRegime || '',
        contractObjective: context.contractObjective || '',
        enterpriseContext: {
            collectiveAgreement: context.enterpriseContext?.collectiveAgreement || '',
            companyLegalForm: context.enterpriseContext?.companyLegalForm || '',
        },
    };
    return hashString(JSON.stringify(shallow));
}

export function loadAnalysisFromCache(content: string, context?: AnalysisContext): ClauseRisk[] | null {
    try {
        const key = ANALYSIS_CACHE_NS + hashString(content) + ':' + contextCacheKeyPart(context);
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch { return null; }
}

export function saveAnalysisToCache(content: string, clauses: ClauseRisk[], context?: AnalysisContext): void {
    try {
        const key = ANALYSIS_CACHE_NS + hashString(content) + ':' + contextCacheKeyPart(context);
        sessionStorage.setItem(key, JSON.stringify(clauses));
    } catch { /* ignore */ }
}
