/**
 * Types de la réponse de l'API publique « Recherche d'entreprises » :
 * https://recherche-entreprises.api.gouv.fr/search
 *
 * Seuls les champs réellement consommés par le mapping sont typés ; l'API en
 * renvoie davantage, mais on évite volontairement `any` et on reste tolérant
 * aux champs absents (tous optionnels / nullables).
 */

export interface CompanyDirigeant {
  nom?: string | null;
  prenoms?: string | null;
  qualite?: string | null;
  type_dirigeant?: string | null;
}

/** Un établissement (siège ou établissement correspondant à un SIRET). */
export interface CompanyEtablissement {
  siret?: string | null;
  adresse?: string | null;
  complement_adresse?: string | null;
  numero_voie?: string | null;
  type_voie?: string | null;
  libelle_voie?: string | null;
  code_postal?: string | null;
  commune?: string | null;
  libelle_commune?: string | null;
  activite_principale?: string | null;
  est_siege?: boolean;
  etat_administratif?: string | null;
  /** Codes IDCC des conventions collectives applicables (open data). */
  liste_idcc?: string[] | null;
}

/** Une unité légale (entreprise) retournée par l'API. */
export interface CompanyResult {
  siren?: string | null;
  nom_complet?: string | null;
  nom_raison_sociale?: string | null;
  sigle?: string | null;
  nature_juridique?: string | null;
  activite_principale?: string | null;
  section_activite_principale?: string | null;
  siege?: CompanyEtablissement | null;
  matching_etablissements?: CompanyEtablissement[] | null;
  dirigeants?: CompanyDirigeant[] | null;
}

export interface CompanySearchResponse {
  results?: CompanyResult[];
  total_results?: number;
  page?: number;
  per_page?: number;
}
