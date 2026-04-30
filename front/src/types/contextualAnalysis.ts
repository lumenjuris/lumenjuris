/* ------------------------------------------------------------------
   Types pour l'analyse contextuelle personnalisée
   ------------------------------------------------------------------ */

export interface AnalysisContext {
  // Type de contrat - plus universel
  contractType: string; // Permet n'importe quel type

  // Secteur d'activité
  industry?: string; // Secteur d'activité optionnel

  // Rôle de l'utilisateur dans le contrat - plus flexible
  userRole: string; // Permet n'importe quel rôle

  // Mission/contexte de la consultation - MAINTENANT OPTIONNEL
  missionContext?: string;

  // Questions spécifiques posées par l'utilisateur
  specificQuestions: string;

  // Préoccupations spécifiques
  specificConcerns?: string[];

  // Niveau de détail d'analyse souhaité
  analysisDepth: 'quick' | 'detailed' | 'expert';

  // Orientation de l'analyse selon les intérêts
  interestOrientation: 'defensive' | 'balanced' | 'assertive';

  // NOUVEAU: Champ mission optionnel
  mission?: string;

  //Nouveau : Upgrade du context
  // Regime légal -> champs renseigné manuellement
  legalRegime?: string

  // Objectif du contrat -> champs renseigné manuellement
  contractObjective?: string

  // Contexte entreprise enrichi par les futures données utilisateur.
  // Pour l'instant ces champs peuvent rester vides: le prompt sait les traiter
  // comme des informations non renseignées.
  enterpriseContext?: EnterpriseAnalysisContext;
}

export interface EnterpriseAnalysisContext {
  // Convention collective applicable à l'entreprise de l'utilisateur.
  collectiveAgreement?: string | null;

  // Forme juridique de l'entreprise de l'utilisateur.
  companyLegalForm?: string | null;
}

export interface ContextualAnalysisResult {
  // Contexte de l'analyse
  context: AnalysisContext;

  // Clauses prioritaires selon le contexte utilisateur
  clauses_prioritaires: PriorityClause[];

  // Clauses ajustées selon le contexte
  adjustedClauses: any[]; // Type flexible pour les clauses

  // Recommandations générales
  recommendations: string[];

  // Profil de risque
  riskProfile: {
    overall: 'low' | 'medium' | 'high';
    distribution: { high: number; medium: number; low: number };
  };

  // Insights spécifiques
  specificInsights: string[];

  // Réponses aux questions spécifiques
  reponses_questions?: Record<string, string>;

  // Recommandations personnalisées selon le rôle
  recommandations_personnalisees?: string[];

  // Points de négociation possibles
  points_negociation?: NegotiationPoint[];

  // Alertes critiques spécifiques à la situation
  alertes_critiques?: CriticalAlert[];

  // Score de risque personnalisé
  risk_score_personnalise?: number;

  // Résumé exécutif personnalisé
  resume_executif?: string;
}

export interface PriorityClause {
  id: string;
  text: string;
  type: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  impact_pour_utilisateur: string;
  conseil_specifique: string;
  keywords?: string[]; // Mots-clés pour le surlignage
}

export interface NegotiationPoint {
  titre: string;
  description: string;
  conseil: string;
  difficulte: 'facile' | 'moyenne' | 'difficile';
  impact_financier?: string;
  alternative_suggeree?: string;
}

export interface CriticalAlert {
  type: 'legal' | 'financial' | 'operational' | 'temporal';
  titre: string;
  description: string;
  action_immediate: string;
  consequence_si_ignore: string;
}

// Options pour chaque type de contexte
export const CONTRACT_TYPES = [
  { value: 'commercial', label: '🤝 Contrat commercial', description: 'Vente, achat, distribution' },
  { value: 'emploi', label: '👤 Contrat de travail', description: 'CDI, CDD, stage, freelance' },
  { value: 'prestation', label: '💼 Prestation de services', description: 'Conseil, développement, maintenance' },
  { value: 'bail', label: '🏠 Bail / Location', description: 'Commercial, habitation, bureaux' },
  { value: 'partenariat', label: '🤝 Partenariat', description: 'Joint-venture, alliance, coopération' },
  { value: 'franchise', label: '🍔 Franchise', description: 'Franchiseur, franchisé' },
  { value: 'autre', label: '📋 Autre', description: 'Autre type de contrat' }
];

export const USER_ROLES = [
  { value: 'acheteur', label: '🛒 Acheteur/Client', description: 'Vous achetez un bien ou service' },
  { value: 'vendeur', label: '💼 Vendeur/Prestataire', description: 'Vous vendez ou fournissez' },
  { value: 'employe', label: '👤 Employé/Salarié', description: 'Vous êtes embauché' },
  { value: 'employeur', label: '🏢 Employeur', description: 'Vous embauchez' },
  { value: 'locataire', label: '🔑 Locataire', description: 'Vous louez un bien' },
  { value: 'proprietaire', label: '🏠 Propriétaire', description: 'Vous mettez en location' },
  { value: 'franchiseur', label: '🏪 Franchiseur', description: 'Vous accordez une franchise' },
  { value: 'franchise', label: '🍕 Franchisé', description: 'Vous prenez une franchise' },
  { value: 'partenaire', label: '🤝 Partenaire', description: 'Vous êtes en partenariat' }
];

export const CONCERN_OPTIONS = [
  { value: 'responsabilite', label: '🛡️ Responsabilité et garanties', description: 'Qui est responsable en cas de problème ?' },
  { value: 'financier', label: '💰 Conditions financières', description: 'Prix, paiements, pénalités' },
  { value: 'delais', label: '⏰ Délais et échéances', description: 'Dates limites, retards, planning' },
  { value: 'resiliation', label: '🚪 Conditions de sortie', description: 'Comment arrêter le contrat ?' },
  { value: 'confidentialite', label: '🔒 Confidentialité', description: 'Protection des informations' },
  { value: 'propriete', label: '📋 Propriété intellectuelle', description: 'Qui possède quoi ?' },
  { value: 'litige', label: '⚖️ Résolution des conflits', description: 'Que faire en cas de dispute ?' },
  { value: 'modification', label: '✏️ Modifications du contrat', description: 'Peut-on changer les termes ?' }
];

export const INDUSTRIES = [
  'Technologie/IT', 'Immobilier', 'Conseil', 'Commerce/Retail',
  'Industrie', 'Santé', 'Éducation', 'Finance', 'Restauration',
  'Construction', 'Transport', 'Énergie', 'Média', 'Autre'
];
