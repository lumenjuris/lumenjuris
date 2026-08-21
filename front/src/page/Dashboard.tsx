//import InputFile from "../components/common/InputFile";
import { Link, useNavigate} from "react-router-dom";
import {
  Library, FileText, ShieldCheck, ScrollText, PenTool, 
  ArrowRight, Handshake,
} from "lucide-react";

interface Tool {
  icon: React.ElementType;
  name: string;
  title: string;
  desc: string;
  to: string;
  accent: string; // couleur d'accent de l'icône
  img?: string
}

const TOOLS: Tool[] = [
  {
    icon: FileText,
    name: "Generation",
    title: "Créez des contrats conformes à partir de vos modèles et clauses approuvées.",
    desc: "Rédigez vos actes juridiques et contrats en quelques clics. Indiquez simplement votre besoin ou répondez à quelques questions guidées pour obtenir un document personnalisé, juridiquement sécurisé et conforme aux dernières évolutions du droit français",
    to: "/contratheque",
    accent: "#354F99",
  },
    {
    icon: ShieldCheck,
    name: "Analyser",
    title: "Annotez vos contrats , échangez les redlines et validez la version finale.",
    desc: "Débloquez vos discussions et défendez efficacement vos intérêts face à vos interlocuteurs. L'outil génère des contre-propositions équilibrées et vous fournit des arguments percutants pour négocier chaque clause stratégique sans fermer le dialogue.",
    to: "/conformite",
    accent: "#d97706",
  },
    {
    icon: Handshake,
    name: "Négociation",
    title:"Annotez vos contrats , échangez les redlines et validez la version finale." ,
    desc: "Débloquez vos discussions et défendez efficacement vos intérêts face à vos interlocuteurs. L'outil génère des contre-propositions équilibrées et vous fournit des arguments percutants pour négocier chaque clause stratégique sans fermer le dialogue.",
    to: "/contratheque",
    accent: "#7c3aed",
  },

  {
    icon: Library,
    name: "Contratheque",
    title: "Centralisez et suivez le cycle de vie de tous vos contrat au même endroit.",
    desc: "Centralisez, classez et retrouvez tous vos documents juridiques au même endroit. Votre espace sécurisé analyse automatiquement vos contrats importés pour les organiser par type, extraire les dates clés et vous alerter avant chaque échéance importante.",
    to: "/generateur",
    accent: "#059669",
  },

  {
    icon: ScrollText,
    name: "Bibliothèque de clauses",
    title: "Réutilisez vos clauses validées juridiquement à chaque rédaction.",
    desc: "Créez votre propre catalogue complet de clauses juridiques prêtes à l'emploi et parfaitement sécurisées. Retrouvez en un instant la formulation idéale pour enrichir vos contrats, adapter une obligation spécifique ou verrouiller une situation particulière selon le droit français.",
    to: "/clauses",
    accent: "#0891b2",
  },
    {
    icon: PenTool,
    name: "Signature électronique",
    title: "Faites signer vos contrats en ligne, en toute sécurité.",
    desc: "Faites signer vos contrats en ligne rapidement et en toute sécurité. Envoyez vos documents validés directement depuis l'application, suivez l'avancement des signatures en temps réel et garantissez la valeur juridique de vos accords.",
    to: "/signature",
    accent: "#2563eb",
  },
];

export function Dashboard() {
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget;

    const select = form.elements.namedItem("contractType") as HTMLSelectElement;
    const rawLabel = select.selectedOptions[0]?.text || select.value;

    const cleanTitle = rawLabel.includes(" - ") 
    ? rawLabel.split(" - ")[1] 
    : rawLabel;

    const formData = new FormData(form);
    const details = (formData.get("details")as string) || "";

    navigate(`/contrat-generation?section=scratch&titre=${encodeURIComponent(cleanTitle)}&step=brief&de=dashboard`, {state: {brief: details}});
  }

  return (
    <div>
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center mb-12">
        <div>
          <span className="inline-block rounded-full border border-red-primary px-4 py-1.5 text-xs font-medium uppercase text-red-primary mb-4">
            plateforme de gestion contractuelle
          </span>

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Le cycle de vie de vos contrats, maitrisé de bout en bout.
          </h1>

          <p className="text-base text-ink-muted mt-4 max-w-lg">
            De la rédaction à l'archivage, Lumen Juris centralise, sécurise et fiabilise chaque étape de vos contrats, pour que vos équipes juridiques passent moins de temps à chercher, et plus de temps à décider.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
            <Link 
              to="/contrat-generation" 
              className="flex items-center justify-center text-center bg-blue-primary text-white font-medium py-3 px-4 border border-gray-500 rounded-md hover:bg-gray-100 active:scale-[0.99] hover:text-blue-primary transition-all text-sm shadow-sm"
            >   
              Générez votre premier contrat
            </Link>

            <Link 
              to="/souscription" 
              className="flex items-center justify-center text-center bg-white text-blue-primary font-medium py-3 px-4 border border-gray-500 rounded-md hover:bg-gray-100 active:scale-[0.99] hover:text-blue-primary transition-all text-sm shadow-sm"
            >
              Découvrir nos abonnements
            </Link>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-blue-primary text-white p-6 rounded-2xl w-full max-w-md justify-self-end flex flex-col gap-5 shadow-lg border border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">
              Générez votre premier contrat
            </h2>
            <p className="text-sm text-gray-300/80 leading-snug">
              Choisissez un type, Lumen Juris s'occupe de la structure et des clauses.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="contract-type" className="text-sm font-medium text-white">
              Quel contrat souhaitez-vous créer ?
            </label>
            
            <select
              id="contract-type"
              name="contractType"
              defaultValue="CDI"
              className="w-full bg-[#E5E7EB] text-gray-900 text-sm font-medium rounded-lg p-3 outline-none focus:ring-2 focus:ring-white/50 transition-all cursor-pointer"
            >
              <option value="" disabled>Sélectionnez un type de contrat</option>
              
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

          <div className="flex flex-col gap-2">
            <textarea
              name="details"
              rows={4}
              placeholder="Plus de précision ?"
              className="w-full bg-white text-gray-900 placeholder:text-gray-500 text-sm rounded-xl p-3.5 outline-none focus:ring-2 focus:ring-white/50 transition-all resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-white text-gray-900 font-medium py-3 rounded-full hover:bg-gray-100 active:scale-[0.99] transition-all text-sm mt-1 shadow-sm"
          >
            Commencer la génération
          </button>
        </form>
      </div>

      <section>
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          {TOOLS.map((t) => (
            <Link
              key={t.title}
              to={t.to}
              className="group flex flex-col md:flex-row gap-6 bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-300 transition-all shadow-sm hover:shadow-md"
            >
              <div className="flex flex-col gap-4 w-full md:w-44 shrink-0">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-900">
                  {t.name}
                </span>
                
                <div className="w-full aspect-square bg-[#E5E5E5] rounded-md flex items-center justify-center text-xs text-gray-600 font-medium text-center p-2 overflow-hidden">
                  {t.img ? (
                    <img src={t.img} alt={t.name} className="w-full h-full object-cover rounded-md" />
                  ) : (
                    "img ou vidéo"
                  )}
                </div>
              </div>

              <div className="flex flex-col flex-1 justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 leading-snug">
                    {t.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed mt-3">
                    {t.desc}
                  </p>
                </div>

                <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 group-hover:text-blue-primary transition-colors">
                  Découvrir
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
