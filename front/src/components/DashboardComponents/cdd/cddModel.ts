/**
 * Modèle métier du CDD (contrat à durée déterminée).
 *
 * Conformité : art. L1242-12 (mentions obligatoires), L1242-2/L1242-3 (cas de
 * recours), L1242-10 (période d'essai), L1243-8 (indemnité de précarité),
 * L1242-16 (indemnité compensatrice de congés payés) du Code du travail.
 * Sources : service-public.gouv.fr (F36), legifrance.gouv.fr, code.travail.gouv.fr.
 *
 * Aucune dépendance UI : tout est pur et testable.
 */

/** Cas de recours autorisés (sélection des plus courants). */
export type CasRecours =
  | "remplacement"
  | "accroissement"
  | "saisonnier"
  | "usage";

export const CAS_RECOURS_OPTIONS: { value: CasRecours; label: string }[] = [
  { value: "remplacement", label: "Remplacement d'un salarié absent" },
  { value: "accroissement", label: "Accroissement temporaire d'activité" },
  { value: "saisonnier", label: "Emploi à caractère saisonnier" },
  { value: "usage", label: "CDD d'usage (secteur autorisé)" },
];

export type TermeType = "precis" | "imprecis";
export type TempsTravail = "plein" | "partiel";

/** Ensemble des champs saisis pour produire un CDD complet. */
export type CddFields = {
  // — Employeur —
  emp_denomination: string;
  emp_forme_juridique: string;
  emp_siren: string;
  emp_adresse: string;
  emp_code_postal: string;
  emp_ville: string;
  emp_representant: string;
  emp_qualite: string;
  emp_urssaf: string;
  emp_code_naf: string;

  // — Salarié —
  sal_civilite: string;
  sal_nom: string;
  sal_prenom: string;
  sal_adresse: string;
  sal_code_postal: string;
  sal_ville: string;
  sal_date_naissance: string;
  sal_lieu_naissance: string;
  sal_nationalite: string;
  sal_secu: string;

  // — Motif & poste —
  cas_recours: CasRecours;
  motif_detail: string;
  remplace_nom: string;
  remplace_qualification: string;
  poste_intitule: string;
  poste_qualification: string;
  poste_classification: string;
  lieu_travail: string;

  // — Durée & terme —
  terme_type: TermeType;
  date_debut: string;
  date_fin: string;
  duree_minimale: string;
  renouvelable: boolean;
  renouvellement_conditions: string;
  periode_essai: string;

  // — Rémunération & temps de travail —
  remuneration_brut_mensuel: string;
  remuneration_periodicite: string;
  primes_avantages: string;
  duree_hebdo: string;
  temps: TempsTravail;
  repartition_horaire: string;

  // — Convention & organismes —
  convention_collective: string;
  caisse_retraite: string;
  organisme_prevoyance: string;

  // — Clauses optionnelles —
  clause_confidentialite: boolean;
  clause_non_concurrence: boolean;
  clause_mobilite: boolean;

  // — Finalisation —
  indemnite_precarite: boolean; // 10 % sauf exceptions
  lieu_signature: string;
  date_signature: string;
};

export function createEmptyCddFields(): CddFields {
  return {
    emp_denomination: "", emp_forme_juridique: "", emp_siren: "",
    emp_adresse: "", emp_code_postal: "", emp_ville: "",
    emp_representant: "", emp_qualite: "", emp_urssaf: "", emp_code_naf: "",
    sal_civilite: "", sal_nom: "", sal_prenom: "", sal_adresse: "",
    sal_code_postal: "", sal_ville: "", sal_date_naissance: "",
    sal_lieu_naissance: "", sal_nationalite: "Française", sal_secu: "",
    cas_recours: "accroissement", motif_detail: "",
    remplace_nom: "", remplace_qualification: "",
    poste_intitule: "", poste_qualification: "", poste_classification: "",
    lieu_travail: "",
    terme_type: "precis", date_debut: "", date_fin: "", duree_minimale: "",
    renouvelable: false, renouvellement_conditions: "", periode_essai: "",
    remuneration_brut_mensuel: "", remuneration_periodicite: "mensuelle",
    primes_avantages: "", duree_hebdo: "35", temps: "plein",
    repartition_horaire: "",
    convention_collective: "", caisse_retraite: "", organisme_prevoyance: "",
    clause_confidentialite: false, clause_non_concurrence: false,
    clause_mobilite: false,
    indemnite_precarite: true, lieu_signature: "", date_signature: "",
  };
}

/** Différence en jours calendaires entre deux dates ISO (yyyy-mm-dd). */
function diffDays(startISO: string, endISO: string): number | null {
  const start = Date.parse(startISO);
  const end = Date.parse(endISO);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / 86_400_000) + 1; // inclusif
}

export type EssaiSuggestion = {
  days: number;
  label: string;
};

/**
 * Calcule la période d'essai maximale légale d'un CDD à terme précis :
 * 1 jour par semaine de contrat, plafonnée à 2 semaines (≤ 6 mois) ou 1 mois
 * (> 6 mois). Non renouvelable (art. L1242-10).
 */
export function computeEssaiMax(
  dateDebut: string,
  dateFin: string,
): EssaiSuggestion | null {
  const days = diffDays(dateDebut, dateFin);
  if (days === null) return null;

  const weeks = Math.ceil(days / 7);
  const months = days / 30.4375;
  const capDays = months <= 6 ? 14 : 30;
  const essaiDays = Math.min(weeks, capDays);

  const label =
    essaiDays <= 14
      ? `${essaiDays} jour${essaiDays > 1 ? "s" : ""} ouvrés (plafond 2 semaines)`
      : `${essaiDays} jours ouvrés (plafond 1 mois)`;

  return { days: essaiDays, label };
}

/** Champs obligatoires manquants au regard de l'art. L1242-12 (clé → libellé). */
export function getMissingMandatory(fields: CddFields): string[] {
  const missing: string[] = [];
  const req = (cond: boolean, label: string) => {
    if (!cond) missing.push(label);
  };

  req(!!fields.emp_denomination.trim(), "Dénomination de l'employeur");
  req(!!fields.sal_nom.trim(), "Nom du salarié");
  req(!!fields.motif_detail.trim() || fields.cas_recours === "accroissement", "Motif précis du recours");
  if (fields.cas_recours === "remplacement") {
    req(!!fields.remplace_nom.trim(), "Nom du salarié remplacé");
    req(!!fields.remplace_qualification.trim(), "Qualification du salarié remplacé");
  }
  req(!!fields.poste_intitule.trim(), "Intitulé du poste");
  req(!!fields.poste_qualification.trim(), "Qualification professionnelle");
  req(!!fields.date_debut.trim(), "Date de début");
  if (fields.terme_type === "precis") {
    req(!!fields.date_fin.trim(), "Date de fin (terme précis)");
  } else {
    req(!!fields.duree_minimale.trim(), "Durée minimale (terme imprécis)");
  }
  req(!!fields.remuneration_brut_mensuel.trim(), "Rémunération brute");
  req(!!fields.convention_collective.trim(), "Convention collective applicable");
  req(!!fields.caisse_retraite.trim(), "Caisse de retraite complémentaire");
  req(!!fields.organisme_prevoyance.trim(), "Organisme de prévoyance");

  return missing;
}
