import { useState } from "react";
import { Download, Info } from "lucide-react";
import { calculerIndemniteLegale } from "../../utils/dashboard/calculerIndemnitees";
import type { TypeContrat, ResultatCalculIndemnite, MotifRupture } from "../../types/calculIndemnitees";
import { AlertBanner } from "../common/AlertBanner";

const MOTIF_VERS_RAISON_RESILIATION: Record<string, MotifRupture> = {
  personnel: "standard",
  economique: "standard",
  faute_grave: "gross_misconduct",
  faute_lourde: "serious_misconduct",
};

const LIBELLE_MOTIF: Record<string, string> = {
  personnel: "1/4 mois par année (personnel)",
  economique: "1/4 mois par année (économique)",
  faute_grave: "Faute grave — aucune indemnité",
  faute_lourde: "Faute lourde — aucune indemnité",
};

const inputClass = "w-full text-sm border border-gray-300 rounded-md px-3 py-2 outline-none focus:border-lumenjuris focus:ring-1 focus:ring-lumenjuris transition-colors bg-white text-gray-800";
const labelClass = "block text-sm font-medium text-gray-700 mb-1";

export function Calculateur() {
  const [typeContrat, setTypeContrat] = useState<TypeContrat>("CDI");
  const [ancienneteAnnees, setAncienneteAnnees] = useState("5");
  const [ancienneteMois, setAncienneteMois] = useState("3");
  const [salaireMensuelBrut, setSalaireMensuelBrut] = useState("3200");
  const [salaireMoyen12Mois, setSalaireMoyen12Mois] = useState("3150");
  const [salaireMoyen3Mois, setSalaireMoyen3Mois] = useState("3300");
  const [ratioTempsPartiel, setRatioTempsPartiel] = useState("1");
  const [motifLicenciement, setMotifLicenciement] = useState("personnel");
  const [resultat, setResultat] = useState<ResultatCalculIndemnite | null>(null);
  const [formuleApplicable, setFormuleApplicable] = useState("");
  const [alertError, setAlertError] = useState<{ title: string; detail: string } | null>(null);

  const onIntegerChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value.replace(/[^0-9]/g, ""));
  };
  const onDecimalChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/,/g, ".").replace(/[^0-9.]/g, "");
    const firstDot = raw.indexOf(".");
    if (firstDot !== -1) raw = raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, "");
    setter(raw);
  };

  const lancerCalcul = () => {
    const raisonResiliation = MOTIF_VERS_RAISON_RESILIATION[motifLicenciement] ?? "standard";
    setFormuleApplicable(LIBELLE_MOTIF[motifLicenciement] ?? "1/4 mois par année");
    const calcul = calculerIndemniteLegale({
      contractType: typeContrat,
      terminationReason: raisonResiliation,
      seniority: {
        years: Math.trunc(parseFloat(ancienneteAnnees) || 0),
        months: Math.trunc(parseFloat(ancienneteMois) || 0),
      },
      monthlyGrossSalary: parseFloat(salaireMensuelBrut) || 0,
      averageSalary12Months: parseFloat(salaireMoyen12Mois) || 0,
      averageSalary3Months: parseFloat(salaireMoyen3Mois) || 0,
      partTimeRatio: ratioTempsPartiel === "" ? 1 : parseFloat(ratioTempsPartiel),
    });
    setResultat(calcul);
    if (calcul.errors.length > 0) {
      const reste = calcul.errors.length - 1;
      setAlertError({
        title: calcul.errors[0],
        detail: reste > 0
          ? `+${reste} autre${reste > 1 ? "s" : ""} erreur${reste > 1 ? "s" : ""} — vérifiez les champs saisis.`
          : "Vérifiez les champs saisis et relancez le calcul.",
      });
    } else {
      setAlertError(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">

      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Simulateur d'indemnité légale de licenciement</h1>
        <p className="text-sm text-gray-500 mt-1">Estimation basée sur le Code du travail français</p>
      </div>

      {alertError && (
        <AlertBanner
          variant="error"
          title={alertError.title}
          detail={alertError.detail}
          duration={6000}
          onClose={() => setAlertError(null)}
        />
      )}

      {/* Contenu côte à côte */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 min-w-0 max-w-2xl">
        <div className="px-6 py-4 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Paramètres du calcul</p>
        </div>
        <div className="px-6 py-5 space-y-5">

          {/* Ligne 1 : type contrat + motif */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Type de contrat</label>
              <select value={typeContrat} onChange={(e) => setTypeContrat(e.target.value as TypeContrat)} className={inputClass}>
                <option value="CDI">CDI (Contrat à durée indéterminée)</option>
                <option value="CDD">CDD (Contrat à durée déterminée)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Motif du licenciement</label>
              <select value={motifLicenciement} onChange={(e) => setMotifLicenciement(e.target.value)} className={inputClass}>
                <option value="personnel">Licenciement classique</option>
                <option value="economique">Licenciement économique</option>
                <option value="faute_grave">Faute grave</option>
                <option value="faute_lourde">Faute lourde</option>
              </select>
            </div>
          </div>

          {/* Ligne 2 : ancienneté */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Ancienneté — Années</label>
              <input type="text" inputMode="numeric" value={ancienneteAnnees} onChange={onIntegerChange(setAncienneteAnnees)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>
                Ancienneté — Mois{" "}
                <span className="text-gray-400 font-normal whitespace-nowrap">(0 à 11)</span>
              </label>
              <input type="text" inputMode="numeric" value={ancienneteMois} onChange={onIntegerChange(setAncienneteMois)} className={inputClass} />
            </div>
          </div>

          {/* Ligne 3 : salaires */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>
                Salaire mensuel brut{" "}
                <span className="text-gray-400 font-normal whitespace-nowrap">(€ / mois)</span>
              </label>
              <input type="text" inputMode="decimal" value={salaireMensuelBrut} onChange={onDecimalChange(setSalaireMensuelBrut)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>
                Moyenne 12 derniers mois{" "}
                <span className="text-gray-400 font-normal whitespace-nowrap">(€ / mois)</span>
              </label>
              <input type="text" inputMode="decimal" value={salaireMoyen12Mois} onChange={onDecimalChange(setSalaireMoyen12Mois)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>
                Moyenne 3 derniers mois{" "}
                <span className="text-gray-400 font-normal whitespace-nowrap">(€ / mois)</span>
              </label>
              <input type="text" inputMode="decimal" value={salaireMoyen3Mois} onChange={onDecimalChange(setSalaireMoyen3Mois)} className={inputClass} />
            </div>
          </div>

          {/* Ligne 4 : temps partiel */}
          <div className="max-w-xs">
            <label className={labelClass}>
              Coefficient temps partiel{" "}
              <span className="text-gray-400 font-normal whitespace-nowrap">(1 = temps plein)</span>
            </label>
            <input type="text" inputMode="decimal" value={ratioTempsPartiel} onChange={onDecimalChange(setRatioTempsPartiel)} className={inputClass} />
          </div>

          <button
            onClick={lancerCalcul}
            className="w-full bg-lumenjuris text-white text-sm font-semibold py-3 rounded-lg hover:bg-lumenjuris-dark transition-colors"
          >
            Calculer
          </button>
        </div>
      </div>

      {/* Résultat */}
      {resultat && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden w-full lg:w-80 shrink-0">
          <div className="px-6 py-4 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Résultat</p>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="text-center py-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Indemnité estimée</p>
              <p className="text-4xl font-bold text-lumenjuris">
                {resultat.indemnityAmount.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
              </p>
              <p className="text-xs text-gray-400 mt-1">Minimum légal</p>
            </div>

            {resultat.errors.length > 0 ? (
              <ul className="space-y-1">
                {resultat.errors.map((erreur) => (
                  <li key={erreur} className="text-xs text-red-600">{erreur}</li>
                ))}
              </ul>
            ) : (
              <dl className="space-y-2.5">
                {[
                  { label: "Salaire de référence", value: `${resultat.referenceSalaryUsed.toLocaleString("fr-FR")} €/mois` },
                  { label: "Ancienneté retenue", value: `${resultat.seniorityInYears} an${resultat.seniorityInYears > 1 ? "s" : ""}` },
                  { label: "Formule applicable", value: formuleApplicable },
                  { label: "Tranche ≤ 10 ans", value: `${resultat.breakdown.partBefore10Years.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €` },
                  { label: "Tranche > 10 ans", value: `${resultat.breakdown.partAfter10Years.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €` },
                  { label: "Total estimé", value: `${resultat.indemnityAmount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`, bold: true },
                ].map((ligne) => (
                  <div key={ligne.label} className="flex items-center justify-between gap-4 text-sm border-b border-gray-100 pb-2.5 last:border-0 last:pb-0">
                    <span className="text-gray-500">{ligne.label}</span>
                    <span className={`font-medium text-right ${ligne.bold ? "text-gray-900" : "text-gray-700"}`}>{ligne.value}</span>
                  </div>
                ))}
              </dl>
            )}

            <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
              <Info className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700 leading-relaxed">
                Base légale : Art. R1234-2 du Code du travail. La convention collective peut prévoir une indemnité plus favorable.
              </p>
            </div>

            <p className="text-[10px] text-gray-400 leading-relaxed">
              <span className="font-semibold">Avertissement : </span>
              Cet outil fournit une estimation de l'indemnité <span className="italic">légale</span> de licenciement uniquement. Il ne prend pas en compte les dispositions conventionnelles, contractuelles ou les accords d'entreprise qui peuvent prévoir des montants supérieurs. Pour un calcul définitif, consultez un professionnel du droit du travail.
            </p>

            <button className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 border border-gray-200 rounded-lg py-2.5 hover:border-gray-300 transition-colors">
              <Download className="h-4 w-4" />
              Exporter le rapport
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
