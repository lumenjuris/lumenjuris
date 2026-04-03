import type {
  EntreeCalculIndemnite,
  ResultatCalculIndemnite,
} from '../../types/calculIndemnitees';

const MOIS_MINIMUM_ELIGIBILITE = 8;
const DIX_ANS = 10;
const TAUX_AVANT_DIX_ANS = 1 / 4;
const TAUX_APRES_DIX_ANS = 1 / 3;

function arrondir2Dec(valeur: number): number {
  return Math.round(valeur * 100) / 100;
}

function enMoisTotal(annees: number, mois: number): number {
  return annees * 12 + mois;
}

function enAnnees(moisTotal: number): number {
  return moisTotal / 12;
}

function validerEntree(entree: EntreeCalculIndemnite): string[] {
  const erreurs: string[] = [];

  const verificationsNumeriques: Array<[string, number]> = [
    ['Années d\'ancienneté', entree.seniority.years],
    ['Mois d\'ancienneté', entree.seniority.months],
    ['Salaire mensuel brut', entree.monthlyGrossSalary],
    ['Salaire moyen sur 12 mois', entree.averageSalary12Months],
    ['Salaire moyen sur 3 mois', entree.averageSalary3Months],
    ['Taux temps partiel', entree.partTimeRatio ?? 1],
  ];

  for (const [libelle, valeur] of verificationsNumeriques) {
    if (!Number.isFinite(valeur)) {
      erreurs.push(`${libelle} doit être un nombre fini.`);
      continue;
    }

    if (valeur < 0) {
      erreurs.push(`${libelle} ne peut pas être négatif.`);
    }
  }

  if (!Number.isInteger(entree.seniority.years)) {
    erreurs.push('Les années d\'ancienneté doivent être un entier.');
  }

  if (!Number.isInteger(entree.seniority.months)) {
    erreurs.push('Les mois d\'ancienneté doivent être un entier.');
  }

  if (entree.seniority.months < 0 || entree.seniority.months > 11) {
    erreurs.push('Les mois d\'ancienneté doivent être compris entre 0 et 11.');
  }

  const tauxTempsPartiel = entree.partTimeRatio ?? 1;
  if (tauxTempsPartiel <= 0 || tauxTempsPartiel > 1) {
    erreurs.push('Le taux de temps partiel doit être supérieur à 0 et inférieur ou égal à 1.');
  }

  return erreurs;
}

export function calculerIndemniteLegale(
  entree: EntreeCalculIndemnite,
): ResultatCalculIndemnite {
  const erreurs = validerEntree(entree);

  if (erreurs.length > 0) {
    return {
      isEligible: false,
      indemnityAmount: 0,
      referenceSalaryUsed: 0,
      seniorityInYears: 0,
      breakdown: {
        partBefore10Years: 0,
        partAfter10Years: 0,
      },
      explanation: ['Le calcul n\'a pas pu être effectué en raison d\'erreurs de validation.'],
      errors: erreurs,
    };
  }

  const moisTotal = enMoisTotal(entree.seniority.years, entree.seniority.months);
  const ancienneteEnAnnees = enAnnees(moisTotal);
  const tauxTempsPartiel = entree.partTimeRatio ?? 1;

  const salaireBrutMax = Math.max(
    entree.monthlyGrossSalary,
    entree.averageSalary12Months,
    entree.averageSalary3Months,
  );

  const salaireReference = arrondir2Dec(salaireBrutMax * tauxTempsPartiel);

  const explication: string[] = [
    `Le salaire de référence est la valeur la plus haute entre le salaire de base (€${arrondir2Dec(
      entree.monthlyGrossSalary,
    )}), la moyenne sur 12 mois (€${arrondir2Dec(
      entree.averageSalary12Months,
    )}) et la moyenne sur 3 mois (€${arrondir2Dec(entree.averageSalary3Months)}).`,
    `Un taux de temps partiel de ${tauxTempsPartiel} est appliqué, donnant un salaire de référence de €${salaireReference}.`,
    `Ancienneté totale prise en compte : ${entree.seniority.years} an(s) et ${entree.seniority.months} mois (${arrondir2Dec(
      ancienneteEnAnnees,
    )} ans).`,
  ];

  if (entree.contractType !== 'CDI') {
    explication.push('Seuls les salariés en CDI sont éligibles à l\'indemnité légale de licenciement.');
    return {
      isEligible: false,
      indemnityAmount: 0,
      referenceSalaryUsed: salaireReference,
      seniorityInYears: arrondir2Dec(ancienneteEnAnnees),
      breakdown: {
        partBefore10Years: 0,
        partAfter10Years: 0,
      },
      explanation: explication,
      errors: [],
    };
  }

  if (entree.terminationReason === 'gross_misconduct' || entree.terminationReason === 'serious_misconduct') {
    explication.push('Aucune indemnité légale n\'est due en cas de faute grave ou de faute lourde.');
    return {
      isEligible: false,
      indemnityAmount: 0,
      referenceSalaryUsed: salaireReference,
      seniorityInYears: arrondir2Dec(ancienneteEnAnnees),
      breakdown: {
        partBefore10Years: 0,
        partAfter10Years: 0,
      },
      explanation: explication,
      errors: [],
    };
  }

  if (moisTotal < MOIS_MINIMUM_ELIGIBILITE) {
    explication.push('Au moins 8 mois d\'ancienneté continue sont requis pour être éligible.');
    return {
      isEligible: false,
      indemnityAmount: 0,
      referenceSalaryUsed: salaireReference,
      seniorityInYears: arrondir2Dec(ancienneteEnAnnees),
      breakdown: {
        partBefore10Years: 0,
        partAfter10Years: 0,
      },
      explanation: explication,
      errors: [],
    };
  }

  const anneesAvant10 = Math.min(ancienneteEnAnnees, DIX_ANS);
  const anneesApres10 = Math.max(ancienneteEnAnnees - DIX_ANS, 0);

  const partieAvant10Ans = arrondir2Dec(salaireReference * TAUX_AVANT_DIX_ANS * anneesAvant10);
  const partieApres10Ans = arrondir2Dec(salaireReference * TAUX_APRES_DIX_ANS * anneesApres10);
  const montantIndemnite = arrondir2Dec(partieAvant10Ans + partieApres10Ans);

  explication.push(
    `Pour les 10 premières années : ${arrondir2Dec(anneesAvant10)} × 1/4 mois × €${salaireReference} = €${partieAvant10Ans}.`,
  );
  explication.push(
    `Au-delà de 10 ans : ${arrondir2Dec(anneesApres10)} × 1/3 mois × €${salaireReference} = €${partieApres10Ans}.`,
  );
  explication.push(`Montant estimé de l'indemnité légale de licenciement : €${montantIndemnite}.`);

  return {
    isEligible: true,
    indemnityAmount: montantIndemnite,
    referenceSalaryUsed: salaireReference,
    seniorityInYears: arrondir2Dec(ancienneteEnAnnees),
    breakdown: {
      partBefore10Years: partieAvant10Ans,
      partAfter10Years: partieApres10Ans,
    },
    explanation: explication,
    errors: [],
  };
}
