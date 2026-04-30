export interface AltProposal {
  clause: string;
  benefits: string;
  riskReduction: string;
}

export interface ClauseAI {
  summary: string;
  riskLevel: 'High' | 'Medium' | 'Low';
  riskScore: number;
  litigation: string;
  issues: string[];
  advice: string;
  alternatives: AltProposal[];
  error?: string;
}

export interface ClauseRisk {
  id: string;
  type: string;
  content: string;
  riskScore: number;
  justification: string;
  suggestion: string;
  legalReference?: string | string[];
  category:
    | 'penalty'
    | 'termination'
    | 'responsibility'
    | 'confidentiality'
    | 'nonCompete'
    | 'warranty'
    | 'other';
  canLiiCases?: CanLiiCase[];
  riskFactors?: RiskFactor[];
  alternativeWording?: string[];
  jurisdictionSpecific?: JurisdictionInfo;
  page?: number;
  keywords?: string[]; // Mots-clés pour le surlignage
  startIndex?: number; // Coordonnée de début pour un surlignage précis
  endIndex?: number;   // Coordonnée de fin pour un surlignage précis
  // Nouveau champ pour les réponses contextuelles
  reponse_question_specifique?: string;
}

export interface CanLiiCase {
  id: string;
  title: string;
  citation: string;
  court: string;
  year: number;
  relevanceScore: number;
  summary: string;
  url: string;
  keyPrinciples: string[];
  date?: string; // ISO date string when available
}

/* Renommée pour être plus générique et adaptée au droit français. */
export interface JurisprudenceCase {
  id: string;
  title: string;
  citation: string;
  court: string;
  year: number;
  relevanceScore: number;
  summary: string;
  url: string;
  keyPrinciples?: string[];
  date?: string;
}

export interface KeywordSearchLink {
  query: string;
  url: string;
}

export interface Recommendation {
  title: string;
  clauseText: string;
  benefits: string;
  riskReduction: string;
}

export interface RiskFactor {
  factor: string;
  impact: 'high' | 'medium' | 'low';
  description: string;
  mitigation: string;
}

export interface JurisdictionInfo {
  province: string;
  applicableLaws: string[];
  specificConsiderations: string[];
}

export interface ContractAnalysis {
  id: string;
  fileName: string;
  uploadDate: Date;
  content: string;
  clauses: ClauseRisk[];
  overallRiskScore: number;
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  processed: boolean;
  jurisdiction: string;
  contractType: string;
  aiConfidenceScore: number;
  reviewHistory?: ReviewAction[];
  // Nouveaux champs pour l'analyse contextuelle
  reponses_questions_mandant?: Record<string, string>;
  mission_context?: string;
  user_role?: string;
  extractionMetadata?: {
    pages?: number;
    wordCount: number;
    language: string;
    extractionMethod: string;
    fileSize: string;
    extractionTime: string;
    protectionDetected?: boolean;
    isProtected?: boolean;
    extractionQuality?: 'high' | 'medium' | 'low';
    aiSummary?: string;
  };
}

export interface ReviewAction {
  id: string;
  timestamp: Date;
  action: 'accepted' | 'rejected' | 'modified';
  clauseId: string;
  userNote?: string;
  originalSuggestion: string;
  finalVersion?: string;
}

export interface RiskStats {
  totalClauses: number;
  criticalRisk: number;
  mediumRisk: number;
  lowRisk: number;
  criticalIssues: number;
  byCategory: CategoryStats[];
  complianceScore: number;
}

export interface CategoryStats {
  category: string;
  count: number;
  averageRisk: number;
  criticalCount: number;
}

export interface ComplianceCheck {
  regulation: string;
  status: 'compliant' | 'non-compliant' | 'requires-review';
  details: string;
  recommendations: string[];
}

export interface FallbackOption {
  title: string;
  description: string;
}

export interface ClauseRecommendation {
  title: string;
  /** Ex. "Risque réduit à 2/5" */
  riskReduction: string;
  clauseText: string;
  benefits: string;
  legalBasis?: string;
  negotiationTips?: string[];
  fallbackOptions?: FallbackOption[];
}

/* ----------- Textes de loi complets ------------ */
export interface LegalText {
  /** Ex. "CCQ art. 1474" */
  id: string;
  /** Intitulé abrégé */
  title: string;
  /** Texte intégral (plain-text) */
  fullText: string;
  /** Lien vérifié (optionnel) */
  url?: string;
}

export interface Clause {
  id: string;
  type: string;
  text: string;
  summary: string;
  risk: number;
  recommendation?: string;
  keywords?: string[];
  startIndex?: number;
  endIndex?: number;
}
