/**
 * Logique pure du lookup entreprise via l'API publique « Recherche d'entreprises ».
 * Aucune dépendance React / réseau ici : tout est testable unitairement.
 */
import type {
  CompanyEtablissement,
  CompanyResult,
} from "../types/companySearch";
import type { EnterpriseSettings } from "../types/paramSettings";
import formeJuridiqueMap from "../resources/formeJuridique.json";
import nafLabelsMap from "../resources/nafLabels.json";
import idccLabelsMap from "../resources/idccLabels.json";

const formeJuridique = formeJuridiqueMap as Record<string, string>;
const nafLabels = nafLabelsMap as Record<string, string>;
const idccLabels = idccLabelsMap as Record<string, string>;

export const COMPANY_SEARCH_ENDPOINT =
  "https://recherche-entreprises.api.gouv.fr/search";

export type LookupMode = "siret" | "name";

/** Ne conserve que les chiffres (tolère les espaces / séparateurs de saisie). */
export function normalizeDigits(input: string): string {
  return (input ?? "").replace(/\D/g, "");
}

/** Algorithme de Luhn (clé de contrôle SIREN/SIRET). */
export function luhnCheck(value: string): boolean {
  const digits = normalizeDigits(value);
  if (digits.length === 0) return false;

  let sum = 0;
  let double = false;
  // Parcours de droite à gauche : on double un chiffre sur deux.
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** SIREN de La Poste : seule entité dont les SIRET/SIREN ne respectent pas Luhn. */
const LA_POSTE_SIREN = "356000000";

/** Somme simple des chiffres (utilisée pour l'exception La Poste). */
function digitSum(value: string): number {
  let sum = 0;
  for (let i = 0; i < value.length; i += 1) sum += value.charCodeAt(i) - 48;
  return sum;
}

/** Valide un SIREN : 9 chiffres + Luhn (ou exception La Poste). */
export function isValidSiren(input: string): boolean {
  const siren = normalizeDigits(input);
  if (siren.length !== 9) return false;
  if (siren === LA_POSTE_SIREN) return true;
  return luhnCheck(siren);
}

/**
 * Valide un SIRET : 14 chiffres + Luhn.
 * Exception La Poste (SIREN 356000000) : Luhn ne s'applique pas, on vérifie
 * à la place que la somme des 14 chiffres est un multiple de 5.
 */
export function isValidSiret(input: string): boolean {
  const siret = normalizeDigits(input);
  if (siret.length !== 14) return false;
  if (siret.startsWith(LA_POSTE_SIREN)) return digitSum(siret) % 5 === 0;
  return luhnCheck(siret);
}

/**
 * Détecte le mode d'entrée : 14 chiffres (espaces tolérés) → recherche SIRET,
 * sinon recherche par nom.
 */
export function detectLookupMode(input: string): LookupMode {
  return normalizeDigits(input).length === 14 ? "siret" : "name";
}

/** Construit l'URL de recherche selon le mode. */
export function buildSearchUrl(query: string, mode: LookupMode): string {
  const params = new URLSearchParams();
  if (mode === "siret") {
    params.set("q", normalizeDigits(query));
  } else {
    params.set("q", query.trim());
    params.set("page", "1");
    params.set("per_page", "10");
  }
  return `${COMPANY_SEARCH_ENDPOINT}?${params.toString()}`;
}

/** Libellé de la forme juridique à partir du code « nature_juridique ». */
export function formeJuridiqueLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return formeJuridique[code.trim()] ?? null;
}

/** Libellé NAF (format 2008, ex. « 70.10Z ») à partir du code. */
export function nafLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return nafLabels[code.trim().toUpperCase()] ?? null;
}

/** Recompose une adresse lisible quand le champ `adresse` agrégé est absent. */
function composeAddress(etab: CompanyEtablissement): string | null {
  if (etab.adresse?.trim()) return etab.adresse.trim();
  const line = [
    etab.numero_voie,
    etab.type_voie,
    etab.libelle_voie,
  ]
    .filter((part): part is string => !!part && part.trim().length > 0)
    .join(" ")
    .trim();
  const cityLine = [etab.code_postal, etab.libelle_commune]
    .filter((part): part is string => !!part && part.trim().length > 0)
    .join(" ")
    .trim();
  const full = [line, cityLine].filter((p) => p.length > 0).join(", ");
  return full.length > 0 ? full : null;
}

/**
 * Sélectionne l'établissement pertinent :
 * - en mode SIRET : l'établissement de `matching_etablissements` (ou le siège)
 *   dont le SIRET correspond ;
 * - sinon : le siège.
 */
export function pickEtablissement(
  result: CompanyResult,
  siret?: string,
): CompanyEtablissement | null {
  const wanted = siret ? normalizeDigits(siret) : "";
  if (wanted) {
    const candidates: CompanyEtablissement[] = [
      ...(result.matching_etablissements ?? []),
      ...(result.siege ? [result.siege] : []),
    ];
    const match = candidates.find(
      (e) => normalizeDigits(e.siret ?? "") === wanted,
    );
    if (match) return match;
  }
  return result.siege ?? result.matching_etablissements?.[0] ?? null;
}

/** Champs de `EnterpriseSettings` que ce mapping peut préremplir. */
export type CompanyPrefill = Pick<
  EnterpriseSettings,
  | "name"
  | "siren"
  | "codeNaf"
  | "intituleNaf"
  | "statusJuridiqueCode"
  | "statusJuridique"
  | "address"
