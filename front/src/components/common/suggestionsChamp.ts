/**
 * Suggestions proposées sous un champ du contrat quand on clique dedans
 * (dates, lieu, tribunal, délais…). Rien n'est rempli d'office : ce sont des
 * pastilles, un clic en choisit une.
 *
 * Le champ est reconnu par son nom technique ou son libellé, les contrats
 * n'ayant pas de liste de champs figée.
 */

export interface Pastille {
  /** Texte de la pastille. */
  libelle: string;
  /** Valeur écrite dans le champ. */
  valeur: string;
}

export interface ContexteSuggestions {
  /** Valeurs actuelles de tous les champs du contrat. */
  valeurs: Record<string, string>;
  /** Ville du siège de la société de l'utilisateur, si connue. */
  villeUtilisateur?: string | null;
  /** Date du jour (injectable pour les tests). */
  aujourdHui?: Date;
}

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** « 1er octobre 2026 », « 21 septembre 2026 ». */
export function dateLongue(d: Date): string {
  const jour = d.getDate() === 1 ? "1er" : String(d.getDate());
  return `${jour} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Lit « 21 septembre 2026 », « 1er octobre 2026 », « 21/09/2026 » ou « 2026-09-21 ». */
export function lireDate(texte: string): Date | null {
  const t = texte.trim().toLowerCase();
  let m = /^(\d{1,2})(?:er)?\s+([a-zéû]+)\s+(\d{4})$/.exec(t);
  if (m) {
    const mois = MOIS.indexOf(m[2]);
    return mois >= 0 ? new Date(Number(m[3]), mois, Number(m[1])) : null;
  }
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return null;
}

function ajouterMois(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
  // Échéance au jour précédent : un contrat d'un an commencé le 1er octobre
  // se termine le 30 septembre.
  r.setDate(r.getDate() - 1);
  return r;
}

/** Montant lu dans « 1 500 € », « 1500,50 », « 1 500 euros ». */
function lireMontant(texte: string): number | null {
  const t = texte.replace(/[\s\u00a0\u202f]/g, "").replace(/€|euros?|ht/gi, "").replace(",", ".");
  const n = Number(t);
  return t && Number.isFinite(n) ? n : null;
}

function formaterMontant(n: number): string {
  return `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    .format(n)
    .replace(/\u202f|\u00a0/g, " ")} €`;
}

/** Première valeur remplie parmi les champs dont le nom correspond. */
function trouver(valeurs: Record<string, string>, motif: RegExp, sauf?: string): string | null {
  for (const [id, v] of Object.entries(valeurs)) {
    if (id !== sauf && motif.test(id) && v.trim()) return v.trim();
  }
  return null;
}

const p = (libelle: string, valeur = libelle): Pastille => ({ libelle, valeur });

export function suggestionsPourChamp(id: string, label: string, ctx: ContexteSuggestions): Pastille[] {
  const cle = `${id} ${label}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_");
  const auj = ctx.aujourdHui ?? new Date();
  const a = (re: RegExp) => re.test(cle);

  // ── Dates ────────────────────────────────────────────────────────────────
  if (a(/date/)) {
    if (a(/fin|echeance|terme|expiration/)) {
      const debut = lireDate(trouver(ctx.valeurs, /date.*(debut|effet|entree|commencement)|(debut|effet|entree).*date/, id) ?? "");
      if (debut) {
        return [
          p("+ 6 mois", dateLongue(ajouterMois(debut, 6))),
          p("+ 1 an", dateLongue(ajouterMois(debut, 12))),
          p("+ 2 ans", dateLongue(ajouterMois(debut, 24))),
        ];
      }
      return [];
    }
    if (a(/debut|effet|entree|commencement|demarrage/)) {
      const moisProchain = new Date(auj.getFullYear(), auj.getMonth() + 1, 1);
      const lundi = new Date(auj);
      lundi.setDate(auj.getDate() + ((8 - auj.getDay()) % 7 || 7));
      return [
        p("Aujourd'hui", dateLongue(auj)),
        p("1er du mois prochain", dateLongue(moisProchain)),
        p("Lundi prochain", dateLongue(lundi)),
      ];
    }
    if (a(/naissance/)) return [];
    return [p("Aujourd'hui", dateLongue(auj))];
  }

  // ── Lieu de signature ────────────────────────────────────────────────────
  if (a(/lieu_signature|lieu_de_signature|fait_a|signe_a|ville_signature/) && ctx.villeUtilisateur) {
    return [p(ctx.villeUtilisateur)];
  }

  // ── Tribunal ─────────────────────────────────────────────────────────────
  if (a(/tribunal|juridiction/) && ctx.villeUtilisateur) {
    return [
      p(`Tribunal de commerce de ${ctx.villeUtilisateur}`),
      p(`Tribunal judiciaire de ${ctx.villeUtilisateur}`),
    ];
  }

  // ── Paiement ─────────────────────────────────────────────────────────────
  if (a(/delai_(de_)?paiement|conditions_de_paiement|echeance_paiement/)) {
    return [p("30 jours"), p("45 jours fin de mois"), p("60 jours")];
  }
  if (a(/penalite|interets_de_retard|taux_de_retard/)) {
    return [p("3 × le taux légal", "trois fois le taux d'intérêt légal")];
  }
  if (a(/indemnite_forfaitaire|frais_de_recouvrement/)) return [p("40 €")];

  // ── Montants ─────────────────────────────────────────────────────────────
  if (a(/taux_tva|tva_taux/)) return [p("20 %"), p("10 %"), p("5,5 %")];
  if (a(/ttc/)) {
    const ht = lireMontant(trouver(ctx.valeurs, /_ht$|ht_|hors_taxe/, id) ?? "");
    return ht !== null ? [p(`${formaterMontant(Math.round(ht * 120) / 100)} (TVA 20 %)`, formaterMontant(Math.round(ht * 120) / 100))] : [];
  }

  // ── Durées ───────────────────────────────────────────────────────────────
  if (a(/periode_d_essai|periode_essai/)) {
    return [p("2 mois (employé)", "2 mois"), p("3 mois (agent de maîtrise)", "3 mois"), p("4 mois (cadre)", "4 mois")];
  }
  if (a(/preavis/)) return [p("1 mois"), p("2 mois"), p("3 mois")];
  if (a(/renouvellement|reconduction/)) {
    return [p("Tacite, par périodes d'un an", "tacitement reconduit par périodes successives d'un an"), p("Aucun", "non renouvelable")];
  }
  if (a(/duree/) && !a(/travail|hebdo|horaire|heure/)) return [p("6 mois"), p("1 an"), p("2 ans")];

  return [];
}

/**
 * Champ à rédiger (description, livrables, planning…) : on y propose un texte
 * écrit par l'IA, jamais une valeur toute faite.
 */
export function estChampRedige(id: string, label: string): boolean {
  const cle = `${id} ${label}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_");
  if (/date|montant|prix|tarif|taux|duree|delai|nombre|siren|siret|adresse|email|telephone/.test(cle)) return false;
  return /description|objet|livrable|planning|jalon|mission|perimetre|modalite|nature_des|detail|contenu|obligations|activite|fonctions|poste/.test(cle);
}
