import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Clock } from "lucide-react";

/** Raccourcis affichés en pastilles au-dessus du sélecteur. */
const QUICK_TYPES = [
  { value: "CDI", label: "CDI" },
  { value: "CDD", label: "CDD" },
  { value: "NDA", label: "NDA" },
  { value: "PRESTATION", label: "Prestation" },
  { value: "BAIL_COMMERCIAL", label: "Bail commercial" },
];

/**
 * Carte « Action rapide » : choix d'un type de contrat + contexte facultatif,
 * puis redirection vers le générateur avec le brief pré-rempli.
 */
export function QuickGenerateCard() {
  const navigate = useNavigate();
  const [contractType, setContractType] = useState("CDI");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget;
    const select = form.elements.namedItem("contractType") as HTMLSelectElement;
    const rawLabel = select.selectedOptions[0]?.text || select.value;

    // Les libellés sont de la forme "CDI - Contrat à durée indéterminée" :
    // on ne garde que la partie lisible pour le titre du contrat.
    const cleanTitle = rawLabel.includes(" - ") ? rawLabel.split(" - ")[1] : rawLabel;

    const formData = new FormData(form);
    const details = (formData.get("details") as string) || "";

    navigate(
      `/contrat-generation?section=scratch&titre=${encodeURIComponent(cleanTitle)}&step=brief&de=dashboard`,
      { state: { brief: details } },
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex flex-col gap-3.5 overflow-hidden rounded-2xl border border-[#dfe4ef] bg-white p-4 shadow-[0_10px_30px_-18px_rgba(33,57,87,0.35)]"
    >
      {/* Liseré dégradé en haut de la carte */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-[linear-gradient(90deg,#213957_0%,#354F99_55%,#d6b266_100%)]" />

      <div className="flex flex-col gap-1">
        <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-blue-primary">
          Action rapide
        </span>
        <h2 className="font-serif text-[21px] font-normal text-ink">Générer un contrat</h2>
        <p className="text-[12.5px] leading-snug text-ink-muted">
          Choisissez un type, nous nous occupons de la structure et des clauses.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_TYPES.map((quick) => (
          <button
            key={quick.value}
            type="button"
            onClick={() => setContractType(quick.value)}
            className={`h-7 shrink-0 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors ${
              quick.value === contractType
                ? "border-blue-primary bg-blue-primary text-white"
                : "border-line bg-white text-ink-muted hover:border-brand-muted"
            }`}
          >
            {quick.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contract-type" className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-subtle">
          Type de contrat
        </label>
        <select
          id="contract-type"
          name="contractType"
          value={contractType}
          onChange={(e) => setContractType(e.target.value)}
          className="h-10 w-full cursor-pointer rounded-[10px] border border-line bg-[#f9fafc] px-3 text-[13px] font-medium text-ink outline-none focus:border-brand-muted focus:bg-white"
        >
          <optgroup label="Contrats de travail">
            <option value="CDI">CDI - Contrat à durée indéterminée</option>
            <option value="CDD">CDD - Contrat à durée déterminée</option>
            <option value="STAGE">Convention de stage</option>
            <option value="ALTERNANCE">Contrat d'apprentissage / Alternance</option>
          </optgroup>

          <optgroup label="Prestations & Commerce">
            <option value="PRESTATION">Contrat de prestation de services</option>
            <option value="FREELANCE">Contrat d'indépendant / Freelance</option>
            <option value="NDA">NDA - Accord de confidentialité</option>
            <option value="CGV">Conditions Générales de Vente (CGV)</option>
            <option value="SOUS_TRAITANCE">Contrat de sous-traitance</option>
          </optgroup>

          <optgroup label="Immobilier & Locatif">
            <option value="BAIL_COMMERCIAL">Bail commercial</option>
            <option value="BAIL_PROFESSIONNEL">Bail professionnel</option>
          </optgroup>

          <optgroup label="Sociétés & Partenariats">
            <option value="PAG">Pacte d'associés / d'actionnaires</option>
            <option value="PARTENARIAT">Convention de partenariat commercial</option>
          </optgroup>
        </select>
      </div>

      <textarea
        name="details"
        rows={3}
        placeholder="Contexte, parties, durée… (facultatif)"
        className="w-full resize-none rounded-[10px] border border-line bg-[#f9fafc] p-3 text-[13px] leading-snug text-ink outline-none placeholder:text-ink-subtle focus:border-brand-muted focus:bg-white"
      />

      <button
        type="submit"
        className="flex h-11 w-full items-center justify-center gap-2 rounded-[11px] bg-blue-primary text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        Commencer la génération
        <ArrowRight className="h-[15px] w-[15px]" />
      </button>

      <div className="flex items-center justify-center gap-1.5 text-ink-subtle">
        <Clock className="h-3 w-3" />
        <span className="text-[11.5px]">Document prêt en moins de 2 minutes</span>
      </div>
    </form>
  );
}
