/**
 * Logique du préremplissage des contrats (sans interface).
 *
 * Principe : le CLM préremplit ce qu'il connaît (fiche de l'utilisateur), va
 * chercher ce qui manque dans une source publique fiable (base SIRENE via
 * l'API « Recherche d'entreprises »), et propose le reste. Ce qui vient d'une
 * source externe reste une suggestion à valider.
 *
 * Les contrats n'ont pas de liste de champs figée : les modèles fixes
 * utilisent `emp_denomination`, les contrats rédigés par l'IA des noms comme
 * `prestataire_siret`. On reconnaît donc chaque champ aux mots de son nom (ou
 * de son libellé), et on regroupe les champs d'une même partie.
 */
import type { CompanyResult, CompanySearchResponse } from "../../types/companySearch";
import type { UserData } from "../../types/userData";
import {
  buildSearchUrl,
  detectLookupMode,
  mapCompanyToContractParty,
  normalizeDigits,
} from "../../utils/companyLookup";
import { fetchProxy } from "../../utils/fetchProxy";

export type Donnee =
  | "denomination" | "forme_juridique" | "capital" | "siren" | "siret"
  | "adresse" | "code_postal" | "ville" | "rcs" | "representant" | "qualite"
  | "email" | "telephone" | "tva";

/**
 * Mots désignant chaque donnée. L'ordre compte : le plus précis d'abord
 * (« rcs_ville » avant « ville »). Le mot peut être n'importe où dans le nom
 * du champ : `client_siren` comme `siren_du_client`.
 */
const CORRESPONDANCES: { mots: string[]; donnee: Donnee }[] = [
  { mots: ["rcs_ville", "ville_rcs", "ville_d_immatriculation", "rcs", "greffe"], donnee: "rcs" },
  { mots: ["code_postal", "cp"], donnee: "code_postal" },
  { mots: ["tva_intracommunautaire", "tva_intracom", "numero_tva", "num_tva", "n_tva"], donnee: "tva" },
  // Avant la dénomination : « nom du représentant » désigne le représentant.
  { mots: ["representant_legal", "representant", "representee_par", "represente_par", "signataire", "dirigeant"], donnee: "representant" },
  { mots: ["denomination_sociale", "denomination", "raison_sociale", "nom_societe", "nom_entreprise", "societe", "entreprise", "nom"], donnee: "denomination" },
  { mots: ["forme_juridique", "forme"], donnee: "forme_juridique" },
  { mots: ["capital_social", "capital"], donnee: "capital" },
  { mots: ["siren"], donnee: "siren" },
  { mots: ["siret"], donnee: "siret" },
  { mots: ["ville", "commune"], donnee: "ville" },
  { mots: ["adresse", "siege_social", "siege"], donnee: "adresse" },
  { mots: ["qualite", "fonction"], donnee: "qualite" },
  { mots: ["email", "e_mail", "courriel", "mail"], donnee: "email" },
  { mots: ["telephone", "tel", "phone"], donnee: "telephone" },
];

/** Mots de liaison retirés pour isoler le nom de la partie. */
const LIAISONS = new Set(["du", "de", "des", "la", "le", "l", "d", "legal", "social", "sociale", "siege", "numero", "n", "no", "nom", "prenom"]);

export interface ChampPartie { id: string; donnee: Donnee }
export interface GroupePartie { prefixe: string; libelle: string; champs: ChampPartie[] }

