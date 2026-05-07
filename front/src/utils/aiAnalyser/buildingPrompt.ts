

import { AnalysisContext } from "../../types/contextualAnalysis";

import {
    CONTEXTUAL_CLAUSE_ANALYSIS_PROMPT,
    CONTEXTUAL_CLAUSE_ANALYSIS_PROMPT_ULTIMATE,
    CLAUSE_ANALYSIS_PROMPT,

} from "./aiPrompts";


/**
 * Contexte normalisé utilisé pour l'injection des variables
 * dans les prompts d'analyse contractuelle.
 */
export interface PromptContext {
    userRole: string;
    contractType: string;
    missionContext: string;
    strategicOrientation: string;
    industry: string;
    contractObjective: string;
    legalRegime: string;
    enterpriseContext: EnterprisePromptContext;
    enterpriseContextBlock: string;
}

export interface EnterprisePromptContext {
    collectiveAgreement: string;
    companyLegalForm: string;
}

const UNKNOWN_CONTEXT_VALUE = "Non renseigné pour le moment";


/**
 * Construit le prompt d'extraction de clauses à risque pour l'analyse principale.
 * 
 * @param { string } sectionLabel - Label affiché entre le prompt et le texte du contrat
 * @param { string } sectionText - Le texte brut du contrat
 * @param { AnalysisContext } context - Contexte brut issu de l'analyse du contrat si présent
 * @param { boolean } retryWithAnotherPrompt - En cas d'echec du premier prompt "CONTEXTUAL_CLAUSE_ANALYSIS_PROMPT_ULTIMATE" on utilise le deuxieme "CONTEXTUAL_CLAUSE_ANALYSIS_PROMPT" qui est un peu moins poussé
 * @returns { string } - Le prompt prêt à être utilisé
 */
export function buildClauseExtractionPromptForAI(
    sectionLabel: string,
    sectionText: string,
    context?: AnalysisContext,
    retryWithAnotherPrompt: boolean = false
): string {
    const header = context
        ? `${buildContextualPrompt(
            !retryWithAnotherPrompt ? CONTEXTUAL_CLAUSE_ANALYSIS_PROMPT_ULTIMATE : CONTEXTUAL_CLAUSE_ANALYSIS_PROMPT,
            mapAnalysisContextToPromptContext(context)
        )}`
        : CLAUSE_ANALYSIS_PROMPT;
    return `${header}\n\n${sectionLabel}\n${sectionText}`;
}




/**
 * Transforme un AnalysisContext en PromptContext exploitable par le moteur de prompt.
 * Effectue un mapping des propriétés et applique des valeurs de repli
 * lorsque certaines informations sont absentes.
 * 
 * @param {AnalysisContext} context - Contexte brut issu de l'analyse du contrat
 * @returns { PromptContext } - Contexte formaté pour la génération de prompt
 */
export function mapAnalysisContextToPromptContext(context: AnalysisContext): PromptContext {
    const enterpriseContext = mapEnterpriseContextToPromptContext(context);

    return {
        userRole: context.userRole || 'la partie contractante',
        contractType: context.contractType || 'contrat commercial',
        missionContext: context.missionContext || context.mission || 'analyse contractuelle générale',
        strategicOrientation: context.interestOrientation || 'balanced',
        industry: context.industry || 'secteur général',
        contractObjective: context.contractObjective || UNKNOWN_CONTEXT_VALUE,
        legalRegime: context.legalRegime || UNKNOWN_CONTEXT_VALUE,
        enterpriseContext,
        enterpriseContextBlock: buildEnterpriseContextBlock(enterpriseContext),
    };
}

function mapEnterpriseContextToPromptContext(context: AnalysisContext): EnterprisePromptContext {
    const enterpriseContext = context.enterpriseContext;

    return {
        collectiveAgreement: cleanPromptValue(enterpriseContext?.collectiveAgreement),
        companyLegalForm: cleanPromptValue(enterpriseContext?.companyLegalForm),
    };
}

function cleanPromptValue(value?: string | null): string {
    const cleanedValue = value?.trim();
    return cleanedValue || UNKNOWN_CONTEXT_VALUE;
}

function buildEnterpriseContextBlock(context: EnterprisePromptContext): string {
    return [
        "- Convention collective applicable : " + context.collectiveAgreement,
        "- Forme juridique de l'entreprise utilisatrice : " + context.companyLegalForm,
    ].join("\n");
}

export function buildEnterpriseContextBlockFromAnalysisContext(context?: AnalysisContext): string {
    if (!context) return "";
    return mapAnalysisContextToPromptContext(context).enterpriseContextBlock;
}






/**
 * Remplace dynamiquement un prompt par le context de l'analyse du contrat via les placeHolder {{ variable }}
 * 
 * @param {string} template - Le prompt où l'on injecte le context 
 * @param {PromptContext} context - Le context de l'analyse du contrat
 * @returns { string } - Le prompt final avec les valeurs injectées
 */
export function buildContextualPrompt(template: string, context: PromptContext): string {
    return replacePromptPlaceholders(template, {
        userRole: context.userRole || 'la partie contractante',
        contractType: context.contractType || 'contrat commercial',
        mission: context.missionContext || 'analyse contractuelle générale',
        strategicOrientation: context.strategicOrientation || 'équilibré',
        industry: context.industry || 'secteur général',
        legalRegime: context.legalRegime,
        contractObjective: context.contractObjective,
        enterpriseContext: context.enterpriseContextBlock,
        collectiveAgreement: context.enterpriseContext.collectiveAgreement,
        companyLegalForm: context.enterpriseContext.companyLegalForm,
    });

}

function replacePromptPlaceholders(template: string, values: Record<string, string>): string {
    return Object.entries(values).reduce(
        (prompt, [key, value]) => prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), () => value),
        template,
    );
}
