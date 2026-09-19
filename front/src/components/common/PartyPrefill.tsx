import { useMemo } from "react";
import { CompanySearchField } from "./CompanySearchField";
import { mapCompanyToContractParty } from "../../utils/companyLookup";
import type { CompanyResult } from "../../types/companySearch";

/**
 * Pré-remplissage des parties, dans l'éditeur, au moment où l'on remplit les
 * champs du contrat.
 *
 * Les contrats rédigés depuis un modèle utilisent des noms de champs fixes
 * (`emp_denomination`, `emp_siren`…), mais ceux générés de zéro reçoivent des
 * noms inventés par le modèle (`client_denomination`, `partie_1_siret`…). On ne
 * peut donc pas cibler une liste figée : on regroupe les champs par préfixe et
 * on ne propose la recherche d'entreprise que là où elle a un sens.
 */

type Variable = { id: string; label?: string };

/** Suffixe de champ -> donnée d'entreprise correspondante. */
const CORRESPONDANCES: { motif: RegExp; cle: Cle }[] = [
  { motif: /(denomination|raison_sociale|raison|societe|nom_societe|nom)$/, cle: "nom" },
  { motif: /(forme_juridique|forme)$/, cle: "forme_juridique" },
  { motif: /siren$/, cle: "siren" },
  { motif: /siret$/, cle: "siret" },
  { motif: /(code_postal|cp)$/, cle: "code_postal" },
  { motif: /ville$/, cle: "ville" },
  { motif: /(adresse|siege_social|siege)$/, cle: "adresse" },
  { motif: /(rcs|greffe)$/, cle: "rcs_ville" },
  { motif: /(representant|representee_par|signataire)$/, cle: "representant" },
  { motif: /(qualite|fonction)$/, cle: "qualite" },
];

type Cle =
  | "nom" | "forme_juridique" | "siren" | "siret" | "code_postal"
  | "ville" | "adresse" | "rcs_ville" | "representant" | "qualite";

type Groupe = { prefixe: string; champs: { id: string; cle: Cle }[] };

/** Découpe un identifiant de variable en (préfixe, donnée reconnue). */
function reconnaitre(id: string): { prefixe: string; cle: Cle } | null {
  for (const { motif, cle } of CORRESPONDANCES) {
    const m = motif.exec(id);
    if (m) {
      const prefixe = id.slice(0, m.index).replace(/_+$/, "");
      return { prefixe, cle };
    }
  }
  return null;
}

/**
 * Un groupe n'est proposé que s'il porte une identité d'entreprise : un nom,
 * ou un numéro d'immatriculation. Sans cela, on proposerait une recherche
 * d'entreprise sur des champs comme « date_signature » ou « ville_tribunal ».
 */
function estUnePartie(g: Groupe): boolean {
  const cles = new Set(g.champs.map((c) => c.cle));
  const aUneIdentite = cles.has("nom") || cles.has("siren") || cles.has("siret");
  return aUneIdentite && g.champs.length >= 2;
}

/** Libellé lisible pour l'utilisateur à partir du préfixe technique. */
function libelle(prefixe: string): string {
  if (!prefixe) return "la partie";
  const connus: Record<string, string> = {
    emp: "l'employeur",
    employeur: "l'employeur",
    sal: "le salarié",
    salarie: "le salarié",
  };
  if (connus[prefixe]) return connus[prefixe];
  const lisible = prefixe.replace(/_/g, " ").trim();
  return lisible.charAt(0).toUpperCase() + lisible.slice(1);
}

export function PartyPrefill({
  variables,
  setVar,
}: {
  variables: Variable[];
  setVar: (id: string, value: string) => void;
}) {
  const groupes = useMemo(() => {
    const parPrefixe = new Map<string, Groupe>();
    for (const v of variables) {
      const r = reconnaitre(v.id);
      if (!r) continue;
      const g = parPrefixe.get(r.prefixe) ?? { prefixe: r.prefixe, champs: [] };
      g.champs.push({ id: v.id, cle: r.cle });
      parPrefixe.set(r.prefixe, g);
    }
    return [...parPrefixe.values()].filter(estUnePartie);
  }, [variables]);

  if (groupes.length === 0) return null;

  const remplir = (g: Groupe) => (result: CompanyResult, siret?: string) => {
    const p = mapCompanyToContractParty(result, siret);
    const adresse = [p.code_postal, p.ville].filter(Boolean).join(" ");
    const valeurs: Partial<Record<Cle, string | undefined | null>> = {
      nom: p.nom,
      forme_juridique: p.forme_juridique,
      siren: p.siren,
      siret,
      code_postal: p.code_postal,
      ville: p.ville,
      adresse,
      rcs_ville: p.rcs_ville,
      representant: p.representant,
      qualite: p.qualite,
    };
    for (const champ of g.champs) {
      const valeur = valeurs[champ.cle];
      if (valeur?.trim()) setVar(champ.id, valeur.trim());
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-card">
      {groupes.map((g) => (
        <CompanySearchField
          key={g.prefixe || "partie"}
          label={`Pré-remplir ${libelle(g.prefixe)}`}
          hint="Recherchez l'entreprise par nom ou SIRET : les champs correspondants du contrat sont remplis automatiquement."
          onSelect={remplir(g)}
        />
      ))}
    </div>
  );
}
