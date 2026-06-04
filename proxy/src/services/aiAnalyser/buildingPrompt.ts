import type { AnalysisContext } from "./types.js";
import {
  CONTEXTUAL_CLAUSE_ANALYSIS_PROMPT,
  CONTEXTUAL_CLAUSE_ANALYSIS_PROMPT_ULTIMATE,
  CLAUSE_ANALYSIS_PROMPT,
} from "./aiPrompts.js";

interface PromptContext {
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

interface EnterprisePromptContext {
  collectiveAgreement: string;
  companyLegalForm: string;
}

const UNKNOWN_CONTEXT_VALUE = "Non renseigné pour le moment";

export function buildClauseExtractionPromptForAI(
  sectionLabel: string,
  sectionText: string,
  context?: AnalysisContext,
  retryWithAnotherPrompt: boolean = false,
): string {
  const header = context
    ? buildContextualPrompt(
        !retryWithAnotherPrompt
          ? CONTEXTUAL_CLAUSE_ANALYSIS_PROMPT_ULTIMATE
          : CONTEXTUAL_CLAUSE_ANALYSIS_PROMPT,
        mapAnalysisContextToPromptContext(context),
      )
    : CLAUSE_ANALYSIS_PROMPT;
  return `${header}\n\n${sectionLabel}\n${sectionText}`;
}

function mapAnalysisContextToPromptContext(context: AnalysisContext): PromptContext {
  const enterpriseContext = mapEnterpriseContextToPromptContext(context);
  return {
    userRole: context.userRole || "la partie contractante",
    contractType: context.contractType || "contrat commercial",
    missionContext: context.missionContext || context.mission || "analyse contractuelle générale",
    strategicOrientation: context.interestOrientation || "balanced",
    industry: context.industry || "secteur général",
    contractObjective: context.contractObjective || UNKNOWN_CONTEXT_VALUE,
    legalRegime: context.legalRegime || UNKNOWN_CONTEXT_VALUE,
    enterpriseContext,
    enterpriseContextBlock: buildEnterpriseContextBlock(enterpriseContext),
  };
}

function mapEnterpriseContextToPromptContext(context: AnalysisContext): EnterprisePromptContext {
  return {
    collectiveAgreement: cleanPromptValue(context.enterpriseContext?.collectiveAgreement),
    companyLegalForm: cleanPromptValue(context.enterpriseContext?.companyLegalForm),
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

function buildContextualPrompt(template: string, context: PromptContext): string {
  return replacePromptPlaceholders(template, {
    userRole: context.userRole || "la partie contractante",
    contractType: context.contractType || "contrat commercial",
    mission: context.missionContext || "analyse contractuelle générale",
    strategicOrientation: context.strategicOrientation || "équilibré",
    industry: context.industry || "secteur général",
    legalRegime: context.legalRegime,
    contractObjective: context.contractObjective,
    enterpriseContext: context.enterpriseContextBlock,
    collectiveAgreement: context.enterpriseContext.collectiveAgreement,
    companyLegalForm: context.enterpriseContext.companyLegalForm,
  });
}

function replacePromptPlaceholders(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (prompt, [key, value]) =>
      prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), () => value),
    template,
  );
}
