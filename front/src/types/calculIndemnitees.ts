export type TypeContrat = 'CDI' | 'CDD';

export type MotifRupture =
  | 'standard'
  | 'gross_misconduct'
  | 'serious_misconduct';

export interface EntreeAnciennete {
  years: number;
  months: number;
}

export interface EntreeCalculIndemnite {
  contractType: TypeContrat;
  terminationReason: MotifRupture;
  seniority: EntreeAnciennete;
  monthlyGrossSalary: number;
  averageSalary12Months: number;
  averageSalary3Months: number;
  /**
   * 1 = équivalent temps plein. Exemple : 0.8 pour un 80%.
   */
  partTimeRatio?: number;
}

export interface DetailIndemnite {
  partBefore10Years: number;
  partAfter10Years: number;
}

export interface ResultatCalculIndemnite {
  isEligible: boolean;
  indemnityAmount: number;
  referenceSalaryUsed: number;
  seniorityInYears: number;
  breakdown: DetailIndemnite;
  explanation: string[];
  errors: string[];
}