function jetons(texte: string): string[] {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function reconnaitreJetons(t: string[]): { prefixe: string; donnee: Donnee } | null {
  for (const { mots, donnee } of CORRESPONDANCES) {
    for (const mot of mots) {
      const m = mot.split("_");
      for (let i = 0; i + m.length <= t.length; i += 1) {
        if (m.every((x, k) => t[i + k] === x)) {
          const reste = [...t.slice(0, i), ...t.slice(i + m.length)].filter((x) => !LIAISONS.has(x));
          return { prefixe: reste.join("_"), donnee };
        }
      }
    }
  }
  return null;
}

/**
 * Donnée portée par un champ et partie à laquelle il appartient, d'après son
 * nom technique, ou à défaut son libellé (« Adresse du prestataire »).
 */
export function reconnaitre(id: string, label?: string): { prefixe: string; donnee: Donnee } | null {
  return reconnaitreJetons(jetons(id)) ?? (label ? reconnaitreJetons(jetons(label)) : null);
}

/** Libellé lisible d'une partie à partir du préfixe technique. */
function libelle(prefixe: string): string {
  const connus: Record<string, string> = {
    "": "La partie",
    emp: "L'employeur",
    employeur: "L'employeur",
    sal: "Le salarié",
    salarie: "Le salarié",
    partie_1: "La première partie",
    partie1: "La première partie",
    partie_2: "La seconde partie",
    partie2: "La seconde partie",
  };
  if (connus[prefixe] !== undefined) return connus[prefixe];
  const lisible = prefixe.replace(/_/g, " ").trim();
  return lisible.charAt(0).toUpperCase() + lisible.slice(1);
}

/**
 * Parties du contrat : groupes de champs portant une identité d'entreprise
 * (dénomination ou numéro d'immatriculation) et au moins deux données. Sans
 * cela, on proposerait une recherche d'entreprise sur « date_signature ».
 */
export function trouverParties(variables: { id: string; label?: string }[]): GroupePartie[] {
  const parPrefixe = new Map<string, GroupePartie>();
  for (const v of variables) {
    const r = reconnaitre(v.id, v.label);
    if (!r) continue;
    const g = parPrefixe.get(r.prefixe) ?? { prefixe: r.prefixe, libelle: libelle(r.prefixe), champs: [] };
    g.champs.push({ id: v.id, donnee: r.donnee });
    parPrefixe.set(r.prefixe, g);
  }
  return [...parPrefixe.values()].filter((g) => {
    const donnees = new Set(g.champs.map((c) => c.donnee));
    const identite = donnees.has("denomination") || donnees.has("siren") || donnees.has("siret");
    return identite && g.champs.length >= 2;
  });
}

/**
 * Adresse sans le code postal ni la ville, quand le contrat a des champs
 * séparés pour eux : sinon ils apparaîtraient deux fois.
 */
function voieSeule(adresse: string, codePostal?: string | null): string {
  if (!codePostal) return adresse;
  const i = adresse.indexOf(codePostal);
  return i > 0 ? adresse.slice(0, i).replace(/[,\s]+$/, "") : adresse;
}

export type Valeurs = Partial<Record<Donnee, string>>;

/** Ce que le CLM sait déjà de l'utilisateur et de sa société. */
export function valeursDuProfil(user: UserData | null, telephone: string | null): Valeurs {
  const e = user?.enterprise;
  const p = user?.profile;
  const representant = [p?.prenom, p?.nom].filter((x) => x?.trim()).join(" ").trim();
  const v: Valeurs = {
    denomination: e?.name ?? undefined,
    forme_juridique: e?.statusJuridique ?? undefined,
    siren: e?.siren ?? undefined,
    adresse: e?.address?.address ?? undefined,
    code_postal: e?.address?.codePostal ?? undefined,
    tva: tvaIntracom(e?.siren) ?? undefined,
    representant: representant || undefined,
    email: p?.email ?? undefined,
    telephone: telephone ?? undefined,
  };
  return nettoyer(v);
}

/** Données d'une entreprise trouvée dans SIRENE. */
export function valeursSirene(result: CompanyResult, siret?: string): Valeurs {
  const p = mapCompanyToContractParty(result, siret);
  return nettoyer({
    denomination: p.nom ?? undefined,
    forme_juridique: p.forme_juridique ?? undefined,
    siren: p.siren ?? undefined,
    siret: p.siret ?? undefined,
    tva: tvaIntracom(p.siren) ?? undefined,
    adresse: p.adresse ?? undefined,
    code_postal: p.code_postal ?? undefined,
    ville: p.ville ?? undefined,
    rcs: p.rcs_ville ?? undefined,
    representant: p.representant ?? undefined,
    qualite: p.qualite ?? undefined,
  });
}

/**
 * Numéro de TVA intracommunautaire français : il se déduit du SIREN
 * (clé = (12 + 3 × (SIREN mod 97)) mod 97), sans rien interroger.
 */
export function tvaIntracom(siren?: string | null): string | null {
  const s = (siren ?? "").replace(/\s/g, "");
  if (!/^[0-9]{9}$/.test(s)) return null;
  const cle = (12 + 3 * (Number(s) % 97)) % 97;
  return `FR${String(cle).padStart(2, "0")}${s}`;
}

/** L'entreprise est-elle fermée (radiée, cessée) selon le registre ? */
export function estFermee(result: CompanyResult): boolean {
  return result.etat_administratif === "C" || result.siege?.etat_administratif === "F";
}

/** Ville extraite d'une adresse du type « 1 rue X 75001 PARIS ». */
export function villeDeLAdresse(adresse?: string | null): string | null {
  const m = /\b\d{5}\s+(.+)$/.exec((adresse ?? "").trim());
  if (!m) return null;
  // « SAINT-GERMAIN-EN-LAYE » -> « Saint-Germain-en-Laye »
  const petits = new Set(["de", "du", "des", "en", "la", "le", "les", "sur", "sous", "aux", "et"]);
  return m[1]
    .trim()
    .toLowerCase()
    .replace(/[a-zà-ÿ]+/g, (mot, i: number) =>
      i > 0 && petits.has(mot) ? mot : mot.charAt(0).toUpperCase() + mot.slice(1),
    );
}

const villesConnues = new Map<string, string | null>();

/**
 * Ville de la fiche entreprise. L'adresse enregistrée n'a pas toujours le
 * code postal (« 59 RUE LA FAYETTE PARIS ») : on la situe alors avec la Base
 * Adresse Nationale. Résultat gardé en mémoire le temps de la session.
 */
export async function villeDeLaFiche(adresse?: string | null, codePostal?: string | null): Promise<string | null> {
  const directe = villeDeLAdresse(adresse);
  if (directe || !adresse || !codePostal) return directe;
  const cle = `${adresse}|${codePostal}`;
  if (villesConnues.has(cle)) return villesConnues.get(cle) ?? null;
  try {
    const res = await fetch(`https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(`${adresse} ${codePostal}`)}&postcode=${codePostal}&limit=1`);
    const data = res.ok ? await res.json() : null;
    const ville = (data?.features?.[0]?.properties?.city as string | undefined) ?? null;
    villesConnues.set(cle, ville);
    return ville;
  } catch {
    return null;
  }
}

/**
 * Capital social (registre INPI, via notre serveur). Null si le registre
 * n'est pas branché ou ne connaît pas l'entreprise : rien n'est inventé.
 */
export async function chercherCapital(siren?: string | null): Promise<string | null> {
  if (!siren || !/^[0-9]{9}$/.test(siren)) return null;
  try {
    const res = await fetchProxy(`/api/enterprise/capital/${siren}`, { credentials: "include" });
    if (!res.ok) return null;
    const payload = await res.json().catch(() => null);
    return payload?.data?.capital ?? null;
  } catch {
    return null;
  }
}

function nettoyer(v: Valeurs): Valeurs {
  const out: Valeurs = {};
  for (const [k, val] of Object.entries(v) as [Donnee, string | undefined][]) {
    if (val && val.trim()) out[k] = val.trim();
  }
  return out;
}

/**
 * Valeur à écrire dans un champ donné du groupe, en tenant compte des champs
 * voisins (adresse sans code postal ni ville s'ils ont leurs propres champs).
 */
export function valeurPourChamp(groupe: GroupePartie, champ: ChampPartie, valeurs: Valeurs): string | undefined {
  const val = valeurs[champ.donnee];
  if (!val) return undefined;
  if (champ.donnee === "adresse") {
    const separes = groupe.champs.some((c) => c.donnee === "code_postal" || c.donnee === "ville");
    return separes ? voieSeule(val, valeurs.code_postal) : val;
  }
  return val;
}

/**
 * Recherche une entreprise dans SIRENE (API publique « Recherche
 * d'entreprises ») par nom, SIREN ou SIRET. Renvoie le meilleur résultat, ou
 * null. Un SIREN/SIRET doit correspondre exactement.
 */
export async function chercherEntreprise(requete: string): Promise<{ result: CompanyResult; siret?: string } | null> {
  const q = requete.trim();
  if (q.length < 2) return null;
  const chiffres = normalizeDigits(q);
  const mode = detectLookupMode(q);
  try {
    const res = await fetch(buildSearchUrl(q, mode));
    if (!res.ok) return null;
    const data = (await res.json()) as CompanySearchResponse;
    const resultats = data.results ?? [];
    if (chiffres.length === 14) {
      const r = resultats.find((x) => x.siren === chiffres.slice(0, 9));
      return r ? { result: r, siret: chiffres } : null;
    }
    if (chiffres.length === 9 && chiffres === q.replace(/\s/g, "")) {
      const r = resultats.find((x) => x.siren === chiffres);
      return r ? { result: r } : null;
    }
    return resultats[0] ? { result: resultats[0] } : null;
  } catch {
    return null;
  }
}
