/**
 * Modèle concret : CDD pour accroissement temporaire d'activité.
 * Instance déclarative du moteur générique — aucune logique en dur ici, tout
 * passe par variables / alternatives / décisions / règles.
 *
 * Conformité : art. L1242-2 (cas de recours), L1242-8 (durée max 18 mois),
 * L1242-12 (mentions obligatoires), L1242-10 (période d'essai), L1243-8
 * (précarité), L1244-3 (délai de carence).
 */
import type { ContractModel } from "../types";

export const cddAccroissementModel: ContractModel = {
  key: "cdd_accroissement",
  version: 1,
  label: "CDD – Accroissement temporaire d'activité",

  variables: [
    { id: "emp_denomination", label: "Dénomination employeur", type: "text" },
    { id: "emp_adresse", label: "Adresse employeur", type: "text" },
    { id: "emp_siren", label: "SIREN", type: "text" },
    { id: "emp_representant", label: "Représentant", type: "text" },
    { id: "emp_qualite", label: "Qualité du représentant", type: "text" },
    { id: "sal_civilite", label: "Civilité", type: "text", default: "M." },
    { id: "sal_prenom", label: "Prénom du salarié", type: "text" },
    { id: "sal_nom", label: "Nom du salarié", type: "text" },
    { id: "sal_adresse", label: "Adresse du salarié", type: "text" },
    { id: "poste_intitule", label: "Intitulé du poste", type: "text" },
    { id: "lieu_travail", label: "Lieu de travail", type: "text" },
    { id: "date_debut", label: "Date de début", type: "date" },
    { id: "date_fin", label: "Date de fin", type: "date" },
    {
      id: "contrat_duree_mois",
      label: "Durée du contrat (mois)",
      type: "number",
      // Le max est imposé par une règle dépendant du motif (cf. rules).
      constraints: [{ max: 18, message: "Durée maximale légale : 18 mois (accroissement)." }],
    },
    { id: "remuneration_brute", label: "Rémunération brute mensuelle (€)", type: "money" },
    { id: "heures_hebdo", label: "Heures hebdomadaires", type: "number", default: "35" },
    { id: "essai_jours", label: "Période d'essai (jours)", type: "duration" },
    { id: "convention_collective", label: "Convention collective", type: "text" },
    { id: "caisse_retraite", label: "Caisse de retraite complémentaire", type: "text" },
    { id: "organisme_prevoyance", label: "Organisme de prévoyance", type: "text" },
    {
      id: "nc_contrepartie",
      label: "Contrepartie financière de non-concurrence",
      type: "money",
      // Devient requise si la clause de non-concurrence est activée (cf. rules).
    },
  ],

  blocks: [
    { id: "title", kind: "title", content: "CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE" },
    {
      id: "preamble", kind: "preamble",
      content:
        "Entre {{emp_denomination}}, SIREN {{emp_siren}}, dont le siège est situé {{emp_adresse}}, " +
        "représentée par {{emp_representant}} en qualité de {{emp_qualite}}, ci-après « l'Employeur »,\n" +
        "Et {{sal_civilite}} {{sal_prenom}} {{sal_nom}}, demeurant {{sal_adresse}}, ci-après « le Salarié »,\n" +
        "il a été convenu ce qui suit, dans le cadre des articles L1242-1 et suivants du Code du travail.",
    },
    {
      id: "art_motif", kind: "clause", heading: "Article 1 – Motif du recours",
      mandatory: true, decisionId: "motif",
      content:
        "Le présent contrat est conclu pour accroissement temporaire d'activité (art. L1242-2, 2°). " +
        "L'absence de définition précise du motif entraînerait la requalification en contrat à durée indéterminée (art. L1242-12).",
    },
    {
      id: "art_poste", kind: "clause", heading: "Article 2 – Emploi et qualification",
      mandatory: true,
      content:
        "Le Salarié est engagé en qualité de {{poste_intitule}}. Le lieu de travail est fixé à {{lieu_travail}}.",
    },
    {
      id: "art_duree", kind: "clause", heading: "Article 3 – Durée du contrat",
      mandatory: true,
      content:
        "Le contrat prend effet le {{date_debut}} et prend fin de plein droit le {{date_fin}} " +
        "(durée : {{contrat_duree_mois}} mois), dans la limite légale de 18 mois (art. L1242-8).",
    },
    {
      id: "art_essai", kind: "clause", heading: "Article 4 – Période d'essai",
      alternativeId: "essai", content: "",
    },
    {
      id: "art_temps", kind: "clause", heading: "Article 5 – Durée du travail",
      content: "Le Salarié est employé pour une durée hebdomadaire de {{heures_hebdo}} heures.",
    },
    {
      id: "art_remuneration", kind: "clause", heading: "Article 6 – Rémunération",
      mandatory: true, alternativeId: "remuneration_modalite", content: "",
    },
    {
      id: "art_convention", kind: "clause", heading: "Article 7 – Convention collective",
      mandatory: true,
      content: "Les relations sont régies par la convention collective : {{convention_collective}}.",
    },
    {
      id: "art_retraite", kind: "clause", heading: "Article 8 – Retraite et prévoyance",
      mandatory: true,
      content:
        "Caisse de retraite complémentaire : {{caisse_retraite}}. Organisme de prévoyance : {{organisme_prevoyance}}.",
    },
    {
      id: "art_precarite", kind: "clause", heading: "Article 9 – Indemnité de précarité",
      decisionId: "precarite",
      content:
        "À l'échéance du terme, le Salarié percevra une indemnité de fin de contrat égale à 10 % " +
        "de la rémunération totale brute (art. L1243-8), sauf cas d'exclusion légale.",
    },
    {
      id: "art_carence", kind: "clause", heading: "Article 10 – Délai de carence",
      decisionId: "carence",
      content:
        "En cas de succession de contrats sur le même poste, le délai de carence prévu à l'article " +
        "L1244-3 du Code du travail est respecté.",
    },
    {
      id: "art_renouvellement", kind: "clause", heading: "Article 11 – Renouvellement",
      alternativeId: "renouvellement", content: "",
    },
    {
      id: "art_non_concurrence", kind: "clause", heading: "Article 12 – Non-concurrence",
      alternativeId: "non_concurrence", content: "",
    },
    {
      id: "art_confidentialite", kind: "clause", heading: "Article 13 – Confidentialité",
      alternativeId: "confidentialite", content: "",
    },
    {
      id: "art_mobilite", kind: "clause", heading: "Article 14 – Mobilité",
      alternativeId: "mobilite", content: "",
    },
    {
      id: "signatures", kind: "signature", heading: "Signatures",
      content: "Fait en deux exemplaires.\n\nL'Employeur\t\t\tLe Salarié (« Lu et approuvé »)",
    },
  ],

  alternatives: [
    {
      id: "essai", blockId: "art_essai", label: "Période d'essai",
      defaultOptionId: "legal",
      options: [
        {
          id: "legal", label: "Avec période d'essai (recommandé)",
          why: "Protège l'employeur en début de contrat. Plafond légal : 1 jour/semaine, max 2 semaines (≤ 6 mois) ou 1 mois (> 6 mois). Non renouvelable.",
          content: "Le contrat comporte une période d'essai de {{essai_jours}} jours, non renouvelable (art. L1242-10).",
        },
        {
          id: "sans", label: "Sans période d'essai",
          why: "À éviter : aucune marge pour rompre sans procédure en début de contrat.",
          content: "Le contrat ne comporte pas de période d'essai.",
        },
      ],
    },
    {
      id: "remuneration_modalite", blockId: "art_remuneration", label: "Modalités de rémunération",
      defaultOptionId: "fixe",
      options: [
        {
          id: "fixe", label: "Salaire fixe",
          why: "Le plus simple et le plus sûr. Doit être ≥ à celle d'un salarié équivalent (art. L1242-15).",
          content: "Le Salarié percevra une rémunération brute mensuelle de {{remuneration_brute}} €.",
        },
        {
          id: "fixe_primes", label: "Fixe + primes",
          why: "Préciser la nature et les conditions des primes pour éviter tout litige.",
          content: "Le Salarié percevra {{remuneration_brute}} € brut mensuels, augmentés des primes prévues par la convention collective.",
        },
        {
          id: "variable", label: "Fixe + part variable",
          why: "La part variable doit reposer sur des objectifs objectifs et vérifiables.",
          content: "Le Salarié percevra {{remuneration_brute}} € brut mensuels, complétés d'une part variable sur objectifs définis par avenant.",
        },
      ],
    },
    {
      id: "renouvellement", blockId: "art_renouvellement", label: "Renouvellement",
      defaultOptionId: "non",
      options: [
        {
          id: "non", label: "Non renouvelable",
          why: "Par défaut. Le contrat prend fin au terme sans reconduction.",
          content: "Le présent contrat n'est pas renouvelable.",
        },
        {
          id: "oui", label: "Renouvelable (dans la limite légale)",
          why: "2 renouvellements maximum, sans dépasser la durée totale de 18 mois (art. L1243-13).",
          content: "Le contrat pourra être renouvelé deux fois au maximum, sans que la durée totale n'excède 18 mois (art. L1243-13).",
        },
      ],
    },
    {
      id: "non_concurrence", blockId: "art_non_concurrence", label: "Non-concurrence",
      defaultOptionId: "sans",
      options: [
        {
          id: "sans", label: "Pas de clause de non-concurrence",
          why: "Par défaut. Inutile pour la plupart des postes.",
          content: "Le contrat ne comporte pas de clause de non-concurrence.",
        },
        {
          id: "avec", label: "Avec clause de non-concurrence",
          why: "VALIDE UNIQUEMENT avec une contrepartie financière, limitée dans le temps, l'espace et l'activité.",
          content: "Le Salarié est tenu d'une obligation de non-concurrence, assortie d'une contrepartie financière de {{nc_contrepartie}} € (limitée dans le temps, l'espace et l'activité).",
        },
      ],
    },
    {
      id: "confidentialite", blockId: "art_confidentialite", label: "Confidentialité",
      defaultOptionId: "sans",
      options: [
        { id: "sans", label: "Sans", why: "Par défaut.", content: "Sans objet." },
        { id: "avec", label: "Avec confidentialité", why: "Recommandé si le poste donne accès à des informations sensibles.", content: "Le Salarié s'engage à la confidentialité des informations dont il a connaissance, pendant et après le contrat." },
      ],
    },
    {
      id: "mobilite", blockId: "art_mobilite", label: "Mobilité",
      defaultOptionId: "sans",
      options: [
        { id: "sans", label: "Sans", why: "Par défaut.", content: "Sans objet." },
        { id: "avec", label: "Avec clause de mobilité", why: "Définir précisément la zone géographique, sous peine de nullité.", content: "Le Salarié pourra être affecté dans la zone géographique suivante définie d'un commun accord." },
      ],
    },
  ],

  decisions: [
    {
      id: "motif", blockId: "art_motif", title: "Motif de recours", impact: "critique",
      defaultResolution: "active",
      explanation: "Le motif conditionne la validité de tout le contrat et impose en cascade les contraintes de durée, de renouvellement et de carence.",
      explanationSimple: "La raison du CDD doit être réelle et précise, sinon le contrat peut devenir un CDI.",
    },
    {
      id: "precarite", blockId: "art_precarite", title: "Indemnité de précarité", impact: "eleve",
      defaultResolution: "active", reasonRequiredToDismiss: true,
      explanation: "L'indemnité de 10 % est due sauf exceptions précises (saisonnier, refus de CDI, faute grave…). L'oubli est une faute.",
      explanationSimple: "À la fin du CDD, vous devez en général verser une prime de 10 %. Ne la retirez que si vous êtes sûr d'être dans une exception.",
    },
    {
      id: "carence", blockId: "art_carence", title: "Délai de carence", impact: "eleve",
      defaultResolution: "pending",
      explanation: "Un délai de carence s'impose entre deux CDD sur le même poste (art. L1244-3). Vérifiez l'historique du poste.",
      explanationSimple: "Si quelqu'un a déjà occupé ce poste en CDD récemment, vous devez peut-être attendre avant de réembaucher.",
    },
    {
      id: "indemnite_fin", title: "Indemnité de fin de contrat", impact: "confort",
      defaultResolution: "active",
      explanation: "Indemnité compensatrice de congés payés (10 %) due en fin de contrat (art. L1242-16).",
      explanationSimple: "Le salarié reçoit aussi une indemnité pour ses congés non pris.",
    },
  ],

  rules: [
    {
      id: "motif_limite_duree",
      when: { decision: "motif", is: "active" },
      then: [{ type: "setVarMax", var: "contrat_duree_mois", value: 18 }],
    },
    {
      id: "non_concurrence_exige_contrepartie",
      when: { alternative: "non_concurrence", is: "avec" },
      then: [{ type: "requireVar", var: "nc_contrepartie" }],
    },
  ],

  mandatoryMentions: [
    { id: "m_motif", label: "Motif de recours", satisfiedByBlock: "art_motif" },
    { id: "m_terme", label: "Terme / durée", satisfiedByBlock: "art_duree" },
    { id: "m_poste", label: "Poste et qualification", satisfiedByBlock: "art_poste" },
    { id: "m_convention", label: "Convention collective", satisfiedByBlock: "art_convention" },
    { id: "m_remuneration", label: "Rémunération", satisfiedByBlock: "art_remuneration" },
  ],
};
