// Feature flags pour contrôler les nouvelles fonctionnalités
export const FEATURE_FLAGS = {
  // Sidebar avec liste des clauses détectées
  ENABLE_CLAUSES_SIDEBAR: true,
  
  // Mode debug pour le développement
  DEBUG_MODE: process.env.NODE_ENV === 'development',
  
  // Autres features futures
  ENABLE_ADVANCED_HIGHLIGHTING: false,
  ENABLE_REAL_TIME_ANALYSIS: false,
  // Nettoyage léger (déchets) post-extraction sans restructuration
  ENABLE_LIGHT_SANITIZE: true,
  // Vérifications d'intégrité (hash slice + contrôle mismatch rebuild)
  ENABLE_PATCH_INTEGRITY_CHECKS: true,
  // Calcul des segments de diff (lecture seule) pour future visualisation
  ENABLE_PATCH_DIFF_COMPUTE: false,
  // Index trigram pour recherche robuste (fallback ultime)
  ENABLE_TRIGRAM_INDEX: false,
} as const;

// Helper pour vérifier si une feature est activée
export const isFeatureEnabled = (feature: keyof typeof FEATURE_FLAGS): boolean => {
  return FEATURE_FLAGS[feature];
};

export default FEATURE_FLAGS; 