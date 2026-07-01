/**
 * Assemble un CDD juridiquement structuré à partir des champs saisis.
 * Produit un document neutre (titre + préambule + articles), réutilisable pour
 * l'aperçu écran, l'export PDF et l'envoi en signature/négociation.
 */
import {
  CAS_RECOURS_OPTIONS,
  type CddFields,
} from "./cddModel";

export type CddArticle = { heading: string; body: string };
export type CddDocument = {
  title: string;
  preamble: string;
  articles: CddArticle[];
};

/** Formate une date ISO en français (1er janvier 2026). */
export function formatDateFr(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso || "…";
  const d = new Date(t);
  const mois = [
    "janvier", "février", "mars", "avril", "mai", "juin", "juillet",
    "août", "septembre", "octobre", "novembre", "décembre",
  ];
  const jour = d.getDate();
  return `${jour === 1 ? "1er" : jour} ${mois[d.getMonth()]} ${d.getFullYear()}`;
}

const ph = (v: string, fallback: string) => (v.trim() ? v.trim() : fallback);

function casRecoursLabel(value: CddFields["cas_recours"]): string {
  return (
    CAS_RECOURS_OPTIONS.find((o) => o.value === value)?.label ?? "Cas de recours"
  );
}

export function buildCddContract(f: CddFields): CddDocument {
  const employeur = [
    ph(f.emp_denomination, "[Dénomination employeur]"),
    f.emp_forme_juridique && `, ${f.emp_forme_juridique}`,
    f.emp_siren && `, SIREN ${f.emp_siren}`,
  ]
    .filter(Boolean)
    .join("");
  const empAdresse = [f.emp_adresse, f.emp_code_postal, f.emp_ville]
    .filter((x) => x.trim())
    .join(" ");
  const repr = ph(f.emp_representant, "[Représentant]");
  const reprQualite = f.emp_qualite ? ` en sa qualité de ${f.emp_qualite}` : "";

  const salarie = [
    f.sal_civilite,
    ph(f.sal_prenom, "[Prénom]"),
    ph(f.sal_nom, "[Nom]"),
  ]
    .filter((x) => x.trim())
    .join(" ");
  const salAdresse = [f.sal_adresse, f.sal_code_postal, f.sal_ville]
    .filter((x) => x.trim())
    .join(" ");

  const preamble =
    `Entre les soussignés :\n\n` +
    `${employeur}, dont le siège est situé ${ph(empAdresse, "[Adresse]")}, ` +
    `représenté${reprQualite ? "" : "(e)"} par ${repr}${reprQualite},\n` +
    `ci-après dénommé « l'Employeur », d'une part,\n\n` +
    `Et ${salarie}, demeurant ${ph(salAdresse, "[Adresse]")}` +
    `${f.sal_date_naissance ? `, né(e) le ${formatDateFr(f.sal_date_naissance)}` : ""}` +
    `${f.sal_lieu_naissance ? ` à ${f.sal_lieu_naissance}` : ""}` +
    `${f.sal_nationalite ? `, de nationalité ${f.sal_nationalite}` : ""}` +
    `${f.sal_secu ? `, n° de sécurité sociale ${f.sal_secu}` : ""},\n` +
    `ci-après dénommé « le Salarié », d'autre part,\n\n` +
    `Il a été convenu ce qui suit, dans le cadre des articles L1242-1 et suivants du Code du travail.`;

  const articles: CddArticle[] = [];

  // Art. 1 — Engagement & motif (mention obligatoire L1242-12, 1°)
  let motifBody =
    `Le présent contrat est conclu pour le motif suivant : ` +
    `${casRecoursLabel(f.cas_recours)}.\n` +
    `${ph(f.motif_detail, "[Description précise et circonstanciée du motif de recours]")}`;
  if (f.cas_recours === "remplacement") {
    motifBody +=
      `\nIl est conclu en remplacement de ${ph(f.remplace_nom, "[Nom du salarié remplacé]")}, ` +
      `occupant l'emploi de ${ph(f.remplace_qualification, "[Qualification du salarié remplacé]")}.`;
  }
  motifBody +=
    `\nConformément à l'article L1242-12 du Code du travail, l'absence de définition ` +
    `précise du motif entraînerait la requalification en contrat à durée indéterminée.`;
  articles.push({ heading: "Article 1 – Engagement et motif du recours", body: motifBody });

  // Art. 2 — Poste & qualification (L1242-12, 3°)
  articles.push({
    heading: "Article 2 – Fonctions et qualification",
    body:
      `Le Salarié est engagé en qualité de ${ph(f.poste_intitule, "[Intitulé du poste]")}, ` +
      `qualification professionnelle : ${ph(f.poste_qualification, "[Qualification]")}` +
      `${f.poste_classification ? ` (classification : ${f.poste_classification})` : ""}.\n` +
      `Le lieu de travail est fixé à ${ph(f.lieu_travail, "[Lieu de travail]")}.`,
  });

  // Art. 3 — Durée et terme (L1242-12, 2°)
  let dureeBody: string;
  if (f.terme_type === "precis") {
    dureeBody =
      `Le présent contrat est conclu à terme précis. Il prend effet le ` +
      `${formatDateFr(f.date_debut)} et prendra fin de plein droit le ` +
      `${formatDateFr(f.date_fin)}.\n` +
      (f.renouvelable
        ? `Il pourra être renouvelé dans les conditions suivantes : ` +
          `${ph(f.renouvellement_conditions, "[Conditions de renouvellement]")}, ` +
          `dans la limite des durées maximales légales.`
        : `Il n'est assorti d'aucune clause de renouvellement.`);
  } else {
    dureeBody =
      `Le présent contrat est conclu à terme imprécis. Il prend effet le ` +
      `${formatDateFr(f.date_debut)} pour une durée minimale de ` +
      `${ph(f.duree_minimale, "[Durée minimale]")} et prendra fin à la réalisation ` +
      `de son objet (retour du salarié remplacé / fin de la cause de recours).`;
  }
  articles.push({ heading: "Article 3 – Durée du contrat", body: dureeBody });

  // Art. 4 — Période d'essai (L1242-12, 5° ; L1242-10)
  articles.push({
    heading: "Article 4 – Période d'essai",
    body: f.periode_essai.trim()
      ? `Le contrat comporte une période d'essai de ${f.periode_essai.trim()}, ` +
        `non renouvelable, durant laquelle chacune des parties peut rompre le contrat ` +
        `dans le respect du délai de prévenance légal (art. L1242-10 et L1221-25).`
      : `Le contrat ne comporte pas de période d'essai.`,
  });

  // Art. 5 — Durée du travail
  articles.push({
    heading: "Article 5 – Durée du travail",
    body:
      f.temps === "plein"
        ? `Le Salarié est employé à temps plein, pour une durée hebdomadaire de ` +
          `${ph(f.duree_hebdo, "35")} heures.`
        : `Le Salarié est employé à temps partiel, pour une durée hebdomadaire de ` +
          `${ph(f.duree_hebdo, "[…]")} heures, répartie comme suit : ` +
          `${ph(f.repartition_horaire, "[Répartition des horaires]")}.`,
  });

  // Art. 6 — Rémunération (L1242-12, 6°)
  articles.push({
    heading: "Article 6 – Rémunération",
    body:
      `En contrepartie de son travail, le Salarié percevra une rémunération brute ` +
      `${f.remuneration_periodicite || "mensuelle"} de ${ph(f.remuneration_brut_mensuel, "[Montant]")} € brut.\n` +
      (f.primes_avantages.trim()
        ? `S'y ajoutent les éléments suivants : ${f.primes_avantages.trim()}.`
        : `Cette rémunération ne peut être inférieure à celle d'un salarié de qualification équivalente occupant le même poste (art. L1242-15).`),
  });

  // Art. 7 — Convention collective (L1242-12, 4°)
  articles.push({
    heading: "Article 7 – Convention collective",
    body:
      `Les relations entre les parties sont régies par la convention collective : ` +
      `${ph(f.convention_collective, "[Intitulé de la convention collective applicable]")}.`,
  });

  // Art. 8 — Retraite et prévoyance (L1242-12, 7°)
  articles.push({
    heading: "Article 8 – Retraite complémentaire et prévoyance",
    body:
      `Caisse de retraite complémentaire : ${ph(f.caisse_retraite, "[Caisse de retraite complémentaire]")}.\n` +
      `Organisme de prévoyance : ${ph(f.organisme_prevoyance, "[Organisme de prévoyance]")}.` +
      (f.emp_urssaf ? `\nCotisations URSSAF : ${f.emp_urssaf}.` : ""),
  });

  // Art. 9 — Fin de contrat (L1243-8 précarité, L1242-16 congés payés)
  articles.push({
    heading: "Article 9 – Indemnités de fin de contrat",
    body:
      (f.indemnite_precarite
        ? `À l'échéance du terme, le Salarié percevra une indemnité de fin de contrat ` +
          `(prime de précarité) égale à 10 % de la rémunération totale brute versée ` +
          `(art. L1243-8), sauf cas d'exclusion légale.`
        : `Aucune indemnité de précarité n'est due (cas d'exclusion légale applicable : ` +
          `emploi saisonnier, refus d'un CDI équivalent, etc.).`) +
      `\nLe Salarié percevra en outre une indemnité compensatrice de congés payés égale ` +
      `à 10 % de la rémunération totale brute (art. L1242-16).`,
  });

  // Art. 10 — Clauses particulières (facultatives)
  const clauses: string[] = [];
  if (f.clause_confidentialite)
    clauses.push(
      `Confidentialité : le Salarié s'engage à ne pas divulguer les informations ` +
        `confidentielles dont il aurait connaissance, pendant et après le contrat.`,
    );
  if (f.clause_non_concurrence)
    clauses.push(
      `Non-concurrence : applicable dans les limites de temps, de lieu et d'activité ` +
        `prévues par la convention collective, et assortie d'une contrepartie financière.`,
    );
  if (f.clause_mobilite)
    clauses.push(
      `Mobilité : le Salarié pourra être affecté dans un autre établissement situé ` +
        `dans la zone géographique définie d'un commun accord.`,
    );
  if (clauses.length > 0) {
    articles.push({
      heading: "Article 10 – Clauses particulières",
      body: clauses.map((c, i) => `${i + 1}. ${c}`).join("\n"),
    });
  }

  // Signature
  articles.push({
    heading: "Signatures",
    body:
      `Fait à ${ph(f.lieu_signature, "[Lieu]")}, le ` +
      `${f.date_signature ? formatDateFr(f.date_signature) : "[Date]"}, en deux exemplaires originaux.\n\n` +
      `L'Employeur\t\t\t\tLe Salarié\n(signature)\t\t\t\t(signature précédée de la mention « Lu et approuvé »)`,
  });

  return {
    title: `CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE`,
    preamble,
    articles,
  };
}

/** Rendu texte brut du document (pour export simple / debug). */
export function renderCddText(doc: CddDocument): string {
  return (
    `${doc.title}\n\n${doc.preamble}\n\n` +
    doc.articles.map((a) => `${a.heading}\n${a.body}`).join("\n\n")
  );
}