>;

/**
 * Mappe un résultat de l'API vers les champs entreprise du formulaire.
 * `siret` (optionnel) permet de cibler le bon établissement (mode SIRET).
 */
export function mapCompanyToEnterprise(
  result: CompanyResult,
  siret?: string,
): CompanyPrefill {
  const etab = pickEtablissement(result, siret);
  const codeNaf =
    etab?.activite_principale?.trim() ||
    result.activite_principale?.trim() ||
    null;
  const name =
    result.nom_complet?.trim() || result.nom_raison_sociale?.trim() || null;

  return {
    name,
    siren: result.siren?.trim() || null,
    codeNaf,
    intituleNaf: nafLabel(codeNaf),
    statusJuridiqueCode: result.nature_juridique?.trim() || null,
    statusJuridique: formeJuridiqueLabel(result.nature_juridique),
    address: etab
      ? {
          address: composeAddress(etab),
          codePostal: etab.code_postal?.trim() || null,
          pays: "France",
        }
      : null,
  };
}

/** Champs d'une partie au contrat (contractant / cocontractant) préremplissables. */
export type ContractPartyPrefill = {
  nom: string | null;
  forme_juridique: string | null;
  siren: string | null;
  code_postal: string | null;
  ville: string | null;
  rcs_ville: string | null;
  representant: string | null;
  qualite: string | null;
};

/** Met en forme un nom propre venant de l'API (souvent tout en majuscules). */
function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s'-])([a-zà-ÿ])/g, (_m, sep, c) => sep + c.toUpperCase());
}

/** Représentant légal lisible à partir des dirigeants (1ʳᵉ personne physique). */
function pickRepresentant(result: CompanyResult): {
  representant: string | null;
  qualite: string | null;
} {
  const dirigeant =
    result.dirigeants?.find((d) => d.type_dirigeant === "personne physique") ??
    result.dirigeants?.[0];
  if (!dirigeant) return { representant: null, qualite: null };
  const nom = [dirigeant.prenoms, dirigeant.nom]
    .filter((p): p is string => !!p && p.trim().length > 0)
    .map((p) => toTitleCase(p.trim()))
    .join(" ")
    .trim();
  return {
    representant: nom.length > 0 ? nom : null,
    qualite: dirigeant.qualite?.trim() || null,
  };
}

/**
 * Mappe un résultat de l'API vers les champs d'une partie au contrat
 * (formulaire du générateur). `siret` cible le bon établissement si fourni.
 */
export function mapCompanyToContractParty(
  result: CompanyResult,
  siret?: string,
): ContractPartyPrefill {
  const etab = pickEtablissement(result, siret);
  const ville = etab?.libelle_commune?.trim() || null;
  const { representant, qualite } = pickRepresentant(result);
  return {
    nom:
      result.nom_complet?.trim() || result.nom_raison_sociale?.trim() || null,
    forme_juridique: formeJuridiqueLabel(result.nature_juridique),
    siren: result.siren?.trim() || null,
    code_postal: etab?.code_postal?.trim() || null,
    ville,
    // Le greffe RCS correspond le plus souvent à la ville du siège (modifiable).
    rcs_ville: ville,
    representant,
    qualite,
  };
}

/** Libellé d'une convention collective à partir de son code IDCC (si connu). */
export function idccLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = String(code).trim();
  if (!c) return null;
  // Tolère les variations de padding (« 650 » ↔ « 0650 »).
  return (
    idccLabels[c] ??
    idccLabels[c.padStart(4, "0")] ??
    idccLabels[String(Number(c))] ??
    null
  );
}

/**
 * Extrait les codes IDCC (conventions collectives) d'un résultat open data.
 * Ignore le code 9999 (= « sans convention »). Cherche dans le siège puis les
 * établissements correspondants.
 */
export function pickIdcc(result: CompanyResult, siret?: string): string[] {
  const etab = pickEtablissement(result, siret);
  const raw = etab?.liste_idcc ?? result.siege?.liste_idcc ?? [];
  return raw
    .map((c) => String(c).trim())
    .filter((c) => c && c !== "9999");
}

/**
 * Construit le libellé de convention collective à partir d'une entreprise :
 * « IntituléIDCC (IDCC 1234) » ou « IDCC 1234 » si le libellé est inconnu.
 */
export function formatConventionFromCompany(
  result: CompanyResult,
  siret?: string,
): string | null {
  const codes = pickIdcc(result, siret);
  if (codes.length === 0) return null;
  return codes
    .map((c) => {
      const label = idccLabel(c);
      return label ? `${label} (IDCC ${c})` : `IDCC ${c}`;
    })
    .join(" ; ");
}

/** Libellé court d'un résultat pour l'affichage dans la liste déroulante. */
export function formatCompanyOption(result: CompanyResult): {
  title: string;
  subtitle: string;
} {
  const title =
    result.nom_complet?.trim() ||
    result.nom_raison_sociale?.trim() ||
    "Entreprise sans nom";
  const parts = [
    result.siren ? `SIREN ${result.siren}` : null,
    formeJuridiqueLabel(result.nature_juridique),
    result.siege?.libelle_commune?.trim() || null,
  ].filter((p): p is string => !!p);
  return { title, subtitle: parts.join(" · ") };
}
