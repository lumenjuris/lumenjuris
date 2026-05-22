export interface ClauseRisk {
  id: string;
  type: string;
  content: string;
  riskScore: number;
  justification: string;
  suggestion: string;
  legalReference?: string | string[];
  category:
    | "penalty"
    | "termination"
    | "responsibility"
    | "confidentiality"
    | "nonCompete"
    | "warranty"
    | "other";
  page?: number;
  keywords?: string[];
  startIndex?: number;
  endIndex?: number;
  reponse_question_specifique?: string;
}

export interface EnterpriseAnalysisContext {
  collectiveAgreement?: string | null;
  companyLegalForm?: string | null;
}

export interface AnalysisContext {
  contractType: string;
  industry?: string;
  userRole: string;
  missionContext?: string;
  specificQuestions: string;
  specificConcerns?: string[];
  analysisDepth: "quick" | "detailed" | "expert";
  interestOrientation: "defensive" | "balanced" | "assertive";
  mission?: string;
  legalRegime?: string;
  contractObjective?: string;
  enterpriseContext?: EnterpriseAnalysisContext;
}
